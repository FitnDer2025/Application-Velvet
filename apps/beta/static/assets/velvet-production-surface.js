(() => {
  'use strict';

  if (window.__VELVET_PRODUCTION_SURFACE__) return;
  window.__VELVET_PRODUCTION_SURFACE__ = true;

  const path = window.location.pathname;
  const title = path.startsWith('/control')
    ? 'Zwit Contrôle'
    : path.startsWith('/pro') || path.startsWith('/marketing-pro')
      ? 'Zwit Pro'
      : path.startsWith('/studio-capture')
        ? 'Zwit Studio'
        : path.startsWith('/membres') || path.startsWith('/marketing')
          ? 'Zwit Membres'
          : 'Zwit — Connexion';

  const exact = new Map([
    ['Zwit Membres — BETA privée', 'Zwit Membres'],
    ['Zwit — BETA Marketing', 'Zwit Membres'],
    ['Zwit Pro — BETA Marketing', 'Zwit Pro'],
    ['Zwit BETA — Conditions', 'Zwit — Conditions d’utilisation'],
    ['Zwit BETA — Confidentialité', 'Zwit — Confidentialité'],
    ['Zwit BETA — Sécurité', 'Zwit — Sécurité'],
    ['BETA PRIVÉE · 18+', 'ACCÈS PRIVÉ · 18+'],
    ['BETA privée', 'Accès privé'],
    ['BETA Marketing', 'Zwit'],
    ['BETA MARKETING', 'ZWIT'],
    ['PRO MARKETING', 'PRO'],
    ['Données réelles · À jour', 'Synchronisation active'],
    ['Données réelles · Configuration partielle', 'Synchronisation partielle'],
    ['Données réelles Supabase', 'Synchronisation sécurisée'],
    ['Données fictives · environnement marketing', 'Espace professionnel'],
    ['Accès BETA', 'Accès Zwit'],
    ['Conditions BETA', 'Conditions d’utilisation'],
    ['J’accepte les conditions de la BETA.', 'J’accepte les conditions d’utilisation de Zwit.'],
    ['Les quatre validations sont obligatoires pour cette BETA.', 'Les quatre validations sont obligatoires pour activer ton accès.'],
    ['Accès réservé aux personnes invitées à tester les quatre univers Zwit.', 'Accès réservé aux personnes disposant d’une invitation Zwit.'],
    ['Cet environnement de démonstration est réservé à Zwit Control.', 'Cet espace est réservé aux comptes autorisés.'],
    ['BETA MARKETING · DONNÉES FICTIVES', ''],
    ['BETA MARKETING PRO · DONNÉES FICTIVES', ''],
    ['Zwit Marketing Membre', 'Aperçu Zwit Membre'],
    ['Zwit Marketing Pro', 'Aperçu Zwit Pro'],
    ['Ouvrir Zwit Marketing', 'Ouvrir l’aperçu Zwit'],
    ['Agents de test', 'Agents qualité'],
    ['Agent de test', 'Agent qualité'],
    ['Tests automatisés', 'Contrôles automatisés'],
    ['Test automatisé', 'Contrôle automatisé']
  ]);

  const phraseRules = [
    [/\bBETA PRIVÉE\b/gi, 'ACCÈS PRIVÉ'],
    [/\bBETA MARKETING PRO\b/gi, 'ZWIT PRO'],
    [/\bBETA MARKETING\b/gi, 'ZWIT'],
    [/\bBETA fermée\b/gi, 'Zwit'],
    [/\bAccès BETA\b/gi, 'Accès Zwit'],
    [/\bconditions de la BETA\b/gi, 'conditions d’utilisation de Zwit'],
    [/\bdonnées réelles\b/gi, 'données synchronisées'],
    [/\bdonnées fictives\b/gi, 'contenus de présentation'],
    [/\benvironnement de démonstration\b/gi, 'espace sécurisé'],
    [/\benvironnement marketing\b/gi, 'espace Zwit'],
    [/\bversion de test\b/gi, 'version actuelle'],
    [/\bprofil test\b/gi, 'profil qualité'],
    [/\bprofils test\b/gi, 'profils qualité'],
    [/\bVELVETPRO\b/g, 'ZWITPRO'],
    [/\bVelvetPro\b/g, 'ZwitPro'],
    [/\bvelvetpro\b/g, 'zwitpro'],
    [/\bVELVET\b/g, 'ZWIT'],
    [/\bVelvet\b/g, 'Zwit'],
    [/\bvelvet\b/g, 'zwit']
  ];

  const removableSelectors = [
    '#velvetMarketingBadge',
    '#velvetMarketingProBadge',
    '[data-beta-badge]',
    '[data-demo-badge]',
    '.beta-badge',
    '.demo-badge'
  ];

  function normalized(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function replaceCopy(value) {
    const source = String(value || '');
    const trimmed = normalized(source);
    if (!trimmed) return source;
    if (exact.has(trimmed)) return source.replace(trimmed, exact.get(trimmed));
    return phraseRules.reduce((copy, [pattern, replacement]) => copy.replace(pattern, replacement), source);
  }

  function cleanControlValue(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
    const current = element.value;
    const next = replaceCopy(current);
    if (next === current) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    element.value = next;
    if (Number.isInteger(start) && Number.isInteger(end)) {
      try { element.setSelectionRange(start, end); } catch {}
    }
  }

  function cleanElement(element) {
    if (!(element instanceof Element)) return;
    for (const attribute of ['title', 'aria-label', 'placeholder', 'alt', 'value']) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const next = replaceCopy(current);
      if (next !== current) element.setAttribute(attribute, next);
    }
    cleanControlValue(element);
  }

  function cleanTextNode(node) {
    if (!(node instanceof Text)) return;
    if (node.parentElement?.closest('script,style,code,pre,textarea')) return;
    const next = replaceCopy(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function clean(root = document) {
    document.title = title;
    removableSelectors.forEach((selector) => document.querySelectorAll(selector).forEach((node) => node.remove()));

    if (root instanceof Text) {
      cleanTextNode(root);
      return;
    }
    if (root instanceof Element) cleanElement(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current = walker.currentNode;
    while (current) {
      if (current instanceof Text) cleanTextNode(current);
      else cleanElement(current);
      current = walker.nextNode();
    }
  }

  function installCanvasBrandGuard() {
    const prototype = window.CanvasRenderingContext2D?.prototype;
    if (!prototype || prototype.__zwitBrandGuard) return;
    const fillText = prototype.fillText;
    const strokeText = prototype.strokeText;
    prototype.fillText = function guardedFillText(text, ...args) {
      return fillText.call(this, replaceCopy(text), ...args);
    };
    prototype.strokeText = function guardedStrokeText(text, ...args) {
      return strokeText.call(this, replaceCopy(text), ...args);
    };
    Object.defineProperty(prototype, '__zwitBrandGuard', { value: true });
  }

  function installSpeechBrandGuard() {
    const NativeUtterance = window.SpeechSynthesisUtterance;
    if (!NativeUtterance || window.__ZWIT_SPEECH_BRAND_GUARD__) return;
    const ZwitUtterance = function ZwitUtterance(text = '') {
      return new NativeUtterance(replaceCopy(text));
    };
    ZwitUtterance.prototype = NativeUtterance.prototype;
    Object.setPrototypeOf(ZwitUtterance, NativeUtterance);
    window.SpeechSynthesisUtterance = ZwitUtterance;
    window.__ZWIT_SPEECH_BRAND_GUARD__ = true;
  }

  const style = document.createElement('style');
  style.id = 'velvetProductionSurfaceStyles';
  style.textContent = `
    #velvetMarketingBadge,
    #velvetMarketingProBadge,
    [data-beta-badge],
    [data-demo-badge],
    .beta-badge,
    .demo-badge{display:none!important}
  `;
  document.head.appendChild(style);

  installCanvasBrandGuard();
  installSpeechBrandGuard();

  let queued = false;
  const observer = new MutationObserver((mutations) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => clean(node));
        if (mutation.type === 'characterData') cleanTextNode(mutation.target);
      });
      document.title = title;
    });
  });

  clean(document);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener('focusin', (event) => cleanElement(event.target), true);
  document.addEventListener('submit', (event) => clean(event.target), true);
  window.addEventListener('pageshow', () => clean(document));
  [0, 250, 1000].forEach((delay) => setTimeout(() => clean(document), delay));
  if (!document.querySelector('script[data-zwit-experience]')) {
    const experience = document.createElement('script');
    experience.src = '/assets/zwit-experience.js?v=20260806-1';
    experience.dataset.zwitExperience = 'true';
    document.head.appendChild(experience);
  }
})();
