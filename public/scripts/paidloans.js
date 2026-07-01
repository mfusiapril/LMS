const paymentsBody = document.getElementById('payments-body');
const formatCurrency = (value) => `R${Number(value).toFixed(2)}`;

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