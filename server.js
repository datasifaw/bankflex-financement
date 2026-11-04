
/**
 * BankFlex - Serveur Backend
 * Application de financement à prix fixe
 */

// Importation des modules
const express = require("express");
const path = require("path");

// Création de l'application Express
const app = express();

// Port du serveur
const PORT = 3000;

// Autoriser le traitement des données JSON
app.use(express.json());

// Servir les fichiers HTML, CSS et JavaScript
app.use(express.static(path.join(__dirname, "public")));

// Démarrer le serveur
app.listen(PORT, () => {
    console.log("=================================");
    console.log("  BankFlex - Serveur démarré !");
    console.log(`  Adresse : http://localhost:${PORT}`);
    console.log("=================================");
});
