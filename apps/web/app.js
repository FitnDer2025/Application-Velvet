const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');
const form = document.querySelector('#invite-form');
const formNote = document.querySelector('#form-note');

const closeMenu = () => {
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('open');
  document.body.classList.remove('menu-open');
};

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('open', !isOpen);
  document.body.classList.toggle('menu-open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -30px' });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();

  if (!email) return;

  formNote.textContent = 'Votre demande a bien été enregistrée. Bienvenue aux portes de Velvet.';
  formNote.classList.add('success');
  form.reset();
});
