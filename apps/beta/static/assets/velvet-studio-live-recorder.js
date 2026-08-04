(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const ROUTES = {
    home: { label: 'Accueil', selector: '[data-route="home"]' },
    discover: { label: 'Découvrir les membres', selector: '[data-route="discover"]' },
    profile: { label: 'Profil complet', selector: '[data-route="discover"]' },
    messages: { label: 'Messagerie', selector: '[data-route="conversations"]' },
    events: { label: 'Sorties et événements', selector: '[data-route="events"]' },
    map: { label: 'Carte Velvet', selector: '[data-route="maps"]' }
  };

  const DEFAULT_BRIEF = 'Présente Velvet comme une expérience premium qui réunit des profils complets, des échanges de confiance, des sorties et des établissements. Montre l’accueil, la découverte des membres, une fiche complète, la messagerie, les événements et la carte. Termine par une invitation élégante à rejoindre Velvet.';

  const state = {
    running: false,
    cancelled: false,
    displayStream: null,
    outputUrl: null,
    audioContext: null,
    sources: [],
    paintFrame: 0
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  function installStyles() {
    if (document.querySelector('#velvetStudioLiveStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetStudioLiveStyles';
    style.textContent = `
      .vsr-home{padding:46px;border:1px solid rgba(198,169,106,.25);border-radius:30px;background:radial-gradient(circle at 88% 0,rgba(198,169,106,.18),transparent 30%),linear-gradient(135deg,#111114,#29151f 58%,#561b35);box-shadow:0 34px 90px rgba(0,0,0,.36)}
      .vsr-kicker{color:#d8bd77;font:800 11px/1.2 Inter,Arial;letter-spacing:.18em;text-transform:uppercase}.vsr-home h1{margin:12px 0 15px;max-width:900px;color:#f8f5f1;font:500 clamp(42px,5.6vw,76px)/.98 Georgia,serif;letter-spacing:-.045em}.vsr-home>p{max-width:790px;margin:0 0 26px;color:rgba(248,245,241,.72);font:500 17px/1.65 Inter,Arial}
      .vsr-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:rgba(5,5,8,.62);backdrop-filter:blur(18px)}.vsr-compose textarea{min-height:122px;padding:15px!important;border:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;outline:none!important;resize:vertical;font:500 16px/1.55 Inter,Arial!important}.vsr-create{min-width:250px;border:0;border-radius:18px;background:linear-gradient(135deg,#e0c77f,#b78a42);color:#17120b;padding:18px 22px;cursor:pointer;font:850 15px Inter,Arial;box-shadow:0 16px 38px rgba(198,169,106,.22)}.vsr-create small{display:block;margin-top:6px;font-size:10px;opacity:.7}.vsr-proof{display:flex;flex-wrap:wrap;gap:18px;margin-top:18px;color:rgba(255,255,255,.58);font:700 12px Inter,Arial}.vsr-proof span:before{content:'✓';margin-right:7px;color:#d8bd77}
      .vsr-modal{position:fixed;inset:0;z-index:110000;display:grid;place-items:center;padding:14px;background:rgba(3,3,5,.9);backdrop-filter:blur(18px)}.vsr-panel{width:min(1180px,100%);height:min(850px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#0d0d0f;color:#f7f4f0;box-shadow:0 44px 130px #000}.vsr-head{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,13,15,.95);backdrop-filter:blur(14px)}.vsr-head strong{font:600 21px Georgia,serif}.vsr-head span{display:block;margin-top:4px;color:#918b89;font-size:12px}.vsr-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#17171a;color:#fff;cursor:pointer;font-size:22px}.vsr-grid{display:grid;grid-template-columns:minmax(340px,.72fr) minmax(520px,1.28fr);gap:22px;padding:24px}.vsr-card{padding:22px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:#121214}.vsr-card h2{margin:8px 0 10px;font:500 32px/1.05 Georgia,serif}.vsr-muted{color:#96908d;font:500 13px/1.55 Inter,Arial}.vsr-card textarea{box-sizing:border-box;width:100%;min-height:170px;margin:18px 0 14px;padding:15px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#0b0b0d;color:#fff;resize:vertical;font:500 15px/1.55 Inter,Arial}.vsr-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.vsr-options label{display:grid;gap:7px;color:#aaa4a1;font:800 11px Inter,Arial;letter-spacing:.08em;text-transform:uppercase}.vsr-options select{padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:#0b0b0d;color:#fff}.vsr-run{width:100%;padding:16px;border:0;border-radius:15px;background:linear-gradient(135deg,#d9bd72,#b88c43);color:#17120b;cursor:pointer;font-weight:900}.vsr-run:disabled{opacity:.58;cursor:wait}.vsr-help{margin:12px 0 0;color:#77716f;font-size:11px;line-height:1.5}.vsr-progress{display:grid;gap:9px;margin-top:18px}.vsr-step{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid rgba(255,255,255,.06);border-radius:13px;background:#0b0b0d;color:#777}.vsr-step i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#18181b;font-style:normal;font-size:11px}.vsr-step.active{border-color:rgba(198,169,106,.4);color:#fff}.vsr-step.active i{background:#c6a96a;color:#111}.vsr-step.done{color:#bbb4b0}.vsr-step.done i{background:#365a48;color:#dff8e8}.vsr-step small{font-size:10px}
      .vsr-preview{position:relative;display:grid;place-items:center;min-height:520px;overflow:hidden;border-radius:18px;background:radial-gradient(circle at 50% 20%,#402033,#09090b 60%)}.vsr-preview iframe,.vsr-preview video{width:100%;height:100%;min-height:520px;border:0;background:#09090b}.vsr-placeholder{text-align:center;padding:44px;color:#777}.vsr-placeholder b{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 15px;border-radius:50%;background:rgba(198,169,106,.13);color:#d6b86f;font:600 28px Georgia}.vsr-status{position:absolute;left:14px;right:14px;bottom:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(7,7,9,.86);color:#ddd;backdrop-filter:blur(12px);font-size:12px}.vsr-actions{display:flex;gap:10px;margin-top:13px}.vsr-actions a,.vsr-actions button{flex:1;padding:12px;border-radius:13px;text-align:center;text-decoration:none;font-weight:800;font-size:12px;cursor:pointer}.vsr-download{border:0;background:#c6a96a;color:#16110a}.vsr-secondary{border:1px solid rgba(255,255,255,.12);background:#17171a;color:#fff}
      .vsr-stage{position:fixed;inset:0;z-index:120000;display:grid;place-items:center;background:#050507;overflow:hidden}.vsr-live-frame{position:relative;overflow:hidden;border-radius:24px;background:#0d0d0d;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 50px 140px rgba(0,0,0,.7)}.vsr-live-frame[data-format="9:16"]{height:94vh;aspect-ratio:9/16}.vsr-live-frame[data-format="1:1"]{width:min(92vw,92vh);aspect-ratio:1}.vsr-live-frame[data-format="16:9"]{width:94vw;aspect-ratio:16/9}.vsr-live-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#0d0d0d}.vsr-cursor{position:absolute;z-index:12;width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:rgba(198,169,106,.78);box-shadow:0 4px 18px rgba(0,0,0,.4);transform:translate(-50%,-50%);transition:left .55s cubic-bezier(.2,.8,.2,1),top .55s cubic-bezier(.2,.8,.2,1),transform .14s}.vsr-cursor.click{transform:translate(-50%,-50%) scale(.68)}.vsr-scene-tag{position:absolute;z-index:10;left:22px;top:20px;padding:9px 12px;border:1px solid rgba(198,169,106,.35);border-radius:999px;background:rgba(8,8,10,.78);color:#d9bd72;font:800 10px Inter,Arial;letter-spacing:.13em;text-transform:uppercase;backdrop-filter:blur(12px)}.vsr-intro,.vsr-outro{position:absolute;z-index:20;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 32%,#4b2134,#0b0b0d 66%);color:#f7f2ed;text-align:center;transition:opacity .6s}.vsr-intro.hidden,.vsr-outro.hidden{opacity:0;pointer-events:none}.vsr-brand{font:500 clamp(48px,8vw,96px) Georgia,serif;letter-spacing:.08em;color:#d8bd77}.vsr-brand-copy{max-width:680px;margin:18px auto 0;padding:0 28px;font:500 clamp(16px,2vw,24px)/1.5 Inter,Arial;color:#f4efea}.vsr-live-note{position:fixed;z-index:120010;left:18px;bottom:16px;padding:9px 12px;border-radius:999px;background:rgba(0,0,0,.72);color:#d8bd77;font:800 10px Inter,Arial;letter-spacing:.12em;text-transform:uppercase}
      @media(max-width:920px){.vsr-compose{grid-template-columns:1fr}.vsr-create{min-width:0}.vsr-grid{grid-template-columns:1fr}.vsr-panel{height:calc(100vh - 16px)}}@media(max-width:580px){.vsr-home{padding:28px}.vsr-options{grid-template-columns:1fr}.vsr-grid{padding:14px}.vsr-modal{padding:8px}}
    `;
    document.head.appendChild(style);
  }

  function homeMarkup() {
    return `<section class="vsr-home">
      <span class="vsr-kicker">VELVET STUDIO</span>
      <h1>Le vrai Velvet.<br>En mouvement.</h1>
      <p>Décrivez la démonstration. Velvet prépare la narration française, ouvre l’espace Membres Marketing et enregistre sa navigation réelle jusqu’à la vidéo finale.</p>
      <div class="vsr-compose"><textarea data-vsr-home>${esc(DEFAULT_BRIEF)}</textarea><button class="vsr-create" data-vsr-open>Créer la vidéo<small>Navigation live + voix française + export</small></button></div>
      <div class="vsr-proof"><span>Véritable interface Membres</span><span>Navigation enregistrée en direct</span><span>Profils fictifs Marketing</span><span>Aucun secours vocal anglais</span></div>
    </section>`;
  }

  function modalMarkup(prompt) {
    const step = (id, n, label) => `<div class="vsr-step" data-vsr-step="${id}"><i>${n}</i><span>${label}</span><small>En attente</small></div>`;
    return `<div class="vsr-modal" data-vsr-modal><section class="vsr-panel" role="dialog" aria-modal="true" aria-label="Créer une vidéo Velvet">
      <header class="vsr-head"><div><strong>Créer une vidéo de Velvet</strong><span>Le navigateur demandera l’autorisation d’enregistrer cet onglet.</span></div><button class="vsr-close" data-vsr-close aria-label="Fermer">×</button></header>
      <div class="vsr-grid"><section class="vsr-card"><span class="vsr-kicker">DIRECTION DE LA VIDÉO</span><h2>Que doit raconter Velvet ?</h2><p class="vsr-muted">Décrivez l’objectif. L’IA prépare un parcours court, puis le véritable espace Membres est piloté et filmé.</p>
        <textarea data-vsr-prompt>${esc(prompt || DEFAULT_BRIEF)}</textarea>
        <div class="vsr-options"><label>Format<select data-vsr-format><option value="9:16">Vertical · Réseaux sociaux</option><option value="1:1">Carré · Publication</option><option value="16:9">Paysage · Site / YouTube</option></select></label><label>Durée<select data-vsr-duration><option value="15">15 secondes</option><option value="30" selected>30 secondes</option></select></label></div>
        <button class="vsr-run" data-vsr-run>Créer et enregistrer la vidéo</button>
        <p class="vsr-help">Au moment de l’autorisation, choisissez l’onglet Velvet actuellement ouvert. L’enregistrement ne démarre qu’une fois le scénario et la voix prêts.</p>
        <div class="vsr-progress">${step('permission',1,'Autorisation de l’onglet')}${step('plan',2,'Scénario français')}${step('voice',3,'Voix off française')}${step('record',4,'Navigation réelle')}${step('export',5,'Export de la vidéo')}</div>
      </section><section class="vsr-card"><span class="vsr-kicker">APERÇU</span><h2 data-vsr-title>Le véritable Velvet apparaîtra ici</h2><p class="vsr-muted" data-vsr-copy>Accueil, profils, messages, sorties et carte seront ouverts réellement.</p><div class="vsr-preview" data-vsr-preview><iframe src="/marketing/" title="BETA Marketing Velvet"></iframe><div class="vsr-status">Prévisualisation de la BETA Marketing · données fictives</div></div><div class="vsr-actions" data-vsr-actions hidden></div></section></div>
    </section></div>`;
  }

  function install() {
    const main = root.querySelector('.vs1-project-main');
    if (!main) return false;
    main.querySelectorAll('.vsl-home,.vs1-hero-card,.vs1-metrics,.vs1-section-head,.vs1-project-grid').forEach((node) => node.remove());
    if (!main.querySelector('.vsr-home')) main.innerHTML = homeMarkup();
    const copy = root.querySelector('.vs1-brand small');
    if (copy) copy.textContent = 'Production vidéo Marketing';
    return true;
  }

  function openStudio(prompt) {
    document.querySelector('[data-vsr-modal]')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalMarkup(prompt));
    document.body.style.overflow = 'hidden';
  }

  function closeStudio() {
    if (state.running) cancelProduction();
    document.querySelector('[data-vsr-modal]')?.remove();
    document.body.style.overflow = '';
  }

  function setStep(id, status, detail) {
    const node = document.querySelector(`[data-vsr-step="${id}"]`);
    if (!node) return;
    node.classList.toggle('active', status === 'active');
    node.classList.toggle('done', status === 'done');
    node.querySelector('i').textContent = status === 'done' ? '✓' : ({ permission: 1, plan: 2, voice: 3, record: 4, export: 5 })[id];
    node.querySelector('small').textContent = detail || (status === 'done' ? 'Terminé' : status === 'active' ? 'En cours' : 'En attente');
  }

  function updateStatus(message) {
    const preview = document.querySelector('[data-vsr-preview]');
    if (!preview) return;
    let node = preview.querySelector('.vsr-status');
    if (!node) {
      node = document.createElement('div');
      node.className = 'vsr-status';
      preview.appendChild(node);
    }
    node.textContent = message;
  }

  async function apiJson(body) {
    const response = await fetch('/api/control/studio-media', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({ error: `Erreur ${response.status}` }));
    if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
    return payload;
  }

  async function generatePlan(brief, format, duration) {
    const payload = await apiJson({ action: 'plan_video', brief, format, duration });
    const raw = payload.plan;
    if (!raw?.scenes?.length) throw new Error('Le scénario Velvet est incomplet.');
    const preferred = duration >= 30 ? ['home', 'discover', 'profile', 'messages', 'events', 'map'] : ['home', 'discover', 'profile', 'events'];
    const sceneDuration = duration / preferred.length;
    const byScreen = new Map(raw.scenes.map((scene) => [scene.screen, scene]));
    const fallbackVoice = {
      home: 'Bienvenue dans Velvet, un univers élégant pensé pour des rencontres plus sincères.',
      discover: 'Découvrez des profils complets et trouvez les personnes qui vous correspondent vraiment.',
      profile: 'Chaque fiche raconte un univers, des envies et un niveau de confiance clairement visible.',
      messages: 'Échangez simplement dans une messagerie conçue autour de la discrétion et du respect.',
      events: 'Retrouvez les sorties et les événements qui font vivre la communauté près de vous.',
      map: 'Explorez les membres, les établissements et les expériences disponibles autour de vous.'
    };
    return {
      title: raw.title || 'Découvrir Velvet',
      duration,
      format,
      scenes: preferred.map((screen, index) => {
        const scene = byScreen.get(screen) || {};
        return {
          screen,
          duration: sceneDuration,
          title: scene.title || ROUTES[screen].label,
          onScreen: scene.onScreen || ROUTES[screen].label,
          voice: String(scene.voice || fallbackVoice[screen]).replace(/\s+/g, ' ').trim().slice(0, 190),
          index
        };
      })
    };
  }

  async function generateVoiceSegment(scene) {
    const response = await fetch('/api/control/studio-media', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'generate_voice', text: scene.voice, duration: Math.max(4, Math.round(scene.duration)), language: 'fr' })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Voix française indisponible.' }));
      throw new Error(payload.error === 'workers_ai_voice_unavailable' ? 'La voix française Workers AI est indisponible. Aucun secours anglais ne sera utilisé.' : payload.error);
    }
    if ((response.headers.get('x-velvet-studio-voice-language') || 'fr') !== 'fr') throw new Error('La voix reçue n’est pas française. Production interrompue.');
    return response.blob();
  }

  async function prepareVoices(plan) {
    const blobs = [];
    for (let index = 0; index < plan.scenes.length; index += 1) {
      setStep('voice', 'active', `${index + 1} / ${plan.scenes.length}`);
      blobs.push(await generateVoiceSegment(plan.scenes[index]));
    }
    return blobs;
  }

  async function requestDisplayStream() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Ce navigateur ne permet pas l’enregistrement d’un onglet.');
    return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 }, displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
  }

  function stageMarkup(format) {
    return `<div class="vsr-stage" data-vsr-stage><div class="vsr-live-frame" data-vsr-live-frame data-format="${format}"><iframe data-vsr-live-iframe src="/marketing/?velvet_capture=${crypto.randomUUID().replaceAll('-', '').slice(0, 48)}&velvet_live=1" title="Velvet Membres en direct"></iframe><div class="vsr-cursor" data-vsr-cursor style="left:50%;top:50%"></div><div class="vsr-scene-tag" data-vsr-scene>Velvet</div><div class="vsr-intro" data-vsr-intro><div><div class="vsr-brand">VELVET</div><div class="vsr-brand-copy">Là où les plus belles rencontres commencent.</div></div></div><div class="vsr-outro hidden" data-vsr-outro><div><div class="vsr-brand">VELVET</div><div class="vsr-brand-copy">Rejoignez un univers pensé pour les rencontres, les expériences et la confiance.</div></div></div></div><div class="vsr-live-note">ENREGISTREMENT DU VÉRITABLE ESPACE MEMBRES</div></div>`;
  }

  async function waitForMarketing(iframe, timeout = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (state.cancelled) throw new Error('studio_cancelled');
      try {
        const doc = iframe.contentDocument;
        if (doc?.querySelector('.app-shell') && doc.querySelector('[data-vc-view="home"]')) return doc;
      } catch {}
      await wait(120);
    }
    throw new Error('La BETA Marketing ne s’est pas chargée à temps.');
  }

  function cursorToElement(frame, iframe, element) {
    if (!element) return;
    const cursor = frame.querySelector('[data-vsr-cursor]');
    const rect = element.getBoundingClientRect();
    const iframeRect = iframe.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    cursor.style.left = `${iframeRect.left - frameRect.left + rect.left + rect.width / 2}px`;
    cursor.style.top = `${iframeRect.top - frameRect.top + rect.top + rect.height / 2}px`;
  }

  async function visibleClick(frame, iframe, selector) {
    const doc = iframe.contentDocument;
    const element = doc?.querySelector(selector);
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(380);
    cursorToElement(frame, iframe, element);
    await wait(620);
    const cursor = frame.querySelector('[data-vsr-cursor]');
    cursor.classList.add('click');
    element.click();
    await wait(180);
    cursor.classList.remove('click');
    await wait(650);
    return true;
  }

  async function smoothPageTour(iframe, duration) {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    const max = Math.max(0, (doc.scrollingElement?.scrollHeight || doc.body.scrollHeight) - win.innerHeight);
    if (max < 100) {
      await wait(Math.max(700, duration - 900));
      return;
    }
    const target = Math.min(max, Math.max(240, max * .42));
    win.scrollTo({ top: target, behavior: 'smooth' });
    await wait(Math.max(800, duration * .48));
    win.scrollTo({ top: Math.min(max, target * .18), behavior: 'smooth' });
    await wait(Math.max(650, duration * .32));
  }

  async function navigateScene(frame, iframe, scene) {
    const doc = iframe.contentDocument;
    const tag = frame.querySelector('[data-vsr-scene]');
    tag.textContent = ROUTES[scene.screen]?.label || 'Velvet';
    doc.defaultView.scrollTo({ top: 0, behavior: 'auto' });

    if (scene.screen === 'profile') {
      await visibleClick(frame, iframe, ROUTES.discover.selector);
      await visibleClick(frame, iframe, '[data-open-profile]');
    } else if (scene.screen === 'messages') {
      await visibleClick(frame, iframe, ROUTES.messages.selector);
      await visibleClick(frame, iframe, '[data-open-conversation]');
    } else {
      await visibleClick(frame, iframe, ROUTES[scene.screen]?.selector || ROUTES.home.selector);
    }

    await smoothPageTour(iframe, Math.max(1200, scene.duration * 1000 - 1900));
  }

  function outputSize(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 900, height: 900 };
    return { width: 720, height: 1280 };
  }

  function bestMime() {
    return ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function createLiveVideo(displayStream, frame, format, audioBuffers, plan) {
    const displayVideo = document.createElement('video');
    displayVideo.muted = true;
    displayVideo.playsInline = true;
    displayVideo.srcObject = displayStream;
    await displayVideo.play();
    while (!displayVideo.videoWidth) await wait(50);

    const size = outputSize(format);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    const canvasStream = canvas.captureStream(30);

    const audioContext = new AudioContext();
    state.audioContext = audioContext;
    await audioContext.resume();
    const destination = audioContext.createMediaStreamDestination();
    const decoded = [];
    for (const blob of audioBuffers) decoded.push(await audioContext.decodeAudioData(await blob.arrayBuffer()));
    destination.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

    let paint = true;
    const paintFrame = () => {
      if (!paint) return;
      const rect = frame.getBoundingClientRect();
      const scaleX = displayVideo.videoWidth / window.innerWidth;
      const scaleY = displayVideo.videoHeight / window.innerHeight;
      const sx = Math.max(0, rect.left * scaleX);
      const sy = Math.max(0, rect.top * scaleY);
      const sw = Math.min(displayVideo.videoWidth - sx, rect.width * scaleX);
      const sh = Math.min(displayVideo.videoHeight - sy, rect.height * scaleY);
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(displayVideo, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      state.paintFrame = requestAnimationFrame(paintFrame);
    };
    paintFrame();

    const mime = bestMime();
    const chunks = [];
    const recorder = new MediaRecorder(canvasStream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 160_000 } : undefined);
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.start(500);

    const baseTime = audioContext.currentTime + .85;
    let cursor = .85;
    plan.scenes.forEach((scene, index) => {
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = decoded[index];
      const available = Math.max(2.3, scene.duration - .55);
      if (source.buffer.duration > available) source.playbackRate.value = Math.min(1.08, source.buffer.duration / available);
      gain.gain.value = .96;
      source.connect(gain).connect(destination);
      gain.connect(audioContext.destination);
      source.start(baseTime + cursor);
      state.sources.push(source);
      cursor += scene.duration;
    });

    return {
      stop: async () => {
        paint = false;
        cancelAnimationFrame(state.paintFrame);
        const blob = await new Promise((resolve) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
          recorder.stop();
        });
        canvasStream.getTracks().forEach((track) => track.stop());
        displayVideo.srcObject = null;
        return { blob, mime: recorder.mimeType || 'video/webm' };
      }
    };
  }

  async function runProduction() {
    if (state.running) return;
    const modal = document.querySelector('[data-vsr-modal]');
    const brief = modal?.querySelector('[data-vsr-prompt]')?.value.trim();
    const format = modal?.querySelector('[data-vsr-format]')?.value || '9:16';
    const duration = Number(modal?.querySelector('[data-vsr-duration]')?.value || 30);
    if (!brief || brief.length < 20) return;

    const button = modal.querySelector('[data-vsr-run]');
    const title = modal.querySelector('[data-vsr-title]');
    const copy = modal.querySelector('[data-vsr-copy]');
    const actions = modal.querySelector('[data-vsr-actions]');
    state.running = true;
    state.cancelled = false;
    button.disabled = true;
    button.textContent = 'Préparation en cours…';
    actions.hidden = true;

    try {
      setStep('permission', 'active', 'Choisir cet onglet');
      state.displayStream = await requestDisplayStream();
      setStep('permission', 'done', 'Onglet autorisé');

      setStep('plan', 'active', 'Écriture en français');
      title.textContent = 'Préparation de la navigation';
      copy.textContent = 'Velvet organise un parcours fidèle aux fonctionnalités visibles.';
      const plan = await generatePlan(brief, format, duration);
      setStep('plan', 'done', `${plan.scenes.length} étapes`);

      setStep('voice', 'active', 'Phrases françaises');
      const voices = await prepareVoices(plan);
      setStep('voice', 'done', 'Voix française prête');

      document.body.insertAdjacentHTML('beforeend', stageMarkup(format));
      const stage = document.querySelector('[data-vsr-stage]');
      const frame = stage.querySelector('[data-vsr-live-frame]');
      const iframe = stage.querySelector('[data-vsr-live-iframe]');
      await waitForMarketing(iframe);

      setStep('record', 'active', 'Navigation en direct');
      const liveVideo = await createLiveVideo(state.displayStream, frame, format, voices, plan);
      await wait(900);
      frame.querySelector('[data-vsr-intro]').classList.add('hidden');
      await wait(700);

      for (let index = 0; index < plan.scenes.length; index += 1) {
        if (state.cancelled) throw new Error('studio_cancelled');
        setStep('record', 'active', `${index + 1} / ${plan.scenes.length}`);
        await navigateScene(frame, iframe, plan.scenes[index]);
      }

      frame.querySelector('[data-vsr-outro]').classList.remove('hidden');
      await wait(1800);
      setStep('record', 'done', 'Navigation enregistrée');
      setStep('export', 'active', 'Finalisation');
      const result = await liveVideo.stop();
      stage.remove();
      state.displayStream.getTracks().forEach((track) => track.stop());
      state.displayStream = null;
      await state.audioContext?.close().catch(() => {});
      state.audioContext = null;
      setStep('export', 'done', 'Vidéo prête');

      if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
      state.outputUrl = URL.createObjectURL(result.blob);
      const extension = result.mime.includes('mp4') ? 'mp4' : 'webm';
      const filename = `velvet-demo-live-${Date.now()}.${extension}`;
      const preview = modal.querySelector('[data-vsr-preview]');
      preview.innerHTML = `<video src="${state.outputUrl}" controls playsinline></video>`;
      actions.hidden = false;
      actions.innerHTML = `<a class="vsr-download" href="${state.outputUrl}" download="${filename}">Télécharger la vidéo</a><button class="vsr-secondary" data-vsr-new>Créer une autre vidéo</button>`;
      title.textContent = plan.title;
      copy.textContent = `Navigation Velvet enregistrée en direct · ${duration} secondes · voix française intégrée`;
    } catch (error) {
      document.querySelector('[data-vsr-stage]')?.remove();
      state.displayStream?.getTracks().forEach((track) => track.stop());
      state.displayStream = null;
      await state.audioContext?.close().catch(() => {});
      state.audioContext = null;
      if (error.name !== 'NotAllowedError' && error.message !== 'studio_cancelled') {
        title.textContent = 'La production s’est arrêtée';
        copy.textContent = error.message || 'Une erreur est survenue.';
        updateStatus(copy.textContent);
      } else if (error.name === 'NotAllowedError') {
        title.textContent = 'Autorisation nécessaire';
        copy.textContent = 'Choisissez l’onglet Velvet lorsque le navigateur demande quelle surface enregistrer.';
      }
    } finally {
      state.running = false;
      state.sources = [];
      button.disabled = false;
      button.textContent = 'Créer et enregistrer la vidéo';
    }
  }

  function cancelProduction() {
    state.cancelled = true;
    state.sources.forEach((source) => { try { source.stop(); } catch {} });
    state.displayStream?.getTracks().forEach((track) => track.stop());
    document.querySelector('[data-vsr-stage]')?.remove();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-vsr-open]')) {
      event.preventDefault();
      openStudio(root.querySelector('[data-vsr-home]')?.value || DEFAULT_BRIEF);
      return;
    }
    if (event.target.closest('[data-vsr-close]')) {
      event.preventDefault();
      closeStudio();
      return;
    }
    if (event.target.closest('[data-vsr-run]')) {
      event.preventDefault();
      runProduction();
      return;
    }
    if (event.target.closest('[data-vsr-new]')) {
      const preview = document.querySelector('[data-vsr-preview]');
      if (preview) preview.innerHTML = '<iframe src="/marketing/" title="BETA Marketing Velvet"></iframe><div class="vsr-status">Prévisualisation de la BETA Marketing · données fictives</div>';
      document.querySelector('[data-vsr-actions]')?.setAttribute('hidden', '');
      ['permission', 'plan', 'voice', 'record', 'export'].forEach((id) => setStep(id, 'idle', 'En attente'));
    }
  });

  installStyles();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts > 120) clearInterval(timer);
  }, 100);
  install();
})();
