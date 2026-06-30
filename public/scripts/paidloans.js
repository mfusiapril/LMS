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
        <td>${payment.firstName} ${payment.lastName}</td>
        <td>${formatCurrency(payment.amount)}</td>
        <td>${new Date(payment.date).toLocaleDateString()}</td>
        <td>${formatCurrency(payment.totalDue)}</td>
        <td>${formatCurrency(outstanding)}</td>
      `;
      paymentsBody.appendChild(row);
    });
  };
  
  const refreshData = async () => {
    await Promise.all([loadPayments()]);
  };

  refreshData();