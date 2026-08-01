(() => {
  const content = document.querySelector('#content');
  if (!content) return;

  function protectParitySurface() {
    const root = content.querySelector('[data-velvet-community-parity]');
    if (!root) return;

    content.querySelectorAll('[data-velvet-intelligent-home]:not(.velvet-parity-ownership)')
      .forEach((node) => node.remove());

    if (!root.querySelector('.velvet-parity-ownership')) {
      root.insertAdjacentHTML(
        'afterbegin',
        '<i class="velvet-parity-ownership" data-velvet-intelligent-home hidden></i>'
      );
    }

    if (root.classList.contains('velvet-parity-navigation')) {
      document.querySelectorAll('[data-route].active, [data-route][aria-current="page"]')
        .forEach((node) => {
          node.classList.remove('active');
          node.removeAttribute('aria-current');
        });
      document.querySelectorAll('[data-unified-route="navigation"]').forEach((node) => {
        node.classList.add('active');
        node.setAttribute('aria-current', 'page');
      });
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-route]')) return;
    document.querySelectorAll('[data-unified-route="navigation"]').forEach((node) => {
      node.classList.remove('active');
      node.removeAttribute('aria-current');
    });
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(protectParitySurface));
  observer.observe(content, { childList: true, subtree: true });
  window.setInterval(protectParitySurface, 5000);
  protectParitySurface();
})();