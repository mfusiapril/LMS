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
  filterDate.addEventListener('change', () => {
    const selected = filterDate.value; // yyyy-mm-dd

    document.querySelectorAll('#manage-loans-body tr').forEach(row => {
      const dueText = row.querySelector('td div.text-xs')?.textContent?.trim(); // "Due 30/07/2026"
      
      if (!dueText) return;

      const match = dueText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return;

      const rowDate = `${match[3]}-${match[2]}-${match[1]}`; // convert to yyyy-mm-dd
      row.classList.toggle('hidden', !!selected && rowDate !== selected);
    });
  });
}