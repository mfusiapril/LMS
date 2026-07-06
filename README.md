# Loan Shark Management System

A small loan tracking app to capture borrower details, calculate 35% interest, show projected return amounts, and manage payments.

## Features

- Create loan entries with first and last name
- Calculate 35% interest and total amount due
- Auto-populate transaction date
- Track return date
- Manage payments against loans
- Mark loans as paid when the collected amount meets or exceeds the total due
- Filter Transaction based on desired return dates(pay dates 15, 20, 25, 30/31)

## Setup

1. Open a terminal in this folder.
2. Run `npm install`.
3. Add your Azure SQL connection values to `.env`.
4. Start the app with `npm start`.
5. Open `http://localhost:4000` in your browser.

## Azure SQL configuration

The API uses Azure SQL through the `mssql` package. The server loads these values from `.env` when it starts:

```env
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-sql-user
AZURE_SQL_PASSWORD=your-sql-password
```

Optional values:

```env
AZURE_SQL_PORT=1433
AZURE_SQL_ENCRYPT=true
AZURE_SQL_TRUST_CERT=false
```

Use `.env.example` as the template. The real `.env` file is ignored by git so database credentials stay local.

The server creates the `loans` and `payments` tables automatically if they do not already exist.

## Notes: to do

- Data is stored in Azure SQL using the above Azure SQL environment variables.
- The frontend is served from the `public/` directory.
