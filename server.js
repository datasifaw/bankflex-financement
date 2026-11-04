
/**
 * BankFlex - Backend
 * Node.js + Express + MySQL
 */

// 1. Charger la configuration
require("dotenv").config();

// 2. Importer les modules
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

// 3. Initialiser Express
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 4. Connexion MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// 5. Configuration Express
app.use(express.json());

app.use(express.static(
    path.join(__dirname, "public")
));

// 6. Politique commerciale de BankFlex
// Marge fixe de 7,5 % du prix d'achat
const TAUX_MARGE = 0.075;

// Conversion d'un montant en centimes
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

// Conversion des centimes en euros
function convertirEnEuros(centimes) {
    return (centimes / 100).toFixed(2);
}

// 7. API : enregistrer une simulation
app.post("/api/simulations", async (req, res) => {

    try {

        // Informations envoyées par le client
        const {
            bien,
            prix_achat,
            duree_mois,
            apport_initial = 0
        } = req.body || {};

        // Conversion et validation
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

        // Calcul de la marge à 7,5 %
        const marge = Math.round(prix * 75 / 1000);

        // Prix total de revente
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

        // Calcul de la mensualité
        const montantRestant = prixTotal - apport;
        const mensualite = Math.round(
            montantRestant / duree
        );

        // Ajustement de la dernière échéance
        const derniereEcheance =
            montantRestant - mensualite * (duree - 1);

        // 8. Enregistrer dans MySQL
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

        // 9. Réponse de notre API
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

// 10. Démarrer BankFlex
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
