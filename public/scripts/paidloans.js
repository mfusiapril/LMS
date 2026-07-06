const paymentsBody = document.getElementById('payments-body');
const formatCurrency = (value) => `R${Number(value).toFixed(2)}`;
let paymentsCache = [];

const normalizeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getPaymentFilter = () => document.getElementById('filterDate')?.value.trim() || '';

const matchesPaymentFilter = (payment, filterValue) => {
  if (!filterValue) return true;
  return normalizeDate(payment.date).startsWith(filterValue);
};

const renderPayments = () => {
  const filterValue = getPaymentFilter();
  const filteredPayments = paymentsCache.filter(payment => matchesPaymentFilter(payment, filterValue));

  paymentsBody.innerHTML = '';

  filteredPayments.forEach((payment) => {
    const outstanding = Number((payment.totalDue - payment.paidAmount).toFixed(2));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-4">
        <div class="font-semibold text-slate-900">${payment.firstName} ${payment.lastName}</div>
        <div class="text-xs text-slate-500">Loan #${payment.loanId}</div>
      </td>
      <td class="px-4 py-4">${formatCurrency(payment.amount)}</td>
      <td class="px-4 py-4">${new Date(payment.date).toLocaleDateString()}</td>
      <td class="px-4 py-4">${formatCurrency(payment.totalDue)}</td>
      <td class="px-4 py-4">${formatCurrency(outstanding)}</td>
    `;
    paymentsBody.appendChild(row);
  });

  if (!filteredPayments.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No payments match this filter.</td>';
    paymentsBody.appendChild(row);
  }
};

const loadPayments = async () => {
    const response = await fetch('/api/payments');
    const payments = await response.json();
    paymentsBody.innerHTML = '';
  
    payments.forEach((payment) => {
      const outstanding = Number((payment.totalDue - payment.paidAmount).toFixed(2));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="px-4 py-4">${payment.firstName} ${payment.lastName}</td>
        <td class="px-4 py-4">${formatCurrency(payment.amount)}</td>
        <td class="px-4 py-4">${new Date(payment.date).toLocaleDateString()}</td>
        <td class="px-4 py-4">${formatCurrency(payment.totalDue)}</td>
        <td class="px-4 py-4">${formatCurrency(outstanding)}</td>
        `;
      paymentsBody.appendChild(row);
    });
  };
  
  const refreshData = async () => {
    await Promise.all([loadPayments()]);
  };

  refreshData();
