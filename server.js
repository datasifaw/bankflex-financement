
/**
 * BankFlex - Serveur Backend
 * Node.js + Express + MySQL
 */

// 1. Charger les variables d'environnement
require("dotenv").config();

// 2. Importer les modules
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

// 3. Créer l'application Express
const app = express();

const PORT = Number(process.env.PORT) || 3000;

// 4. Configurer la connexion MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// 5. Configurer Express
app.use(express.json());

app.use(express.static(
    path.join(__dirname, "public")
));

// 6. Tester la connexion MySQL
async function demarrerServeur() {

    try {

        // Exécuter une première requête SQL
        const [resultat] = await db.query(
            "SELECT DATABASE() AS base"
        );

        console.log("=================================");
        console.log("  Connexion MySQL réussie !");
        console.log("  Base :", resultat[0].base);
        console.log("=================================");

        // Démarrer le serveur seulement si MySQL répond
        app.listen(PORT, () => {

            console.log("  BankFlex - Serveur démarré !");
            console.log(`  Adresse : http://localhost:${PORT}`);
            console.log("=================================");

        });

    } catch (erreur) {

        console.error("Connexion MySQL impossible.");
        console.error("Code erreur :", erreur.code || "Inconnu");

        process.exit(1);

    }
}

// 7. Lancer BankFlex
demarrerServeur();
