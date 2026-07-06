const loanForm = document.getElementById('loan-form');
const loansTable = document.getElementById('loans-table');
const loansBody = document.getElementById('loans-body');
const messageBox = document.getElementById('message-box');

const showMessage = (text, type = 'info') => {
  messageBox.textContent = text;
  messageBox.className = type === 'error' ? 'error' : 'success';
  setTimeout(() => {
    messageBox.textContent = '';
    messageBox.className = '';
  }, 4000);
};

const formatCurrency = (value) => `R${Number(value).toFixed(2)}`;

// summary removed from landing page; projections live on manage.html
loanForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loanForm);
  const data = {
    firstName: formData.get('firstName').trim(),
    lastName: formData.get('lastName').trim(),
    amountBorrowed: Number(formData.get('amountBorrowed')),
    returnDate: formData.get('returnDate')
  };

  if (!data.firstName || !data.lastName || !data.amountBorrowed || !data.returnDate) {
    showMessage('Please fill all fields correctly.', 'error');
    return;
  }

  const response = await fetch('/api/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    showMessage(error.error || 'Unable to create loan.', 'error');
    return;
  }

  loanForm.reset();
  showMessage('Loan recorded successfully.');
});

if (loansTable) {
  loansTable.addEventListener('click', async (event) => {
    if (event.target.matches('button[data-pay-id]')) {
      const loanId = event.target.dataset.payId;
      const input = event.target.closest('.payment-row').querySelector('input');
      const amount = parseFloat(input.value);
      if (!amount || amount <= 0) {
        showMessage('Enter a valid payment amount.', 'error');
        return;
      }

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
      if (typeof loadLoans === 'function') await loadLoans();
      showMessage('Payment recorded successfully.');
    }
  });
}
