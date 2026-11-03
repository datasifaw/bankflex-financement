USE bankflex_db;

CREATE TABLE IF NOT EXISTS simulations (
    id INT AUTO_INCREMENT PRIMARY KEY,

    bien VARCHAR(150) NOT NULL,

    prix_achat DECIMAL(12,2) NOT NULL,

    marge_commerciale DECIMAL(12,2) NOT NULL,

    prix_total DECIMAL(12,2) NOT NULL,

    apport_initial DECIMAL(12,2) DEFAULT 0,

    duree_mois INT NOT NULL,

    mensualite DECIMAL(12,2) NOT NULL,

    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
