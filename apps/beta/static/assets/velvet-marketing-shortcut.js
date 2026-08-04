(() => {
  'use strict';
  const root = document.querySelector('#controlApp');
  if (!root) return;

  function install() {
    const home = root.querySelector('.vsl-home');
    if (!home || home.querySelector('[data-open-marketing-beta]')) return false;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:18px';
    actions.innerHTML = '<a data-open-marketing-beta href="/marketing/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.06);color:#f5f1ed;text-decoration:none;font:750 12px Inter,Arial">↗ Ouvrir la BETA Marketing</a><span style="align-self:center;color:rgba(255,255,255,.48);font:500 11px Inter,Arial">Vrais écrans Velvet · profils fictifs · environnement isolé</span>';
    home.appendChild(actions);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts > 100) clearInterval(timer);
  }, 100);
  install();
})();
