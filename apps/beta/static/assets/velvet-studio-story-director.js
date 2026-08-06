(() => {
  'use strict';

  const SCREEN_BY_LABEL = new Map([
    ['Accueil', 'home'],
    ['Découvrir les membres', 'discover'],
    ['Profil complet', 'profile'],
    ['Messagerie', 'messages'],
    ['Sorties et événements', 'events'],
    ['Carte Zwit', 'map']
  ]);

  const DEFAULT_STORY = 'Raconte comment une envie discrète devient une belle rencontre grâce à Zwit. Commence par le mystère d’une envie que l’on n’ose pas encore nommer. Fais naître l’attirance en découvrant un profil, puis l’émotion en entrant dans son univers. Montre les premiers mots échangés, la confiance qui s’installe et une sortie qui se prépare. Termine par l’envie de rejoindre Zwit. Le ton doit être sensuel, subtil, émouvant et jamais explicite.';

  const state = {
    plan: null,
    currentScreen: '',
    originalFetch: window.fetch.bind(window)
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function installStyles() {
    if (document.querySelector('#velvetStoryDirectorStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetStoryDirectorStyles';
    style.textContent = `
      .vsd-caption{position:absolute;z-index:15;left:50%;bottom:28px;transform:translateX(-50%);width:min(760px,calc(100% - 40px));padding:18px 22px;border:1px solid rgba(198,169,106,.28);border-radius:18px;background:linear-gradient(135deg,rgba(8,8,10,.9),rgba(38,17,28,.88));box-shadow:0 18px 50px rgba(0,0,0,.38);backdrop-filter:blur(18px);text-align:center;opacity:0;transition:opacity .35s ease,transform .35s ease}.vsd-caption.show{opacity:1;transform:translateX(-50%) translateY(-4px)}.vsd-caption small{display:block;margin-bottom:7px;color:#d8bd77;font:800 9px Inter,Arial;letter-spacing:.17em;text-transform:uppercase}.vsd-caption strong{display:block;color:#f8f3ee;font:500 clamp(17px,2.2vw,26px)/1.28 Georgia,serif}.vsd-storyboard{display:grid;gap:8px;margin:14px 0 0}.vsd-beat{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;padding:10px 11px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(7,7,9,.62)}.vsd-beat i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(198,169,106,.14);color:#d8bd77;font:800 10px Inter,Arial;font-style:normal}.vsd-beat b{display:block;color:#eee8e4;font:700 12px Inter,Arial}.vsd-beat span{display:block;margin-top:3px;color:#8f8885;font:500 10px/1.4 Inter,Arial}.vsd-arc{margin-top:14px;padding:12px 14px;border-radius:13px;background:rgba(198,169,106,.08);color:#cbbdba;font:600 11px/1.5 Inter,Arial}.vsd-arc em{color:#d8bd77;font-style:normal}.vsr-home .vsr-proof span:last-child{display:none}
    `;
    document.head.appendChild(style);
  }

  async function capturePlanResponse(response) {
    try {
      const payload = await response.clone().json();
      if (payload?.plan?.mode === 'story-led-product-demo' && Array.isArray(payload.plan.scenes)) {
        state.plan = payload.plan;
        renderStoryboard(payload.plan);
      }
    } catch {
      // Une réponse non JSON ne concerne pas le scénario.
    }
  }

  window.fetch = async (input, init = {}) => {
    const response = await state.originalFetch(input, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input?.url || '', location.origin);
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      if (url.pathname === '/api/control/studio-media' && body?.action === 'plan_video') {
        capturePlanResponse(response);
      }
    } catch {
      // Le fetch d’origine reste toujours prioritaire.
    }
    return response;
  };

  function renderStoryboard(plan) {
    const modal = document.querySelector('[data-vsr-modal]');
    const prompt = modal?.querySelector('[data-vsr-prompt]');
    if (!prompt) return;
    let host = modal.querySelector('[data-vsd-storyboard]');
    if (!host) {
      host = document.createElement('div');
      host.dataset.vsdStoryboard = '';
      prompt.insertAdjacentElement('afterend', host);
    }
    host.innerHTML = `<div class="vsd-arc"><em>Arc narratif</em> · ${escapeHtml(plan.narrativeArc || 'mystère → attirance → émotion → connexion → projection')}</div><div class="vsd-storyboard">${plan.scenes.map((scene, index) => `<div class="vsd-beat"><i>${index + 1}</i><div><b>${escapeHtml(scene.title)}</b><span>${escapeHtml(scene.onScreen || scene.emotion || '')}</span></div></div>`).join('')}</div>`;
  }

  function storyForScreen(screen) {
    return state.plan?.scenes?.find((scene) => scene.screen === screen) || null;
  }

  function ensureCaption(frame) {
    let caption = frame.querySelector('[data-vsd-caption]');
    if (!caption) {
      caption = document.createElement('div');
      caption.className = 'vsd-caption';
      caption.dataset.vsdCaption = '';
      frame.appendChild(caption);
    }
    return caption;
  }

  function showStoryBeat(frame, screen) {
    const scene = storyForScreen(screen);
    if (!scene) return;
    const caption = ensureCaption(frame);
    caption.innerHTML = `<small>${escapeHtml(scene.emotion || 'Zwit')}</small><strong>${escapeHtml(scene.onScreen || scene.title)}</strong>`;
    caption.classList.remove('show');
    requestAnimationFrame(() => caption.classList.add('show'));
    const tag = frame.querySelector('[data-vsr-scene]');
    if (tag && tag.textContent !== scene.title) tag.textContent = scene.title;
  }

  function watchStage(stage) {
    if (stage.dataset.vsdWatched === '1') return;
    stage.dataset.vsdWatched = '1';
    const frame = stage.querySelector('[data-vsr-live-frame]');
    const tag = frame?.querySelector('[data-vsr-scene]');
    if (!frame || !tag) return;

    const update = () => {
      const label = tag.textContent.trim();
      const screen = SCREEN_BY_LABEL.get(label) || state.plan?.scenes?.find((scene) => scene.title === label)?.screen;
      if (!screen || screen === state.currentScreen) return;
      state.currentScreen = screen;
      showStoryBeat(frame, screen);
    };
    new MutationObserver(update).observe(tag, { childList: true, characterData: true, subtree: true });
    update();
  }

  function refreshInterface() {
    const homePrompt = document.querySelector('[data-vsr-home]');
    if (homePrompt && !homePrompt.dataset.vsdReady) {
      homePrompt.dataset.vsdReady = '1';
      homePrompt.value = DEFAULT_STORY;
    }
    const modalPrompt = document.querySelector('[data-vsr-prompt]');
    if (modalPrompt && !modalPrompt.dataset.vsdReady) {
      modalPrompt.dataset.vsdReady = '1';
      if (!modalPrompt.value || modalPrompt.value.includes('Présente Zwit comme une expérience premium')) modalPrompt.value = DEFAULT_STORY;
    }
    const heading = document.querySelector('.vsr-home h1');
    if (heading) heading.innerHTML = 'Une envie.<br>Une histoire. Velvet.';
    const intro = document.querySelector('.vsr-home > p');
    if (intro) intro.textContent = 'Décrivez l’émotion à transmettre. Le scénario raconte une histoire et dirige la navigation dans le véritable espace Membres Velvet.';
    document.querySelectorAll('[data-vsr-stage]').forEach(watchStage);
  }

  installStyles();
  new MutationObserver(refreshInterface).observe(document.documentElement, { childList: true, subtree: true });
  refreshInterface();
})();
