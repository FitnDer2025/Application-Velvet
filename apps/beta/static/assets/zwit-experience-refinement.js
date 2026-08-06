(() => {
  'use strict';

  if (window.__ZWIT_EXPERIENCE_REFINEMENT__) return;
  window.__ZWIT_EXPERIENCE_REFINEMENT__ = true;

  const logoSource = window.ZWIT_BRAND?.assets?.splash || '/assets/zwit-logo-transparent.png?v=20260806-9';
  const words = [
    { word: 'Chut', lang: 'fr' },
    { word: 'Silencio', lang: 'es' },
    { word: 'Silenzio', lang: 'it' },
    { word: '嘘', lang: 'zh' }
  ];
  const wordInterval = 1800;
  const wordDuration = 2850;
  const wordsEnd = ((words.length - 1) * wordInterval) + wordDuration;
  const legacyLogo = /(?:velvet|zwit)[^/?#]*(?:logo|icon|mark)|zwit-logo-1024\.(?:jpg|png|svg|webp)|velvet-icon[^/?#]*/i;

  const style = document.createElement('style');
  style.id = 'zwitExperienceRefinementStyles';
  style.textContent = `
    .zwit-global-brand{
      min-width:0!important;padding:0!important;gap:0!important;border:0!important;
      border-radius:0!important;background:transparent!important;box-shadow:none!important;
      backdrop-filter:none!important;
    }
    .zwit-global-brand img{
      width:92px!important;height:92px!important;object-fit:contain!important;
      object-position:center!important;border-radius:0!important;filter:drop-shadow(0 14px 30px #000a)!important;
    }
    .zwit-global-brand span{display:none!important}
    @media(max-width:720px){.zwit-global-brand img{width:72px!important;height:72px!important}}

    .zwit-opening-v2{visibility:hidden!important}
    .zwit-opening-v3{
      position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;
      overflow:hidden;background:#020203;color:#f5efe9;opacity:0;
      transition:opacity 1s ease;
    }
    .zwit-opening-v3.visible{opacity:1}.zwit-opening-v3.leaving{opacity:0}
    .zwit-opening-v3:before{
      content:"";position:absolute;inset:-16%;background:
      radial-gradient(circle at 50% 44%,#53322355 0,transparent 31%),
      radial-gradient(circle at 50% 50%,#26101b 0,#09090b 47%,#010102 76%);
      transform:scale(1.05);
    }
    .zwit-opening-v3 .zwit-word-stage{position:absolute;inset:0;display:grid;place-items:center;z-index:4}
    .zwit-opening-v3 .zwit-word{
      position:absolute;opacity:0;filter:blur(24px);transform:translateY(14px) scale(.93);
      animation:zwitWordFluid ${wordDuration}ms cubic-bezier(.22,.61,.36,1) both;
      animation-delay:calc(var(--step) * ${wordInterval}ms);
    }
    .zwit-opening-v3 .zwit-word strong{
      display:block;font:500 clamp(58px,12vw,132px)/1 Georgia,serif;letter-spacing:.04em;
      color:#f7f1eb;text-shadow:0 0 52px #d8bd7744;
    }
    .zwit-opening-v3 .zwit-fog{position:absolute;inset:-24%;opacity:0;pointer-events:none;z-index:6}
    .zwit-opening-v3 .zwit-fog i{
      position:absolute;width:70vw;height:70vw;border-radius:50%;
      background:radial-gradient(circle,#f7f0e3c7 0,#cbb99866 27%,transparent 69%);
      filter:blur(48px);mix-blend-mode:screen;
    }
    .zwit-opening-v3 .zwit-fog i:nth-child(1){left:-18%;top:10%}
    .zwit-opening-v3 .zwit-fog i:nth-child(2){right:-20%;top:2%}
    .zwit-opening-v3 .zwit-fog i:nth-child(3){left:14%;bottom:-28%}
    .zwit-opening-v3 .zwit-fog i:nth-child(4){right:10%;bottom:-22%}
    .zwit-opening-v3.fogging .zwit-fog{animation:zwitFogFluid 2.2s ease forwards}
    .zwit-opening-v3 .zwit-logo-environment{
      position:absolute;inset:-8%;z-index:1;opacity:0;overflow:hidden;
      transform:scale(1.1);filter:blur(28px) brightness(.42) saturate(.86);
    }
    .zwit-opening-v3 .zwit-logo-environment img{width:100%;height:100%;object-fit:cover}
    .zwit-opening-v3 .zwit-logo-reveal{
      position:absolute;inset:0;z-index:5;display:grid;place-items:center;opacity:0;
      transform:scale(.94);filter:blur(20px);
    }
    .zwit-opening-v3 .zwit-logo-reveal img{
      width:min(96vw,820px);height:min(92vh,820px);object-fit:contain;object-position:center;
      border-radius:0;box-shadow:none;filter:drop-shadow(0 42px 90px #000c);
    }
    .zwit-opening-v3 .zwit-signature{
      position:absolute;left:0;right:0;bottom:max(28px,env(safe-area-inset-bottom));z-index:8;
      text-align:center;color:#c9beb6;font:500 11px/1.5 Inter,Arial;letter-spacing:.08em;
      opacity:0;transition:opacity 1.1s ease .8s;
    }
    .zwit-opening-v3.revealed .zwit-word-stage{opacity:0;transition:opacity .8s ease}
    .zwit-opening-v3.revealed .zwit-logo-environment{animation:zwitEnvironmentReveal 2s ease forwards}
    .zwit-opening-v3.revealed .zwit-logo-reveal{animation:zwitLogoRevealFluid 2s cubic-bezier(.19,.8,.2,1) forwards}
    .zwit-opening-v3.revealed .zwit-signature{opacity:.78}
    .zwit-opening-v3.reduced .zwit-word{animation:none;opacity:0}
    .zwit-opening-v3.reduced .zwit-word:first-child{opacity:1;filter:none;transform:none}
    .zwit-opening-v3.reduced.revealed .zwit-logo-reveal{animation-duration:.3s}
    @keyframes zwitWordFluid{
      0%,10%{opacity:0;filter:blur(24px);transform:translateY(14px) scale(.93)}
      30%,65%{opacity:1;filter:blur(0);transform:translateY(0) scale(1)}
      90%,100%{opacity:0;filter:blur(22px);transform:translateY(-12px) scale(1.045)}
    }
    @keyframes zwitFogFluid{
      0%{opacity:0;transform:scale(.68) rotate(-8deg)}55%{opacity:1}
      100%{opacity:.88;transform:scale(1.3) rotate(7deg)}
    }
    @keyframes zwitEnvironmentReveal{to{opacity:.72;transform:scale(1);filter:blur(30px) brightness(.38) saturate(.82)}}
    @keyframes zwitLogoRevealFluid{to{opacity:1;transform:scale(1);filter:blur(0)}}
  `;
  document.head.appendChild(style);

  function applyLogo(image) {
    if (!(image instanceof HTMLImageElement)) return;
    if (image.src !== new URL(logoSource, location.href).href) image.src = logoSource;
    image.alt = 'Zwit';
    image.style.background = 'transparent';
    image.style.objectFit = 'contain';
    image.style.objectPosition = 'center';
  }

  function enforceOfficialLogo(root = document) {
    const images = [];
    if (root instanceof HTMLImageElement) images.push(root);
    if (root.querySelectorAll) images.push(...root.querySelectorAll('img'));
    images.forEach((image) => {
      const source = `${image.getAttribute('src') || ''} ${image.currentSrc || ''}`;
      if (legacyLogo.test(source) || image.closest('.zwit-logo-reveal,.zwit-logo-environment')) applyLogo(image);
    });

    document.querySelectorAll('link[rel~="icon"]').forEach((link) => {
      link.href = window.ZWIT_BRAND?.assets?.icon || logoSource;
      link.type = 'image/png';
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
      <div class="zwit-logo-environment" aria-hidden="true"><img src="${logoSource}" alt=""></div>
      <div class="zwit-fog"><i></i><i></i><i></i><i></i></div>
      <div class="zwit-logo-reveal"><img src="${logoSource}" alt="Zwit"></div>
      <div class="zwit-signature">Un secret se partage. Jamais il ne s’impose.</div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));

    const fogAt = reduced ? 1000 : wordsEnd - 650;
    const revealAt = reduced ? 1250 : wordsEnd + 800;
    const leaveAt = reduced ? 2400 : revealAt + 3100;
    setTimeout(() => layer.classList.add('fogging'), fogAt);
    setTimeout(() => layer.classList.add('revealed'), revealAt);
    setTimeout(() => {
      layer.classList.add('leaving');
      setTimeout(() => layer.remove(), 1050);
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
