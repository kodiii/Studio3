// Save-for-later on product cards.
document.querySelectorAll('.card-save').forEach((button) => {
  button.addEventListener('click', () => {
    const saved = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!saved));
    button.textContent = saved ? 'Save' : 'Saved';
  });
});
