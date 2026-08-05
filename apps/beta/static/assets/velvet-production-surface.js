(() => {
  'use strict';

  if (window.__VELVET_PRODUCTION_SURFACE__) return;
  window.__VELVET_PRODUCTION_SURFACE__ = true;

  const path = window.location.pathname;
  const title = path.startsWith('/control')
    ? 'Velvet Contrôle'
    : path.startsWith('/pro') || path.startsWith('/marketing-pro')
      ? 'Velvet Pro'
      : path.startsWith('/studio-capture')
        ? 'Velvet Studio'
        : path.startsWith('/membres') || path.startsWith('/marketing')
          ? 'Velvet Membres'
          : 'Velvet — Connexion';

  const exact = new Map([
    ['Velvet Membres — BETA privée', 'Velvet Membres'],
    ['Velvet — BETA Marketing', 'Velvet Membres'],
    ['Velvet Pro — BETA Marketing', 'Velvet Pro'],
    ['Velvet BETA — Conditions', 'Velvet — Conditions d’utilisation'],
    ['Velvet BETA — Confidentialité', 'Velvet — Confidentialité'],
    ['Velvet BETA — Sécurité', 'Velvet — Sécurité'],
    ['BETA PRIVÉE · 18+', 'ACCÈS PRIVÉ · 18+'],
    ['BETA privée', 'Accès privé'],
    ['BETA Marketing', 'Velvet'],
    ['BETA MARKETING', 'VELVET'],
    ['PRO MARKETING', 'PRO'],
    ['Données réelles · À jour', 'Synchronisation active'],
    ['Données réelles · Configuration partielle', 'Synchronisation partielle'],
    ['Données réelles Supabase', 'Synchronisation sécurisée'],
    ['Données fictives · environnement marketing', 'Espace professionnel'],
    ['Accès BETA', 'Accès Velvet'],
    ['Conditions BETA', 'Conditions d’utilisation'],
    ['J’accepte les conditions de la BETA.', 'J’accepte les conditions d’utilisation de Velvet.'],
    ['Les quatre validations sont obligatoires pour cette BETA.', 'Les quatre validations sont obligatoires pour activer ton accès.'],
    ['Accès réservé aux personnes invitées à tester les quatre univers Velvet.', 'Accès réservé aux personnes disposant d’une invitation Velvet.'],
    ['Cet environnement de démonstration est réservé à Velvet Control.', 'Cet espace est réservé aux comptes autorisés.'],
    ['BETA MARKETING · DONNÉES FICTIVES', ''],
    ['BETA MARKETING PRO · DONNÉES FICTIVES', ''],
    ['Velvet Marketing Membre', 'Aperçu Velvet Membre'],
    ['Velvet Marketing Pro', 'Aperçu Velvet Pro'],
    ['Ouvrir Velvet Marketing', 'Ouvrir l’aperçu Velvet'],
    ['Agents de test', 'Agents qualité'],
    ['Agent de test', 'Agent qualité'],
    ['Tests automatisés', 'Contrôles automatisés'],
    ['Test automatisé', 'Contrôle automatisé']
  ]);

  const phraseRules = [
    [/\bBETA PRIVÉE\b/gi, 'ACCÈS PRIVÉ'],
    [/\bBETA MARKETING PRO\b/gi, 'VELVET PRO'],
    [/\bBETA MARKETING\b/gi, 'VELVET'],
    [/\bBETA fermée\b/gi, 'Velvet'],
    [/\bAccès BETA\b/gi, 'Accès Velvet'],
    [/\bconditions de la BETA\b/gi, 'conditions d’utilisation de Velvet'],
    [/\bdonnées réelles\b/gi, 'données synchronisées'],
    [/\bdonnées fictives\b/gi, 'contenus de présentation'],
    [/\benvironnement de démonstration\b/gi, 'espace sécurisé'],
    [/\benvironnement marketing\b/gi, 'espace Velvet'],
    [/\bversion de test\b/gi, 'version actuelle'],
    [/\bprofil test\b/gi, 'profil qualité'],
    [/\bprofils test\b/gi, 'profils qualité']
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

  function isPresentationBadge(element) {
    if (!(element instanceof HTMLElement)) return false;
    const copy = normalized(element.textContent).toLowerCase();
    if (!copy || copy.length > 90) return false;
    const badgeLike = /badge|status|pill|chip|tag|eyebrow|kicker/i.test(element.className || '')
      || /badge|status/i.test(element.id || '')
      || ['SPAN', 'SMALL'].includes(element.tagName);
    return badgeLike && (
      copy.includes('bêta')
      || copy.includes('beta')
      || copy.includes('données fictives')
      || copy.includes('environnement marketing')
    );
  }

  function cleanElement(element) {
    if (!(element instanceof Element)) return;
    if (isPresentationBadge(element)) {
      element.remove();
      return;
    }
    for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const next = replaceCopy(current);
      if (next !== current) element.setAttribute(attribute, next);
    }
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
  window.addEventListener('pageshow', () => clean(document));
})();
