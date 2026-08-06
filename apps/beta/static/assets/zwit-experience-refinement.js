(() => {
  'use strict';

  if (window.__ZWIT_EXPERIENCE_REFINEMENT__) return;
  window.__ZWIT_EXPERIENCE_REFINEMENT__ = true;

  const logoSource = '/assets/zwit-logo-1024.png?v=20260806-3';
  const words = [
    { word: 'Chut', lang: 'fr' },
    { word: 'Silencio', lang: 'es' },
    { word: 'Silenzio', lang: 'it' },
    { word: '嘘', lang: 'zh' }
  ];
  const wordInterval = 1450;
  const wordDuration = 2150;
  const wordsEnd = ((words.length - 1) * wordInterval) + wordDuration;

  const style = document.createElement('style');
  style.id = 'zwitExperienceRefinementStyles';
  style.textContent = `
    .zwit-global-brand{
      min-width:0!important;
      padding:5px!important;
      gap:0!important;
      border-radius:18px!important;
      background:#08080ab8!important;
    }
    .zwit-global-brand img{
      width:64px!important;
      height:64px!important;
      object-fit:contain!important;
      object-position:center!important;
      border-radius:15px!important;
    }
    .zwit-global-brand span{display:none!important}
    @media(max-width:720px){
      .zwit-global-brand{padding:3px!important;border-radius:15px!important}
      .zwit-global-brand img{width:52px!important;height:52px!important;border-radius:13px!important}
    }
    .zwit-opening-v3{
      position:fixed;
      z-index:2147483647;
      inset:0;
      display:grid;
      place-items:center;
      overflow:hidden;
      background:radial-gradient(circle at 50% 45%,#30131f 0,#0c0b0e 45%,#020203 100%);
      color:#f5efe9;
      opacity:0;
      transition:opacity .8s ease;
    }
    .zwit-opening-v3.visible{opacity:1}
    .zwit-opening-v3.leaving{opacity:0}
    .zwit-opening-v3 .zwit-word-stage{position:absolute;inset:0;display:grid;place-items:center}
    .zwit-opening-v3 .zwit-word{
      position:absolute;
      opacity:0;
      filter:blur(18px);
      transform:translateY(10px) scale(.94);
      animation:zwitWordFluid ${wordDuration}ms cubic-bezier(.22,.61,.36,1) both;
      animation-delay:calc(var(--step) * ${wordInterval}ms);
    }
    .zwit-opening-v3 .zwit-word strong{
      display:block;
      font:500 clamp(56px,12vw,126px)/1 Georgia,serif;
      letter-spacing:.04em;
      color:#f5efe9;
      text-shadow:0 0 44px #c6a96a26;
    }
    .zwit-opening-v3 .zwit-fog{position:absolute;inset:-20%;opacity:0;pointer-events:none}
    .zwit-opening-v3 .zwit-fog i{position:absolute;width:65vw;height:65vw;border-radius:50%;background:radial-gradient(circle,#f6efe2aa 0,#b8a78c55 28%,transparent 68%);filter:blur(38px);mix-blend-mode:screen}
    .zwit-opening-v3 .zwit-fog i:nth-child(1){left:-15%;top:12%}
    .zwit-opening-v3 .zwit-fog i:nth-child(2){right:-18%;top:5%}
    .zwit-opening-v3 .zwit-fog i:nth-child(3){left:18%;bottom:-25%}
    .zwit-opening-v3 .zwit-fog i:nth-child(4){right:12%;bottom:-18%}
    .zwit-opening-v3.fogging .zwit-fog{animation:zwitFogFluid 1.65s ease forwards}
    .zwit-opening-v3 .zwit-logo-reveal{position:relative;display:grid;justify-items:center;gap:14px;opacity:0;transform:scale(.88);filter:blur(20px)}
    .zwit-opening-v3 .zwit-logo-reveal img{width:min(72vw,360px);aspect-ratio:1;object-fit:contain;border-radius:34px;box-shadow:0 38px 110px #000}
    .zwit-opening-v3 .zwit-logo-reveal small{max-width:340px;text-align:center;color:#c5bbb5;font:500 12px/1.55 Inter,Arial;letter-spacing:.05em}
    .zwit-opening-v3.revealed .zwit-word-stage{opacity:0;transition:opacity .6s ease}
    .zwit-opening-v3.revealed .zwit-logo-reveal{animation:zwitLogoRevealFluid 1.45s cubic-bezier(.19,.8,.2,1) forwards}
    .zwit-opening-v3.reduced .zwit-word{animation:none;opacity:0}
    .zwit-opening-v3.reduced .zwit-word:first-child{opacity:1;filter:none;transform:none}
    .zwit-opening-v3.reduced.revealed .zwit-logo-reveal{animation-duration:.25s}
    @keyframes zwitWordFluid{
      0%,12%{opacity:0;filter:blur(18px);transform:translateY(10px) scale(.94)}
      32%,68%{opacity:1;filter:blur(0);transform:translateY(0) scale(1)}
      88%,100%{opacity:0;filter:blur(16px);transform:translateY(-8px) scale(1.04)}
    }
    @keyframes zwitFogFluid{
      0%{opacity:0;transform:scale(.72) rotate(-8deg)}
      55%{opacity:1}
      100%{opacity:.82;transform:scale(1.25) rotate(7deg)}
    }
    @keyframes zwitLogoRevealFluid{to{opacity:1;transform:scale(1);filter:blur(0)}}
  `;
  document.head.appendChild(style);

  function enforceOfficialLogo(root = document) {
    const brands = [];
    if (root instanceof Element && root.matches('[data-zwit-global-brand]')) brands.push(root);
    if (root.querySelectorAll) brands.push(...root.querySelectorAll('[data-zwit-global-brand]'));

    brands.forEach((brand) => {
      const image = brand.querySelector('img');
      if (image) {
        image.src = logoSource;
        image.alt = 'Zwit';
      }
      brand.querySelectorAll('span').forEach((label) => label.remove());
    });

    const logos = [];
    if (root instanceof HTMLImageElement && /zwit-logo-1024\.png/i.test(root.src)) logos.push(root);
    if (root.querySelectorAll) logos.push(...root.querySelectorAll('img[src*="zwit-logo-1024.png"]'));
    logos.forEach((image) => {
      image.src = logoSource;
      image.style.objectFit = 'contain';
      image.style.objectPosition = 'center';
    });
  }

  function replaceOpening() {
    const previous = document.querySelector('.zwit-opening-v2');
    if (!previous || document.querySelector('.zwit-opening-v3')) return;

    previous.remove();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = document.createElement('div');
    layer.className = `zwit-opening-v3${reduced ? ' reduced' : ''}`;
    layer.innerHTML = `
      <div class="zwit-word-stage" aria-live="polite">
        ${words.map((entry, index) => `<div class="zwit-word" style="--step:${index}" lang="${entry.lang}" aria-label="${entry.word}"><strong>${entry.word}</strong></div>`).join('')}
      </div>
      <div class="zwit-fog"><i></i><i></i><i></i><i></i></div>
      <div class="zwit-logo-reveal"><img src="${logoSource}" alt="Zwit"><small>Un secret se partage. Jamais il ne s’impose.</small></div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));

    const fogAt = reduced ? 900 : wordsEnd - 250;
    const revealAt = reduced ? 1050 : wordsEnd + 450;
    const leaveAt = reduced ? 1900 : revealAt + 2450;
    setTimeout(() => layer.classList.add('fogging'), fogAt);
    setTimeout(() => layer.classList.add('revealed'), revealAt);
    setTimeout(() => {
      layer.classList.add('leaving');
      setTimeout(() => layer.remove(), 900);
    }, leaveAt);
  }

  enforceOfficialLogo();
  replaceOpening();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      enforceOfficialLogo(node);
      if (node.matches('.zwit-opening-v2') || node.querySelector('.zwit-opening-v2')) replaceOpening();
    }));
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });
})();
