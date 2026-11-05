# BankFlex — Fixed-Price Financing Simulator

**BankFlex** is an educational web application for simulating the purchase and resale of an asset at a **total resale price agreed upon in advance**. It calculates payment amounts, stores simulations in MySQL, and displays an interactive statistics dashboard.

> **Educational project:** BankFlex uses fictional data. It is not a financing offer, a financial service, or a legally compliant contract template. Any real-world financial use would require appropriate legal, regulatory, and security reviews.

## Features

- Create simulations using an asset name, purchase price, payment term, and initial down payment.
- Calculate a **fixed commercial margin of 7.5% of the purchase price**, applied once to determine the resale price; it is not a recurring interest calculation.
- Calculate the total resale price, remaining balance after the down payment, and estimated monthly payment, with cent-level rounding.
- Save simulations in MySQL.
- View, edit (with automatic recalculation), and delete simulations with confirmation (**CRUD**).
- Browse the **20 most recent simulations**, search by asset name, and filter by payment term.
- View dashboard metrics: total number of simulations, average monthly payment, and average commercial margin.
- Explore two dynamic charts: **simulations by payment term** and **cumulative financial amounts** (purchases, margins, and resales).
- Use a responsive interface built with Bootstrap. The application interface is in French.
- Enable a **read-only demo mode** that disables data changes while keeping calculations, history, and charts available.

## Screenshots

![BankFlex screenshot 1](images/BankFlex-financement1.png)

![BankFlex screenshot 2](images/BankFlex-financement2.png)

![BankFlex screenshot 3](images/BankFlex-financement3.png)

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript, Bootstrap 5, Bootstrap Icons |
| Charts | Chart.js |
| Backend and API | Node.js, Express |
| Database | MySQL 8, `mysql2/promise` |
| Configuration | `dotenv` |
| Version control | Git and GitHub |

Bootstrap, Bootstrap Icons, and Chart.js are loaded from CDNs, so an internet connection is needed to load these assets.

## Project Structure

```text
bankflex-financement/
├── public/
│   └── index.html          # Interface, simulator, and charts
├── images/                 # Project screenshots
├── sql/
│   ├── 1_Création base de données MySQL.sql
│   └── 2_Table simulations.sql
├── server.js               # Express server and REST API
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── .gitignore              # Git exclusion rules
└── README.md               # Project documentation
```

The local `.env` file and `node_modules/` directory must not be committed to Git.

## Local Installation

### Prerequisites

- Node.js and npm (for example, Node.js 20 or newer).
- MySQL Server 8 and MySQL Workbench (or another MySQL client).
- A terminal, such as PowerShell in Visual Studio Code.

### 1. Clone the repository

```powershell
git clone https://github.com/datasifaw/bankflex-financement.git
cd bankflex-financement
```

If you already have the project on your computer, open the existing folder in VS Code instead.

### 2. Install dependencies

```powershell
npm install
```

### 3. Set up MySQL

Run the SQL scripts in the `sql/` folder in this order:

1. `1_Création base de données MySQL.sql`
2. `2_Table simulations.sql`

These scripts initialize the `bankflex_db` database and the `simulations` table. Configure a dedicated MySQL user with the required permissions for that database.

### 4. Configure environment variables

Create a `.env` file in the project root and replace the placeholder password with **your local MySQL password**:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=bankflex_app
DB_PASSWORD=YOUR_LOCAL_MYSQL_PASSWORD
DB_NAME=bankflex_db
```

If your MySQL user has a different name, update `DB_USER` accordingly.

**Security:** Never commit `.env`, passwords, or other secrets. Make sure `.env` is excluded by `.gitignore`.

### 5. Start the application

```powershell
npm start
```

Alternatively, run `node server.js`. Open **http://localhost:3000** in your browser.

**Important:** Access the application through the Express server, not by opening `public/index.html` directly or using a separate static file server. The frontend communicates with the backend API.

## Calculation Method

BankFlex applies the 7.5% commercial margin **once to the purchase price**, regardless of the payment term.

```text
Commercial margin = Purchase price × 7.5%
Total resale price = Purchase price + Commercial margin
Remaining balance = Total resale price − Initial down payment
Estimated monthly payment = Remaining balance ÷ Number of months
```

**Illustrative example:** A €12,000 purchase results in a €900 commercial margin and a €12,900 resale price. With a €3,000 down payment over 30 months, the remaining €9,900 corresponds to an estimated payment of **€330 per month**.

Amounts are rounded to the nearest cent. The final installment may be adjusted slightly to ensure that the sum of payments equals the remaining balance.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/simulations` | Create a simulation |
| `GET` | `/api/simulations` | Retrieve the 20 most recent simulations |
| `GET` | `/api/simulations/:id` | Retrieve a simulation by ID |
| `PUT` | `/api/simulations/:id` | Update and recalculate a simulation |
| `DELETE` | `/api/simulations/:id` | Delete a simulation |
| `GET` | `/api/statistiques` | Retrieve dashboard metrics and chart data |
| `GET` | `/api/configuration` | Check whether read-only mode is enabled |

Example request body for `POST /api/simulations`:

```json
{
  "bien": "Test vehicle",
  "prix_achat": 12000,
  "duree_mois": 30,
  "apport_initial": 3000
}
```

The commercial margin is determined by the server and is not selected by the client. API field names are in French to match the application's existing data model.

The statistics endpoint returns overall metrics, a `repartition_durees` object (up to 12 months, 13–36 months, and more than 36 months), and a `montants_financiers` object (`total_achats`, `total_marges`, `total_reventes`). These totals include **all** stored simulations; the history endpoint is limited to the latest 20.

## Read-Only Demo Mode

For a read-only demonstration, set `BANKFLEX_READ_ONLY=true` before starting the server. In PowerShell:

```powershell
$env:BANKFLEX_READ_ONLY = "true"
npm start
```

Then visit **http://localhost:3000/api/configuration**. The API should return:

```json
{
  "lecture_seule": true
}
```

In this mode, visitors can calculate simulations, view stored records, and explore charts, but requests that create, update, or delete simulations are blocked with HTTP `403 Forbidden`.

The server also enables read-only mode when `NODE_ENV=production` or the `RAILWAY_ENVIRONMENT` variable is present. This protects the demo from unauthenticated write requests; it does **not** provide user authentication or complete production-grade security. Use fictional data only.

To return to normal local mode, stop the server and run:

```powershell
Remove-Item Env:BANKFLEX_READ_ONLY -ErrorAction SilentlyContinue
npm start
```

Make sure production-related environment variables are not set in your local terminal if you expect write operations to be available.

## Quick Verification

1. Open `http://localhost:3000/api/statistiques` and check the JSON response.
2. Calculate a simulation and verify the purchase price, margin, resale price, and monthly payment.
3. In normal local mode, save the simulation and find it in the history.
4. Check that both charts reflect the stored data.
5. Test viewing, editing, and deleting a sample simulation.
6. In read-only mode, confirm that write operations return `403 Forbidden`.

## Project Scope and Limitations

BankFlex is a learning project designed to run locally. It does not include user accounts, role-based access control, real contracts, real payment processing, or a production-ready public deployment. Additional security, privacy, and regulatory work would be required for any real-world financial service.

## Release and Repository

- **Latest V1 release:** [BankFlex v1.0.0](https://github.com/datasifaw/bankflex-financement/releases/tag/v1.0.0)
- **Source code:** [datasifaw/bankflex-financement](https://github.com/datasifaw/bankflex-financement)
