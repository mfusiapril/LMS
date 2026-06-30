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
3. Set these Azure SQL environment variables (or configure connection string):
   - `AZURE_SQL_SERVER` (e.g. yourserver.database.windows.net)
   - `AZURE_SQL_DATABASE` (e.g. LoanSharkDB)
   - `AZURE_SQL_USER`
   - `AZURE_SQL_PASSWORD`
   - Optional: `AZURE_SQL_PORT` (default: 1433)
4. Start the app with `npm start`.
5. Open `http://localhost:4000` in your browser.

## Notes

- Data is stored in Azure SQL when the above Azure SQL environment variables are configured.
- The frontend is served from the `public/` directory.
