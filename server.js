
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const app = express();
const dbPath = path.join(__dirname, 'loans.db');

let sqliteDb;
let dbAll, dbGet, dbRun;

const initDb = async () => {
  sqliteDb = new sqlite3.Database(dbPath);
  dbAll = promisify(sqliteDb.all.bind(sqliteDb));
  dbGet = promisify(sqliteDb.get.bind(sqliteDb));
  dbRun = (sqlStmt, params = []) => new Promise((resolve, reject) => {
    sqliteDb.run(sqlStmt, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

  await dbRun(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      amountBorrowed REAL NOT NULL,
      interestAmount REAL NOT NULL,
      totalDue REAL NOT NULL,
      dateOfTransaction TEXT NOT NULL,
      returnDate TEXT NOT NULL,
      paidAmount REAL NOT NULL DEFAULT 0,
      isPaid INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loanId INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (loanId) REFERENCES loans(id)
    )
  `);

  console.log('Initialized local SQLite DB at', dbPath);
};

const formatLoan = (loan) => ({
  id: loan.id,
  firstName: loan.firstName,
  lastName: loan.lastName,
  amountBorrowed: Number(loan.amountBorrowed || 0),
  interestAmount: Number(loan.interestAmount || 0),
  totalDue: Number(loan.totalDue || 0),
  dateOfTransaction: loan.dateOfTransaction,
  returnDate: loan.returnDate,
  paidAmount: Number(loan.paidAmount || 0),
  isPaid: Boolean(loan.isPaid),
  profit: Number(((loan.totalDue || 0) - (loan.amountBorrowed || 0)).toFixed(2))
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// List loans
app.get('/api/loans', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM loans ORDER BY dateOfTransaction DESC');
    res.json(rows.map(formatLoan));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create loan
app.post('/api/loans', async (req, res) => {
  try {
    const { firstName, lastName, amountBorrowed, returnDate } = req.body;
    const amount = parseFloat(amountBorrowed);
    if (!firstName || !lastName || !returnDate || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid loan data provided.' });
    }

    const interestAmount = Number((amount * 0.35).toFixed(2));
    const totalDue = Number((amount + interestAmount).toFixed(2));
    const dateOfTransaction = new Date().toISOString();

    const result = await dbRun(
      'INSERT INTO loans (firstName, lastName, amountBorrowed, interestAmount, totalDue, dateOfTransaction, returnDate, paidAmount, isPaid) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)',
      [firstName, lastName, amount, interestAmount, totalDue, dateOfTransaction, returnDate]
    );

    const id = result.lastID;
    const loan = await dbGet('SELECT * FROM loans WHERE id = ?', [id]);
    res.json(formatLoan(loan));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add payment to loan
app.post('/api/loans/:id/payments', async (req, res) => {
  try {
    const loanId = req.params.id;
    const amount = parseFloat(req.body.amount);
    if (!loanId || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment data.' });
    }

    const loan = await dbGet('SELECT * FROM loans WHERE id = ?', [loanId]);
    if (!loan) return res.status(404).json({ error: 'Loan not found.' });

    const date = new Date().toISOString();
    const paymentResult = await dbRun('INSERT INTO payments (loanId, amount, date) VALUES (?, ?, ?)', [loanId, amount, date]);

    const paidAmount = Number((Number(loan.paidAmount || 0) + amount).toFixed(2));
    const isPaid = paidAmount >= Number(loan.totalDue || 0) ? 1 : 0;
    await dbRun('UPDATE loans SET paidAmount = ?, isPaid = ? WHERE id = ?', [paidAmount, isPaid, loanId]);

    res.json({ loanId, paidAmount, isPaid: Boolean(isPaid), paymentId: paymentResult.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payments for a loan
app.get('/api/loans/:id/payments', async (req, res) => {
  try {
    const loanId = req.params.id;
    if (!loanId) return res.status(400).json({ error: 'Invalid loan ID.' });
    const rows = await dbAll('SELECT * FROM payments WHERE loanId = ? ORDER BY date DESC', [loanId]);
    res.json(rows.map(p => ({ ...p, amount: Number(p.amount) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All payments (joined with loans)
app.get('/api/payments', async (req, res) => {
  try {
    const rows = await dbAll('SELECT p.id, p.loanId, p.amount, p.date, l.firstName, l.lastName, l.totalDue, l.paidAmount FROM payments p JOIN loans l ON p.loanId = l.id ORDER BY p.date DESC');
    res.json(rows.map(payment => ({
      id: payment.id,
      loanId: payment.loanId,
      amount: Number(payment.amount),
      date: payment.date,
      firstName: payment.firstName,
      lastName: payment.lastName,
      totalDue: Number(payment.totalDue),
      paidAmount: Number(payment.paidAmount)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summary
app.get('/api/summary', async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const rows = await dbAll(`SELECT * FROM loans WHERE strftime('%Y', returnDate) = '${currentYear}' AND strftime('%m', returnDate) = '${String(currentMonth).padStart(2, '0')}'`);

    const summary = rows.reduce((acc, loan) => {
      const profit = Number(((loan.totalDue || 0) - (loan.amountBorrowed || 0)).toFixed(2));
      const collected = Number(loan.paidAmount || 0);
      const outstanding = Number(((loan.totalDue || 0) - (loan.paidAmount || 0)).toFixed(2));
      const transactionDate = new Date(loan.dateOfTransaction);
      const isCurrentMonth = transactionDate.getMonth() + 1 === currentMonth && transactionDate.getFullYear() === currentYear;

      acc.totalLoans += 1;
      acc.totalBorrowed += Number(loan.amountBorrowed || 0);
      acc.totalProjectedReturn += Number(loan.totalDue || 0);
      acc.totalProjectedProfit += profit;
      acc.totalCollected += collected;
      acc.totalOutstanding += outstanding;

      if (isCurrentMonth) {
        acc.monthLoanCount += 1;
        acc.monthBorrowed += Number(loan.amountBorrowed || 0);
        acc.monthProjectedReturn += Number(loan.totalDue || 0);
        acc.monthProfit += profit;
      }

      return acc;
    }, {
      totalLoans: 0,
      totalBorrowed: 0,
      totalProjectedReturn: 0,
      totalProjectedProfit: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      monthLoanCount: 0,
      monthBorrowed: 0,
      monthProjectedReturn: 0,
      monthProfit: 0
    });

    Object.keys(summary).forEach(key => {
      if (typeof summary[key] === 'number') summary[key] = Number(summary[key].toFixed(2));
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 4000;
const start = async () => {
  await initDb();
  app.listen(port, () => console.log(`Loan management app running on http://localhost:${port}`));
};

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
