
/**
 * BankFlex - Backend
 * Node.js + Express + MySQL
 */

// ============================================
// 1. CONFIGURATION
// ============================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ============================================
// 2. CONNEXION MYSQL
// ============================================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// ============================================
// 3. CONFIGURATION EXPRESS
// ============================================

app.use(express.json());

app.use(
    express.static(path.join(__dirname, "public"))
);

// ============================================
// 4. POLITIQUE COMMERCIALE
// ============================================

const TAUX_MARGE = 0.075;

function convertirEnCentimes(valeur) {

    const texte = String(valeur ?? "").trim();

    if (!/^\d+(\.\d{1,2})?$/.test(texte)) {
        return null;
    }

    const [euros, decimales = ""] = texte.split(".");

    const centimes =
        Number(euros) * 100 +
        Number(decimales.padEnd(2, "0"));

    return Number.isSafeInteger(centimes)
        ? centimes
        : null;
}

function convertirEnEuros(centimes) {
    return (centimes / 100).toFixed(2);
}

// ============================================
// 5. API POST - CRÉER UNE SIMULATION
// ============================================

app.post("/api/simulations", async (req, res) => {

    try {

        const {
            bien,
            prix_achat,
            duree_mois,
            apport_initial = 0
        } = req.body || {};

        const prix = convertirEnCentimes(prix_achat);
        const apport = convertirEnCentimes(apport_initial);
        const duree = Number(duree_mois);

        if (
            typeof bien !== "string" ||
            bien.trim().length === 0 ||
            bien.trim().length > 150
        ) {
            return res.status(400).json({
                message: "Le nom du bien est invalide."
            });
        }

        if (
            prix === null ||
            prix <= 0 ||
            prix > 100000000000
        ) {
            return res.status(400).json({
                message: "Le prix d'achat est invalide."
            });
        }

        if (
            !Number.isInteger(duree) ||
            duree < 1 ||
            duree > 360
        ) {
            return res.status(400).json({
                message: "La durée doit être comprise entre 1 et 360 mois."
            });
        }

        const marge = Math.round(prix * TAUX_MARGE);
        const prixTotal = prix + marge;

        if (
            apport === null ||
            apport < 0 ||
            apport > prixTotal
        ) {
            return res.status(400).json({
                message: "L'apport initial est invalide."
            });
        }

        const montantRestant = prixTotal - apport;

        const mensualite = Math.round(
            montantRestant / duree
        );

        const derniereEcheance =
            montantRestant - mensualite * (duree - 1);

        const requete = `
            INSERT INTO simulations (
                bien,
                prix_achat,
                marge_commerciale,
                prix_total,
                apport_initial,
                duree_mois,
                mensualite
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const valeurs = [
            bien.trim(),
            convertirEnEuros(prix),
            convertirEnEuros(marge),
            convertirEnEuros(prixTotal),
            convertirEnEuros(apport),
            duree,
            convertirEnEuros(mensualite)
        ];

        const [resultat] = await db.execute(
            requete,
            valeurs
        );

        res.status(201).json({
            message: "Simulation enregistrée avec succès.",
            simulation: {
                id: resultat.insertId,
                bien: bien.trim(),
                prix_achat: convertirEnEuros(prix),
                marge_commerciale: convertirEnEuros(marge),
                prix_total: convertirEnEuros(prixTotal),
                apport_initial: convertirEnEuros(apport),
                duree_mois: duree,
                mensualite: convertirEnEuros(mensualite),
                derniere_echeance: convertirEnEuros(
                    derniereEcheance
                )
            }
        });

    } catch (erreur) {

        console.error(
            "Erreur d'enregistrement :",
            erreur.code || "Erreur inconnue"
        );

        res.status(500).json({
            message: "Impossible d'enregistrer la simulation."
        });
    }
});

// ============================================
// 6. API GET - HISTORIQUE
// ============================================

app.get("/api/simulations", async (req, res) => {

    try {

        const requete = `
            SELECT
                id,
                bien,
                prix_achat,
                marge_commerciale,
                prix_total,
                apport_initial,
                duree_mois,
                mensualite,
                date_creation
            FROM simulations
            ORDER BY date_creation DESC, id DESC
            LIMIT 20
        `;

        const [simulations] = await db.query(requete);

        res.status(200).json({
            message: "Historique récupéré avec succès.",
            total: simulations.length,
            simulations: simulations
        });

    } catch (erreur) {

        console.error(
            "Erreur de récupération :",
            erreur.code || "Erreur inconnue"
        );

        res.status(500).json({
            message: "Impossible de récupérer l'historique."
        });
    }
});

// ============================================
// 7. API GET - DÉTAILS PAR ID
// ============================================

app.get("/api/simulations/:id", async (req, res) => {

    try {

        const idTexte = req.params.id;
        const id = Number(idTexte);

        if (
            !/^[1-9]\d*$/.test(idTexte) ||
            !Number.isSafeInteger(id) ||
            id > 2147483647
        ) {
            return res.status(400).json({
                message: "Identifiant de simulation invalide."
            });
        }

        const requete = `
            SELECT
                id,
                bien,
                prix_achat,
                marge_commerciale,
                prix_total,
                apport_initial,
                duree_mois,
                mensualite,
                date_creation
            FROM simulations
            WHERE id = ?
        `;

        const [simulations] = await db.execute(
            requete,
            [id]
        );

        if (simulations.length === 0) {
            return res.status(404).json({
                message: "Simulation introuvable."
            });
        }

        res.status(200).json({
            message: "Détails récupérés avec succès.",
            simulation: simulations[0]
        });

    } catch (erreur) {

        console.error(
            "Erreur de consultation :",
            erreur.code || "Erreur inconnue"
        );

        res.status(500).json({
            message: "Impossible de consulter la simulation."
        });
    }
});

// ============================================
// 8. API PUT - MODIFIER PAR ID
// ============================================

app.put("/api/simulations/:id", async (req, res) => {

    try {

        const idTexte = req.params.id;
        const id = Number(idTexte);

        if (
            !/^[1-9]\d*$/.test(idTexte) ||
            !Number.isSafeInteger(id) ||
            id > 2147483647
        ) {
            return res.status(400).json({
                message: "Identifiant de simulation invalide."
            });
        }

        const {
            bien,
            prix_achat,
            duree_mois,
            apport_initial = 0
        } = req.body || {};

        const prix = convertirEnCentimes(prix_achat);
        const apport = convertirEnCentimes(apport_initial);
        const duree = Number(duree_mois);

        if (
            typeof bien !== "string" ||
            bien.trim().length === 0 ||
            bien.trim().length > 150
        ) {
            return res.status(400).json({
                message: "Le nom du bien est invalide."
            });
        }

        if (
            prix === null ||
            prix <= 0 ||
            prix > 100000000000
        ) {
            return res.status(400).json({
                message: "Le prix d'achat est invalide."
            });
        }

        if (
            !Number.isInteger(duree) ||
            duree < 1 ||
            duree > 360
        ) {
            return res.status(400).json({
                message: "La durée doit être comprise entre 1 et 360 mois."
            });
        }

        const marge = Math.round(prix * TAUX_MARGE);
        const prixTotal = prix + marge;

        if (
            apport === null ||
            apport < 0 ||
            apport > prixTotal
        ) {
            return res.status(400).json({
                message: "L'apport initial est invalide."
            });
        }

        const montantRestant = prixTotal - apport;

        const mensualite = Math.round(
            montantRestant / duree
        );

        const requeteModification = `
            UPDATE simulations
            SET
                bien = ?,
                prix_achat = ?,
                marge_commerciale = ?,
                prix_total = ?,
                apport_initial = ?,
                duree_mois = ?,
                mensualite = ?
            WHERE id = ?
        `;

        const valeurs = [
            bien.trim(),
            convertirEnEuros(prix),
            convertirEnEuros(marge),
            convertirEnEuros(prixTotal),
            convertirEnEuros(apport),
            duree,
            convertirEnEuros(mensualite),
            id
        ];

        await db.execute(
            requeteModification,
            valeurs
        );

        const requeteLecture = `
            SELECT
                id,
                bien,
                prix_achat,
                marge_commerciale,
                prix_total,
                apport_initial,
                duree_mois,
                mensualite,
                date_creation
            FROM simulations
            WHERE id = ?
        `;

        const [simulations] = await db.execute(
            requeteLecture,
            [id]
        );

        if (simulations.length === 0) {
            return res.status(404).json({
                message: "Simulation introuvable."
            });
        }

        res.status(200).json({
            message: "Simulation modifiée avec succès.",
            simulation: simulations[0]
        });

    } catch (erreur) {

        console.error(
            "Erreur de modification :",
            erreur.code || "Erreur inconnue"
        );

        res.status(500).json({
            message: "Impossible de modifier la simulation."
        });
    }
});

// ============================================
// 9. API DELETE - SUPPRIMER PAR ID
// ============================================

app.delete("/api/simulations/:id", async (req, res) => {

    try {

        const idTexte = req.params.id;
        const id = Number(idTexte);

        if (
            !/^[1-9]\d*$/.test(idTexte) ||
            !Number.isSafeInteger(id) ||
            id > 2147483647
        ) {
            return res.status(400).json({
                message: "Identifiant de simulation invalide."
            });
        }

        const requete = `
            DELETE FROM simulations
            WHERE id = ?
        `;

        const [resultat] = await db.execute(
            requete,
            [id]
        );

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Simulation introuvable."
            });
        }

        res.status(200).json({
            message: "Simulation supprimée avec succès.",
            id: id
        });

    } catch (erreur) {

        console.error(
            "Erreur de suppression :",
            erreur.code || "Erreur inconnue"
        );

        res.status(500).json({
            message: "Impossible de supprimer la simulation."
        });
    }
});

// ============================================
// 10. API GET - STATISTIQUES ET DURÉES
// ============================================

app.get("/api/statistiques", async (req, res) => {

    try {

        /*
         * Nous conservons les trois statistiques
         * déjà utilisées par le dashboard.
         *
         * Nous ajoutons trois groupes de durées :
         * - jusqu'à 12 mois
         * - de 13 à 36 mois
         * - plus de 36 mois
         */

        const requete = `
            SELECT
                COUNT(*) AS nombre_simulations,

                COALESCE(
                    ROUND(AVG(mensualite), 2),
                    0
                ) AS mensualite_moyenne,

                COALESCE(
                    ROUND(AVG(marge_commerciale), 2),
                    0
                ) AS marge_moyenne,

                COALESCE(
                    SUM(
                        CASE
                            WHEN duree_mois <= 12 THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS duree_courte,

                COALESCE(
                    SUM(
                        CASE
                            WHEN duree_mois BETWEEN 13 AND 36 THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS duree_moyenne,

                COALESCE(
                    SUM(
                        CASE
                            WHEN duree_mois > 36 THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS duree_longue

            FROM simulations
        `;

        const [resultat] = await db.query(requete);

        const stats = resultat[0];

        res.status(200).json({

            message: "Statistiques récupérées avec succès.",

            statistiques: {

                // Indicateurs déjà présents
                nombre_simulations:
                    Number(stats.nombre_simulations),

                mensualite_moyenne:
                    Number(stats.mensualite_moyenne),

                marge_moyenne:
                    Number(stats.marge_moyenne),

                // NOUVEAU : données du futur graphique
                repartition_durees: {
                    jusqua_12_mois:
                        Number(stats.duree_courte),

                    de_13_a_36_mois:
                        Number(stats.duree_moyenne),

                    plus_de_36_mois:
                        Number(stats.duree_longue)
                }

            }
        });

    } catch (erreur) {

        console.error(
            "Erreur des statistiques :",
            erreur.code || "Erreur inconnue"
        );

        res.status(500).json({
            message: "Impossible de récupérer les statistiques."
        });
    }
});

// ============================================
// 11. DÉMARRAGE DU SERVEUR
// ============================================

async function demarrerServeur() {

    try {

        const [resultat] = await db.query(
            "SELECT DATABASE() AS base"
        );

        console.log("=================================");
        console.log(" Connexion MySQL réussie !");
        console.log(" Base :", resultat[0].base);
        console.log("=================================");

        app.listen(PORT, () => {

            console.log(" BankFlex - Serveur démarré !");
            console.log(` http://localhost:${PORT}`);
            console.log("=================================");

        });

    } catch (erreur) {

        console.error(
            "Connexion MySQL impossible :",
            erreur.code || "Erreur inconnue"
        );

        process.exit(1);
    }
}

demarrerServeur();
