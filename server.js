const express = require('express');
const path = require('path');
require('dotenv').config({ quiet: true });
const sql = require('mssql');

const app = express();

const requiredEnv = [
  'AZURE_SQL_SERVER',
  'AZURE_SQL_DATABASE',
  'AZURE_SQL_USER',
  'AZURE_SQL_PASSWORD' 
];

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  port: Number(process.env.AZURE_SQL_PORT || 1433),
  options: {
    encrypt: process.env.AZURE_SQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.AZURE_SQL_TRUST_CERT === 'true'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool;

const ensureEnv = () => {
  const missing = requiredEnv.filter(name => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing Azure SQL environment variables: ${missing.join(', ')}`);
  }
};

const initDb = async () => {
  ensureEnv();
  pool = await sql.connect(dbConfig);

  await pool.request().batch(`
    IF OBJECT_ID('dbo.loans', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.loans (
        id INT IDENTITY(1,1) PRIMARY KEY,
        firstName NVARCHAR(100) NOT NULL,
        lastName NVARCHAR(100) NOT NULL,
        amountBorrowed DECIMAL(18, 2) NOT NULL,
        interestAmount DECIMAL(18, 2) NOT NULL,
        totalDue DECIMAL(18, 2) NOT NULL,
        dateOfTransaction DATETIME2 NOT NULL,
        returnDate DATE NOT NULL,
        paidAmount DECIMAL(18, 2) NOT NULL CONSTRAINT DF_loans_paidAmount DEFAULT 0,
        isPaid BIT NOT NULL CONSTRAINT DF_loans_isPaid DEFAULT 0
      );
    END;

    IF OBJECT_ID('dbo.payments', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.payments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        loanId INT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        date DATETIME2 NOT NULL,
        CONSTRAINT FK_payments_loans FOREIGN KEY (loanId) REFERENCES dbo.loans(id)
      );
    END;
  `);

  console.log('Connected to Azure SQL database', dbConfig.database);
};

const request = () => pool.request();

const formatDateOnly = (value) => {
  if (!value) return value;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) return value;
  if (typeof value === 'string') return value;
  return value.toISOString();
};

const formatLoan = (loan) => ({
  id: loan.id,
  firstName: loan.firstName,
  lastName: loan.lastName,
  amountBorrowed: Number(loan.amountBorrowed || 0),
  interestAmount: Number(loan.interestAmount || 0),
  totalDue: Number(loan.totalDue || 0),
  dateOfTransaction: formatDateTime(loan.dateOfTransaction),
  returnDate: formatDateOnly(loan.returnDate),
  paidAmount: Number(loan.paidAmount || 0),
  isPaid: Boolean(loan.isPaid),
  profit: Number(((Number(loan.totalDue) || 0) - (Number(loan.amountBorrowed) || 0)).toFixed(2))
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// List loans
app.get('/api/loans', async (req, res) => {
  try {
    const result = await request().query('SELECT * FROM dbo.loans ORDER BY dateOfTransaction DESC');
    res.json(result.recordset.map(formatLoan));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create loan
app.post('/api/loans', async (req, res) => {
  try {
    const { firstName, lastName, amountBorrowed, returnDate } = req.body;
    const amount = parseFloat(amountBorrowed);
    const parsedReturnDate = returnDate ? new Date(`${returnDate}T00:00:00`) : null;
    if (!firstName || !lastName || !parsedReturnDate || Number.isNaN(parsedReturnDate.getTime()) || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid loan data provided.' });
    }

    const interestAmount = Number((amount * 0.35).toFixed(2));
    const totalDue = Number((amount + interestAmount).toFixed(2));
    const dateOfTransaction = new Date();

    const result = await request()
      .input('firstName', sql.NVarChar(100), firstName)
      .input('lastName', sql.NVarChar(100), lastName)
      .input('amountBorrowed', sql.Decimal(18, 2), amount)
      .input('interestAmount', sql.Decimal(18, 2), interestAmount)
      .input('totalDue', sql.Decimal(18, 2), totalDue)
      .input('dateOfTransaction', sql.DateTime2, dateOfTransaction)
      .input('returnDate', sql.Date, parsedReturnDate)
      .query(`
        INSERT INTO dbo.loans (
          firstName,
          lastName,
          amountBorrowed,
          interestAmount,
          totalDue,
          dateOfTransaction,
          returnDate,
          paidAmount,
          isPaid
        )
        OUTPUT INSERTED.*
        VALUES (
          @firstName,
          @lastName,
          @amountBorrowed,
          @interestAmount,
          @totalDue,
          @dateOfTransaction,
          @returnDate,
          0,
          0
        )
      `);

    res.json(formatLoan(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add payment to loan
app.post('/api/loans/:id/payments', async (req, res) => {
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    const loanId = Number(req.params.id);
    const amount = parseFloat(req.body.amount);
    if (!loanId || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment data.' });
    }

    await transaction.begin();
    transactionStarted = true;

    const loanResult = await new sql.Request(transaction)
      .input('loanId', sql.Int, loanId)
      .query('SELECT * FROM dbo.loans WITH (UPDLOCK, ROWLOCK) WHERE id = @loanId');

    const loan = loanResult.recordset[0];
    if (!loan) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Loan not found.' });
    }

    const date = new Date();
    const paymentResult = await new sql.Request(transaction)
      .input('loanId', sql.Int, loanId)
      .input('amount', sql.Decimal(18, 2), amount)
      .input('date', sql.DateTime2, date)
      .query(`
        INSERT INTO dbo.payments (loanId, amount, date)
        OUTPUT INSERTED.id
        VALUES (@loanId, @amount, @date)
      `);

    const paidAmount = Number((Number(loan.paidAmount || 0) + amount).toFixed(2));
    const isPaid = paidAmount >= Number(loan.totalDue || 0);

    await new sql.Request(transaction)
      .input('paidAmount', sql.Decimal(18, 2), paidAmount)
      .input('isPaid', sql.Bit, isPaid)
      .input('loanId', sql.Int, loanId)
      .query('UPDATE dbo.loans SET paidAmount = @paidAmount, isPaid = @isPaid WHERE id = @loanId');

    await transaction.commit();
    transactionStarted = false;

    res.json({
      loanId,
      paidAmount,
      isPaid,
      paymentId: paymentResult.recordset[0].id
    });
  } catch (err) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Failed to roll back payment transaction:', rollbackErr);
      }
    }
    res.status(500).json({ error: err.message });
  }
});

// Get payments for a loan
app.get('/api/loans/:id/payments', async (req, res) => {
  try {
    const loanId = Number(req.params.id);
    if (!loanId) return res.status(400).json({ error: 'Invalid loan ID.' });

    const result = await request()
      .input('loanId', sql.Int, loanId)
      .query('SELECT * FROM dbo.payments WHERE loanId = @loanId ORDER BY date DESC');

    res.json(result.recordset.map(payment => ({
      ...payment,
      amount: Number(payment.amount),
      date: formatDateTime(payment.date)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All payments (joined with loans)
app.get('/api/payments', async (req, res) => {
  try {
    const result = await request().query(`
      SELECT
        p.id,
        p.loanId,
        p.amount,
        p.date,
        l.firstName,
        l.lastName,
        l.totalDue,
        l.paidAmount
      FROM dbo.payments p
      JOIN dbo.loans l ON p.loanId = l.id
      ORDER BY p.date DESC
    `);

    res.json(result.recordset.map(payment => ({
      id: payment.id,
      loanId: payment.loanId,
      amount: Number(payment.amount),
      date: formatDateTime(payment.date),
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

    const result = await request()
      .input('currentYear', sql.Int, currentYear)
      .input('currentMonth', sql.Int, currentMonth)
      .query(`
        SELECT *
        FROM dbo.loans
        WHERE YEAR(returnDate) = @currentYear
          AND MONTH(returnDate) = @currentMonth
      `);

    const summary = result.recordset.reduce((acc, loan) => {
      const profit = Number(((Number(loan.totalDue) || 0) - (Number(loan.amountBorrowed) || 0)).toFixed(2));
      const collected = Number(loan.paidAmount || 0);
      const outstanding = Number(((Number(loan.totalDue) || 0) - (Number(loan.paidAmount) || 0)).toFixed(2));
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
