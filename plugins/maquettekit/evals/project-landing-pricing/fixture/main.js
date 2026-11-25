// Mobile navigation toggle.
const toggle = document.getElementById('nav-toggle');
const nav = document.getElementById('site-nav');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.toggleAttribute('data-open', open);
});
