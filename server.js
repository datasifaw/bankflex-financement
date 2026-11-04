
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

app.use(express.static(
    path.join(__dirname, "public")
));

// ============================================
// 4. POLITIQUE COMMERCIALE
// ============================================

const TAUX_MARGE = 0.075;

// Convertir un montant en centimes
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

// Convertir des centimes en euros
function convertirEnEuros(centimes) {
    return (centimes / 100).toFixed(2);
}

// ============================================
// 5. API POST - ENREGISTRER UNE SIMULATION
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

        // Vérifier le nom du bien
        if (
            typeof bien !== "string" ||
            bien.trim().length === 0 ||
            bien.trim().length > 150
        ) {
            return res.status(400).json({
                message: "Le nom du bien est invalide."
            });
        }

        // Vérifier le prix
        if (
            prix === null ||
            prix <= 0 ||
            prix > 100000000000
        ) {
            return res.status(400).json({
                message: "Le prix d'achat est invalide."
            });
        }

        // Vérifier la durée
        if (
            !Number.isInteger(duree) ||
            duree < 1 ||
            duree > 360
        ) {
            return res.status(400).json({
                message: "La durée doit être comprise entre 1 et 360 mois."
            });
        }

        // Calculer la marge commerciale
        const marge = Math.round(
            prix * TAUX_MARGE
        );

        const prixTotal = prix + marge;

        // Vérifier l'apport
        if (
            apport === null ||
            apport < 0 ||
            apport > prixTotal
        ) {
            return res.status(400).json({
                message: "L'apport initial est invalide."
            });
        }

        // Calculer les mensualités
        const montantRestant = prixTotal - apport;

        const mensualite = Math.round(
            montantRestant / duree
        );

        const derniereEcheance =
            montantRestant - mensualite * (duree - 1);

        // Requête SQL INSERT
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
// 6. API GET - HISTORIQUE DES SIMULATIONS
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
// 7. NOUVELLE API GET - DÉTAILS PAR ID
// ============================================

app.get("/api/simulations/:id", async (req, res) => {

    try {

        // Récupérer l'identifiant dans l'URL
        const idTexte = req.params.id;
        const id = Number(idTexte);

        // Vérifier que l'identifiant est valide
        if (
            !/^[1-9]\d*$/.test(idTexte) ||
            !Number.isSafeInteger(id) ||
            id > 2147483647
        ) {
            return res.status(400).json({
                message: "Identifiant de simulation invalide."
            });
        }

        // Rechercher la simulation dans MySQL
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

        // Vérifier si la simulation existe
        if (simulations.length === 0) {
            return res.status(404).json({
                message: "Simulation introuvable."
            });
        }

        // Retourner les détails au navigateur
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
// 8. API GET - STATISTIQUES DU DASHBOARD
// ============================================

app.get("/api/statistiques", async (req, res) => {

    try {

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
                ) AS marge_moyenne

            FROM simulations
        `;

        const [resultat] = await db.query(requete);

        const statistiques = resultat[0];

        res.status(200).json({
            message: "Statistiques récupérées avec succès.",
            statistiques: {
                nombre_simulations:
                    Number(statistiques.nombre_simulations),

                mensualite_moyenne:
                    Number(statistiques.mensualite_moyenne),

                marge_moyenne:
                    Number(statistiques.marge_moyenne)
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
// 9. DÉMARRAGE DU SERVEUR
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
