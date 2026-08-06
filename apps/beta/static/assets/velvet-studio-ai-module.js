(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const API_URL = '/api/control/studio-media';
  const JOB_PREFIX = 'velvet_studio_social_job_v1:';
  const LATEST_JOB_KEY = 'velvet_studio_social_latest_v1';
  const DRAFT_KEY = 'velvet_studio_social_draft_v1';
  const DEFAULT_MEMBER = 'Raconte comment une envie discrète devient progressivement une belle rencontre grâce à Velvet. Montre le véritable accueil Membre, la découverte des profils, une fiche complète, les premiers messages, une sortie et les lieux proches. Le récit doit être sensuel, élégant, chaleureux et émouvant, jamais explicite. Termine par une invitation à rejoindre Velvet.';
  const DEFAULT_PRO = 'Raconte comment un établissement gagne en visibilité, en maîtrise et en sérénité grâce à Zwit Pro. Montre le véritable tableau de bord, la fiche de l’établissement, l’agenda des soirées et le suivi des inscriptions. Le récit doit être premium, humain et convaincant. Termine par une invitation à rejoindre Zwit Pro.';

  const state = {
    busy: false,
    plan: null,
    voices: [],
    selectedVoice: '',
    observerQueued: false,
    draft: readJson(DRAFT_KEY, {
      product: 'member',
      format: '9:16',
      duration: 30,
      brief: DEFAULT_MEMBER
    })
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function uid() {
    return `video_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function installStyles() {
    if (document.querySelector('#velvetStudioSocialStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetStudioSocialStyles';
    style.textContent = `
      .vss-shell{margin:18px 0 30px;border:1px solid rgba(198,169,106,.25);border-radius:26px;overflow:hidden;background:radial-gradient(circle at 100% 0,rgba(124,38,72,.28),transparent 36%),linear-gradient(145deg,#151316,#27151f);box-shadow:0 26px 72px rgba(0,0,0,.28)}
      .vss-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.07)}.vss-brand{display:flex;align-items:center;gap:14px}.vss-mark{display:grid;place-items:center;width:46px;height:46px;border:1px solid rgba(216,189,119,.38);border-radius:15px;background:rgba(216,189,119,.1);color:#d8bd77;font:600 20px Georgia}.vss-brand strong{display:block;color:#f7f3ef;font:600 22px Georgia}.vss-brand span{display:block;margin-top:4px;color:#9b9492;font:500 12px/1.4 Inter,Arial}.vss-links{display:flex;flex-wrap:wrap;gap:8px}.vss-link,.vss-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;padding:11px 15px;text-decoration:none;cursor:pointer;font:800 11px Inter,Arial}.vss-link{border:1px solid rgba(255,255,255,.12);background:#151518;color:#f4efeb}.vss-link.gold{border-color:rgba(216,189,119,.35);color:#d8bd77}.vss-btn{border:0;background:linear-gradient(135deg,#dfc577,#b98a42);color:#171109}.vss-btn.secondary{border:1px solid rgba(255,255,255,.12);background:#171719;color:#f4efeb}.vss-btn:disabled{opacity:.5;cursor:wait}
      .vss-body{padding:22px 24px 24px}.vss-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:18px}.vss-mode{display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:17px;background:rgba(5,5,7,.35);color:#aaa3a0;text-align:left;cursor:pointer}.vss-mode i{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:#ffffff08;color:#d8bd77;font-style:normal}.vss-mode b{display:block;color:#f3eeea;font:700 13px Inter,Arial}.vss-mode small{display:block;margin-top:4px;color:#8d8684;font:500 10px/1.4 Inter,Arial}.vss-mode span{width:12px;height:12px;border:1px solid #777;border-radius:50%}.vss-mode.active{border-color:rgba(216,189,119,.46);background:rgba(125,41,76,.18)}.vss-mode.active span{border:3px solid #d8bd77;background:#2b1720}
      .vss-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(360px,.88fr);gap:16px}.vss-card{padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:19px;background:rgba(7,7,9,.45)}.vss-label{display:block;margin-bottom:8px;color:#d8bd77;font:800 10px Inter,Arial;letter-spacing:.12em;text-transform:uppercase}.vss-card textarea{box-sizing:border-box;width:100%;min-height:160px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#0c0c0e;color:#f5f0ec;outline:none;resize:vertical;font:500 14px/1.55 Inter,Arial}.vss-card textarea:focus{border-color:rgba(216,189,119,.45)}.vss-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.vss-field{display:grid;gap:6px;color:#8e8885;font:800 9px Inter,Arial;letter-spacing:.09em;text-transform:uppercase}.vss-field select{width:100%;padding:11px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#111114;color:#f5f0ec}.vss-voice-row{display:grid;grid-template-columns:1fr auto;gap:9px;margin:12px 0}.vss-message{min-height:17px;margin-top:10px;color:#aaa3a0;font:600 11px/1.45 Inter,Arial}.vss-message.ok{color:#91cba7}.vss-message.error{color:#e59ca6}
      .vss-empty{display:grid;place-items:center;min-height:310px;text-align:center;color:#77716f;font:500 12px/1.65 Inter,Arial}.vss-empty i{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 12px;border-radius:50%;background:rgba(216,189,119,.1);color:#d8bd77;font:500 26px Georgia;font-style:normal}.vss-arc{padding:11px 13px;border-radius:12px;background:rgba(216,189,119,.08);color:#c9c0bc;font:600 11px/1.45 Inter,Arial}.vss-arc b{color:#d8bd77}.vss-scenes{display:grid;gap:8px;max-height:330px;overflow:auto;margin-top:10px;padding-right:3px}.vss-scene{display:grid;grid-template-columns:26px 1fr;gap:10px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:#101012}.vss-scene i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(216,189,119,.12);color:#d8bd77;font:800 10px Inter,Arial;font-style:normal}.vss-scene b{display:block;color:#f1ece8;font:700 12px Inter,Arial}.vss-scene p{margin:4px 0 0;color:#8d8784;font:500 10px/1.45 Inter,Arial}.vss-actions{display:flex;gap:9px;margin-top:13px}.vss-actions>*{flex:1}.vss-status{display:inline-flex;align-items:center;gap:7px;margin-top:10px;color:#8d8784;font:700 10px Inter,Arial}.vss-status:before{content:'';width:7px;height:7px;border-radius:50%;background:#d8bd77}
      .vss-editor{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:14px 22px 0;padding:14px 16px;border:1px solid rgba(198,169,106,.25);border-radius:17px;background:linear-gradient(135deg,#20171c,#4d1b32);color:#f5f0ec}.vss-editor strong{display:block;font:700 14px Inter,Arial}.vss-editor span{display:block;margin-top:4px;color:#aaa3a0;font:500 11px Inter,Arial}.vss-editor-actions{display:flex;flex-wrap:wrap;gap:8px}
      @media(max-width:920px){.vss-grid{grid-template-columns:1fr}.vss-head{align-items:flex-start;flex-direction:column}.vss-links{width:100%}.vss-link{flex:1}.vss-editor{align-items:flex-start;flex-direction:column}.vss-editor-actions{width:100%}.vss-editor-actions>*{flex:1}}@media(max-width:600px){.vss-head,.vss-body{padding-left:15px;padding-right:15px}.vss-mode-grid,.vss-options{grid-template-columns:1fr}.vss-voice-row{grid-template-columns:1fr}.vss-actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function productCopy(product) {
    return product === 'pro'
      ? { title: 'Zwit Pro', icon: 'PRO', brief: DEFAULT_PRO, route: '/marketing-pro/' }
      : { title: 'Zwit Membre', icon: 'V', brief: DEFAULT_MEMBER, route: '/marketing/' };
  }

  function moduleMarkup() {
    const product = state.draft.product === 'pro' ? 'pro' : 'member';
    return `<section class="vss-shell" data-vss-shell>
      <header class="vss-head"><div class="vss-brand"><div class="vss-mark">▶</div><div><strong>Vidéos sociales Zwit</strong><span>Le véritable Zwit en action, une histoire française et une vidéo prête à diffuser.</span></div></div><div class="vss-links"><a class="vss-link gold" href="/marketing/" target="_blank" rel="noopener">↗ Zwit Marketing Membre</a><a class="vss-link gold" href="/marketing-pro/" target="_blank" rel="noopener">↗ Zwit Marketing Pro</a></div></header>
      <div class="vss-body"><div class="vss-mode-grid"><button class="vss-mode ${product === 'member' ? 'active' : ''}" data-vss-product="member"><i>V</i><div><b>Promouvoir Zwit Membre</b><small>Profils, échanges, sorties, lieux et désir de rejoindre la communauté.</small></div><span></span></button><button class="vss-mode ${product === 'pro' ? 'active' : ''}" data-vss-product="pro"><i>PRO</i><div><b>Promouvoir Zwit Pro</b><small>Pilotage, établissement, événements, inscriptions et valeur business.</small></div><span></span></button></div>
      <div class="vss-grid"><section class="vss-card"><label class="vss-label" for="vssBrief">L’histoire à raconter</label><textarea id="vssBrief" data-vss-brief>${esc(state.draft.brief || productCopy(product).brief)}</textarea><div class="vss-options"><label class="vss-field">Format social<select data-vss-format><option value="9:16" ${state.draft.format === '9:16' ? 'selected' : ''}>Vertical 9:16 · Reels / TikTok</option><option value="1:1" ${state.draft.format === '1:1' ? 'selected' : ''}>Carré 1:1 · Publication</option><option value="16:9" ${state.draft.format === '16:9' ? 'selected' : ''}>Paysage 16:9 · Site / YouTube</option></select></label><label class="vss-field">Durée<select data-vss-duration><option value="15" ${Number(state.draft.duration) === 15 ? 'selected' : ''}>15 secondes</option><option value="30" ${Number(state.draft.duration) === 30 ? 'selected' : ''}>30 secondes</option><option value="45" ${Number(state.draft.duration) === 45 ? 'selected' : ''}>45 secondes</option></select></label></div>
      <label class="vss-label">Voix off française</label><div class="vss-voice-row"><label class="vss-field"><select data-vss-voice><option value="">Recherche des voix françaises…</option></select></label><button class="vss-btn secondary" data-vss-test-voice>Écouter la voix</button></div><button class="vss-btn" data-vss-generate>Écrire le scénario</button><div class="vss-message" data-vss-message></div></section><section class="vss-card" data-vss-result>${resultMarkup()}</section></div></div></section>`;
  }

  function resultMarkup() {
    const plan = state.plan;
    if (!plan?.scenes?.length) return '<div class="vss-empty"><div><i>▶</i>Décris la campagne. Le scénario, la narration et les actions à effectuer dans le vrai Zwit apparaîtront ici.</div></div>';
    return `<div class="vss-arc"><b>Arc narratif</b> · ${esc(plan.narrativeArc || 'découverte → émotion → confiance → envie d’agir')}</div><div class="vss-scenes">${plan.scenes.map((scene, index) => `<article class="vss-scene"><i>${index + 1}</i><div><b>${esc(scene.title || `Scène ${index + 1}`)}</b><p>${esc(scene.voice || scene.onScreen || '')}</p></div></article>`).join('')}</div><div class="vss-actions"><button class="vss-btn" data-vss-shoot>Tourner la vidéo</button><button class="vss-btn secondary" data-vss-regenerate>Réécrire</button></div><div class="vss-status">Aucune image générée : le tournage utilise l’environnement Zwit Marketing réel.</div>`;
  }

  function editorMarkup() {
    return `<section class="vss-editor" data-vss-editor><div><strong>Vidéos sociales Zwit</strong><span>Le module reste accessible pendant le montage. Le tournage vidéo se fait dans un onglet dédié.</span></div><div class="vss-editor-actions"><a class="vss-link" href="/marketing/" target="_blank" rel="noopener">Zwit Membre</a><a class="vss-link" href="/marketing-pro/" target="_blank" rel="noopener">Zwit Pro</a><button class="vss-btn" data-vss-back-studio>Créer une vidéo</button></div></section>`;
  }

  function install() {
    installStyles();
    const projectMain = root.querySelector('.vs1-project-main');
    if (projectMain && !root.querySelector('[data-vss-shell]')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = moduleMarkup();
      const hero = projectMain.querySelector('.vs1-hero-card');
      hero ? hero.insertAdjacentElement('afterend', wrap.firstElementChild) : projectMain.prepend(wrap.firstElementChild);
      renderVoices();
    }
    const editor = root.querySelector('.vs1-editor-shell');
    if (editor && !root.querySelector('[data-vss-editor]')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = editorMarkup();
      const toolbar = editor.querySelector('.vs1-editor-toolbar');
      toolbar ? toolbar.insertAdjacentElement('afterend', wrap.firstElementChild) : editor.prepend(wrap.firstElementChild);
    }
  }

  function scheduleInstall() {
    if (state.observerQueued) return;
    state.observerQueued = true;
    requestAnimationFrame(() => {
      state.observerQueued = false;
      install();
    });
  }

  function setMessage(message, tone = '') {
    const node = root.querySelector('[data-vss-message]');
    if (!node) return;
    node.textContent = message;
    node.className = `vss-message ${tone}`.trim();
  }

  function setBusy(busy, label = '') {
    state.busy = busy;
    root.querySelectorAll('[data-vss-generate],[data-vss-shoot],[data-vss-test-voice]').forEach((button) => { button.disabled = busy; });
    const button = root.querySelector('[data-vss-generate]');
    if (button) button.textContent = busy ? (label || 'Préparation…') : 'Écrire le scénario';
  }

  function femaleScore(voice) {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    const female = ['amelie', 'amélie', 'audrey', 'denise', 'marie', 'julie', 'hortense', 'virginie', 'lea', 'léa', 'celine', 'céline', 'female', 'femme'];
    const natural = ['natural', 'premium', 'enhanced', 'online', 'google'];
    return female.reduce((sum, term) => sum + (name.includes(term) ? 20 : 0), 0) + natural.reduce((sum, term) => sum + (name.includes(term) ? 5 : 0), 0) + (voice.localService ? 1 : 3);
  }

  function refreshVoices() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    state.voices = voices.filter((voice) => /^fr(?:-|_)/i.test(voice.lang || '')).sort((a, b) => femaleScore(b) - femaleScore(a));
    if (!state.selectedVoice || !state.voices.some((voice) => voice.voiceURI === state.selectedVoice)) state.selectedVoice = state.voices[0]?.voiceURI || '';
    renderVoices();
  }

  function renderVoices() {
    const select = root.querySelector('[data-vss-voice]');
    if (!select) return;
    if (!state.voices.length) {
      select.innerHTML = '<option value="">Aucune voix française détectée</option>';
      return;
    }
    select.innerHTML = state.voices.map((voice) => `<option value="${esc(voice.voiceURI)}" ${voice.voiceURI === state.selectedVoice ? 'selected' : ''}>${esc(voice.name)} · ${esc(voice.lang)}</option>`).join('');
  }

  function selectedVoice() {
    return state.voices.find((voice) => voice.voiceURI === state.selectedVoice) || state.voices[0] || null;
  }

  function speak(text, preview = false) {
    return new Promise((resolve, reject) => {
      const voice = selectedVoice();
      if (!voice || !window.speechSynthesis) return reject(new Error('Aucune voix française n’est disponible dans ce navigateur.'));
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || 'fr-FR';
      utterance.rate = preview ? 0.94 : 0.9;
      utterance.pitch = 0.96;
      utterance.volume = 1;
      utterance.onend = resolve;
      utterance.onerror = () => reject(new Error('La voix française n’a pas pu être lue.'));
      window.speechSynthesis.speak(utterance);
    });
  }

  function persistDraft() {
    const brief = root.querySelector('[data-vss-brief]')?.value || state.draft.brief;
    const format = root.querySelector('[data-vss-format]')?.value || state.draft.format;
    const duration = Number(root.querySelector('[data-vss-duration]')?.value || state.draft.duration || 30);
    state.draft = { ...state.draft, brief, format, duration };
    writeJson(DRAFT_KEY, state.draft);
  }

  async function api(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40_000);
    try {
      const response = await fetch(API_URL, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({ error: `Erreur ${response.status}` }));
      if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Le scénario met trop de temps à répondre. Réessaie dans quelques instants.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function generatePlan() {
    if (state.busy) return;
    persistDraft();
    if ((state.draft.brief || '').trim().length < 35) return setMessage('Décris plus précisément l’histoire et le résultat attendu.', 'error');
    setBusy(true, 'Écriture en cours…');
    setMessage('Le réalisateur IA écrit une histoire liée aux vrais écrans Zwit…');
    try {
      const payload = await api({ action: 'plan_video', product: state.draft.product, brief: state.draft.brief, format: state.draft.format, duration: state.draft.duration });
      if (!payload.plan?.scenes?.length) throw new Error('Le scénario reçu est incomplet.');
      state.plan = { ...payload.plan, product: state.draft.product, brief: state.draft.brief, format: state.draft.format, duration: state.draft.duration };
      const result = root.querySelector('[data-vss-result]');
      if (result) result.innerHTML = resultMarkup();
      setMessage(`${state.plan.scenes.length} scènes prêtes. Tu peux maintenant lancer le vrai tournage Velvet.`, 'ok');
    } catch (error) {
      setMessage(error.message || 'Le scénario n’a pas pu être généré.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function createJob() {
    persistDraft();
    if (!state.plan?.scenes?.length) throw new Error('Génère d’abord le scénario.');
    const voice = selectedVoice();
    if (!voice) throw new Error('Aucune voix française n’est disponible. Utilise Chrome, Edge ou Safari avec une voix française installée.');
    const id = uid();
    const job = {
      id,
      version: 1,
      createdAt: new Date().toISOString(),
      product: state.draft.product,
      format: state.draft.format,
      duration: state.draft.duration,
      brief: state.draft.brief,
      plan: state.plan,
      voice: { name: voice.name, voiceURI: voice.voiceURI, lang: voice.lang || 'fr-FR', rate: 0.9, pitch: 0.96 }
    };
    writeJson(`${JOB_PREFIX}${id}`, job);
    localStorage.setItem(LATEST_JOB_KEY, id);
    return job;
  }

  function openCapture() {
    try {
      const job = createJob();
      const popup = window.open(`/studio-capture/?job=${encodeURIComponent(job.id)}`, '_blank', 'noopener');
      if (!popup) throw new Error('Autorise l’ouverture du nouvel onglet pour lancer le tournage.');
      setMessage('Le studio de tournage s’est ouvert dans un nouvel onglet.', 'ok');
    } catch (error) {
      setMessage(error.message, 'error');
    }
  }

  function switchProduct(product) {
    persistDraft();
    const previousDefault = state.draft.product === 'pro' ? DEFAULT_PRO : DEFAULT_MEMBER;
    const currentBrief = (state.draft.brief || '').trim();
    state.draft.product = product === 'pro' ? 'pro' : 'member';
    if (!currentBrief || currentBrief === previousDefault) state.draft.brief = productCopy(state.draft.product).brief;
    state.plan = null;
    writeJson(DRAFT_KEY, state.draft);
    root.querySelector('[data-vss-shell]')?.remove();
    install();
  }

  document.addEventListener('click', (event) => {
    const product = event.target.closest('[data-vss-product]');
    if (product) { event.preventDefault(); switchProduct(product.dataset.vssProduct); return; }
    if (event.target.closest('[data-vss-generate],[data-vss-regenerate]')) { event.preventDefault(); generatePlan(); return; }
    if (event.target.closest('[data-vss-shoot]')) { event.preventDefault(); openCapture(); return; }
    if (event.target.closest('[data-vss-test-voice]')) {
      event.preventDefault();
      setBusy(true, 'Lecture…');
      speak(state.draft.product === 'pro' ? 'Zwit Pro. Donnez à votre établissement la visibilité qu’il mérite.' : 'Velvet. Là où les plus belles rencontres commencent.', true)
        .then(() => setMessage('Voix française prête pour le tournage.', 'ok'))
        .catch((error) => setMessage(error.message, 'error'))
        .finally(() => setBusy(false));
      return;
    }
    if (event.target.closest('[data-vss-back-studio]')) {
      event.preventDefault();
      root.querySelector('[data-action="projects"]')?.click();
      scheduleInstall();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-vss-voice]')) state.selectedVoice = event.target.value;
    if (event.target.matches('[data-vss-format],[data-vss-duration]')) persistDraft();
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-vss-brief]')) persistDraft();
  });

  installStyles();
  refreshVoices();
  if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = refreshVoices;
  install();
  const observer = new MutationObserver(scheduleInstall);
  observer.observe(root, { childList: true, subtree: true });
})();
