const manageLoansBody = document.getElementById('manage-loans-body');
const paymentsBody = document.getElementById('payments-body');
const messageBox = document.getElementById('manage-message-box');

const manageSummaryFields = {
  totalReturn: document.getElementById('manage-total-return'),
  totalCollected: document.getElementById('manage-total-collected'),
  totalOutstanding: document.getElementById('manage-total-outstanding'),
  monthProfit: document.getElementById('manage-month-profit')
};

const showMessage = (text, type = 'info') => {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.className = type === 'error' ? 'error' : 'success';
  setTimeout(() => {
    messageBox.textContent = '';
    messageBox.className = '';
  }, 4000);
};

const formatCurrency = (value) => `R${Number(value).toFixed(2)}`;
let loansCache = [];

const normalizeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getLoanFilter = () => document.getElementById('filterDate')?.value.trim() || '';

const matchesLoanFilter = (loan, filterValue) => {
  if (!filterValue) return true;
  return normalizeDate(loan.returnDate).startsWith(filterValue);
};

const renderLoans = () => {
  if (!manageLoansBody) return;

  const filterValue = getLoanFilter();
  const filteredLoans = loansCache.filter(loan => matchesLoanFilter(loan, filterValue));

  manageLoansBody.innerHTML = '';

  filteredLoans.forEach((loan) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-4">
        <div class="font-semibold text-slate-900">${loan.firstName} ${loan.lastName}</div>
        <div class="text-xs text-slate-500">Due ${new Date(loan.returnDate).toLocaleDateString()}</div>
      </td>
      <td class="px-4 py-4">${formatCurrency(loan.amountBorrowed)}</td>
      <td class="px-4 py-4">${formatCurrency(loan.interestAmount)}</td>
      <td class="px-4 py-4">${formatCurrency(loan.totalDue)}</td>
      <td class="px-4 py-4">
        <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${loan.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${loan.isPaid ? 'Paid' : 'Pending'}
        </span>
      </td>
      <td class="px-4 py-4">
        <div class="payment-row flex items-center gap-2">
          <input type="number" step="0.01" min="0.01" placeholder="Pay" data-loan-id="${loan.id}" class="w-24 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          <button data-pay-id="${loan.id}" class="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Pay</button>
        </div>
      </td>
    `;
    manageLoansBody.appendChild(row);
  });

  if (!filteredLoans.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500">No transactions match this filter.</td>';
    manageLoansBody.appendChild(row);
  }
};

const loadSummary = async () => {
  const summaryElements = Object.values(manageSummaryFields);
  if (summaryElements.some(element => !element)) return;

  const response = await fetch('/api/summary');
  const summary = await response.json();

  manageSummaryFields.totalReturn.textContent = formatCurrency(summary.totalProjectedReturn);
  manageSummaryFields.totalCollected.textContent = formatCurrency(summary.totalCollected);
  manageSummaryFields.totalOutstanding.textContent = formatCurrency(summary.totalOutstanding);
  manageSummaryFields.monthProfit.textContent = formatCurrency(summary.monthProfit);
};

const loadLoans = async () => {
  const response = await fetch('/api/loans');
  loansCache = await response.json();
  renderLoans();
};

const handlePayment = async (loanId, amount, input) => {
  const response = await fetch(`/api/loans/${loanId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });

  if (!response.ok) {
    const error = await response.json();
    showMessage(error.error || 'Payment failed.', 'error');
    return;
  }

  input.value = '';
  await refreshData();
  showMessage('Payment recorded successfully.');
};

const refreshData = async () => {
  await Promise.all([loadSummary(), loadLoans()]);
};

const manageLoansTable = document.getElementById('manage-loans-table');
if (manageLoansTable) {
  manageLoansTable.addEventListener('click', async (event) => {
    if (event.target.matches('button[data-pay-id]')) {
      const loanId = event.target.dataset.payId;
      const input = event.target.closest('.payment-row').querySelector('input');
      const amount = parseFloat(input.value);
      if (!amount || amount <= 0) {
        showMessage('Enter a valid payment amount.', 'error');
        return;
      }
      await handlePayment(loanId, amount, input);
    }
  });
}

const filterBtn = document.getElementById('filterBtn');
const filterDate = document.getElementById('filterDate');

if (filterBtn) {
  filterBtn.addEventListener('click', () => {
    const filterDate = document.getElementById('filterDate');
    filterDate.classList.toggle('hidden');
    if (!filterDate.classList.contains('hidden')) filterDate.focus();
  });
}

if (filterDate) {
  filterDate.addEventListener('input', renderLoans);
}

refreshData();
