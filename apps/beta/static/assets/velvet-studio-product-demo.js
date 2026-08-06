(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const HISTORY_KEY = 'velvet_studio_product_demo_history_v1';
  const VIEW_LABELS = {
    home: 'Accueil',
    discover: 'Recherche',
    profile: 'Profil membre',
    messages: 'Messagerie',
    events: 'Sorties & événements',
    map: 'Carte Zwit'
  };
  const state = {
    running: false,
    videoUrl: null,
    fileName: ''
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

  function notify(message, tone = 'ok') {
    let node = document.querySelector('#vs31Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vs31Toast';
      document.body.appendChild(node);
    }
    node.className = `vs31-toast ${tone}`;
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('show'));
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 4200);
  }

  function injectStyles() {
    if (document.querySelector('#velvetProductDemoStyle')) return;
    const style = document.createElement('style');
    style.id = 'velvetProductDemoStyle';
    style.textContent = `
      .vpd-hidden{display:none!important}
      .vpd-home{position:relative;overflow:hidden;margin-bottom:34px;padding:48px;border:1px solid rgba(198,169,106,.25);border-radius:32px;background:radial-gradient(circle at 86% 8%,rgba(198,169,106,.2),transparent 27%),linear-gradient(135deg,#151316,#25151c 55%,#571a34);box-shadow:0 28px 90px rgba(0,0,0,.34)}
      .vpd-home h1{max-width:850px;margin:12px 0 14px;color:#f8f5f1;font:500 clamp(43px,5.7vw,78px)/.98 Georgia,serif;letter-spacing:-.04em}
      .vpd-home>p{max-width:760px;margin:0 0 30px;color:rgba(248,245,241,.72);font-size:17px;line-height:1.65}
      .vpd-eyebrow{display:block;color:#d8bb72;font:750 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}
      .vpd-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(7,7,9,.6);backdrop-filter:blur(18px)}
      .vpd-compose textarea{min-height:105px;padding:15px!important;border:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;outline:none!important;resize:vertical;font:500 16px/1.55 Inter,Arial,sans-serif!important}
      .vpd-compose textarea::placeholder{color:rgba(255,255,255,.38)}
      .vpd-main-button{min-width:235px;border:0;border-radius:18px;background:linear-gradient(135deg,#dfc77f,#b98d44);color:#17120b;padding:18px 22px;cursor:pointer;font:800 15px Inter,Arial,sans-serif;box-shadow:0 14px 38px rgba(198,169,106,.22)}
      .vpd-main-button small{display:block;margin-top:6px;font-size:10px;opacity:.68}
      .vpd-benefits{display:flex;flex-wrap:wrap;gap:20px;margin-top:18px;color:rgba(255,255,255,.58);font:650 12px Inter,Arial,sans-serif}
      .vpd-benefits span:before{content:"✓";margin-right:7px;color:#d8bb72}
      .vpd-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:36px}
      .vpd-flow article{padding:20px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:#101012}
      .vpd-flow b{display:grid;place-items:center;width:31px;height:31px;margin-bottom:15px;border-radius:50%;background:rgba(198,169,106,.13);color:#d8bb72;font-size:12px}
      .vpd-flow strong{display:block;margin-bottom:6px;color:#f5f1ed;font-size:14px}
      .vpd-flow span{color:#8d8785;font-size:12px;line-height:1.45}
      .vpd-overlay{position:fixed;inset:0;z-index:100100;display:grid;place-items:center;padding:18px;background:rgba(3,3,5,.88);backdrop-filter:blur(22px)}
      .vpd-dialog{width:min(1180px,100%);height:min(840px,calc(100vh - 36px));overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#0d0d0f;color:#f7f4f0;box-shadow:0 44px 130px #000}
      .vpd-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,13,15,.94);backdrop-filter:blur(16px)}
      .vpd-head strong{font:600 20px Georgia,serif}.vpd-head span{display:block;margin-top:4px;color:#918b89;font-size:12px}
      .vpd-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#17171a;color:#fff;cursor:pointer;font-size:22px}
      .vpd-body{display:grid;grid-template-columns:minmax(0,.9fr) minmax(430px,1.1fr);gap:24px;padding:28px}
      .vpd-card{padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:24px;background:#121214}
      .vpd-card h2{margin:8px 0 10px;font:500 34px/1.05 Georgia,serif}.vpd-muted{color:#928c89;font-size:13px;line-height:1.55}
      .vpd-card textarea{box-sizing:border-box;width:100%;min-height:175px;margin:20px 0 15px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:17px;background:#0b0b0d;color:#fff;resize:vertical;font:500 15px/1.55 Inter,Arial,sans-serif}
      .vpd-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px}
      .vpd-options label{display:grid;gap:7px;color:#aaa4a1;font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}
      .vpd-options select{padding:13px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#0b0b0d;color:#fff}
      .vpd-run{width:100%;padding:17px;border:0;border-radius:16px;background:linear-gradient(135deg,#d9bd72,#b88c43);color:#17120b;cursor:pointer;font-weight:850}.vpd-run:disabled{opacity:.55;cursor:wait}
      .vpd-note{margin:13px 0 0;color:#77716f;font-size:11px;line-height:1.5}
      .vpd-steps{display:grid;gap:10px;margin-top:22px}.vpd-step{display:grid;grid-template-columns:30px 1fr auto;gap:11px;align-items:center;padding:12px 13px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:#0b0b0d;color:#777}.vpd-step i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#18181b;font-style:normal;font-size:11px}.vpd-step.active{border-color:rgba(198,169,106,.36);color:#fff}.vpd-step.active i{background:#c6a96a;color:#111}.vpd-step.done{color:#bbb4b0}.vpd-step.done i{background:#365a48;color:#dff8e8}.vpd-step small{font-size:10px}
      .vpd-preview{position:relative;display:grid;place-items:center;min-height:485px;overflow:hidden;border-radius:20px;background:radial-gradient(circle at 50% 25%,#422033,#111 55%)}
      .vpd-preview img,.vpd-preview video{width:100%;height:100%;max-height:560px;object-fit:contain;background:#08080a}
      .vpd-placeholder{text-align:center;padding:45px;color:#777}.vpd-placeholder b{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:rgba(198,169,106,.12);color:#d6b86f;font-size:27px}
      .vpd-status{position:absolute;left:16px;right:16px;bottom:16px;padding:13px 15px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(7,7,9,.82);color:#ddd;backdrop-filter:blur(14px);font-size:12px}
      .vpd-actions{display:flex;gap:10px;margin-top:14px}.vpd-actions a,.vpd-actions button{flex:1;padding:13px;border-radius:14px;text-align:center;text-decoration:none;font-weight:750;font-size:12px;cursor:pointer}.vpd-download{border:0;background:#c6a96a;color:#16110a}.vpd-secondary{border:1px solid rgba(255,255,255,.12);background:#17171a;color:#fff}
      .vpd-top-launch{white-space:nowrap}
      @media(max-width:900px){.vpd-compose{grid-template-columns:1fr}.vpd-main-button{min-width:0}.vpd-flow{grid-template-columns:1fr 1fr}.vpd-body{grid-template-columns:1fr}.vpd-dialog{height:calc(100vh - 20px)}.vpd-home{padding:30px}}
      @media(max-width:560px){.vpd-flow{grid-template-columns:1fr}.vpd-options{grid-template-columns:1fr}.vpd-body{padding:16px}.vpd-overlay{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveHistory(item) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...readHistory()].slice(0, 12)));
  }

  function homeMarkup() {
    return `<section class="vpd-home" data-vpd-home>
      <span class="vpd-eyebrow">ZWIT STUDIO · DÉMONSTRATION PRODUIT</span>
      <h1>Décrivez la démonstration.<br>Zwit réalise la vidéo.</h1>
      <p>L’IA écrit l’histoire et la voix off. Les images proviennent directement de l’environnement de démonstration Zwit afin de rester fidèles au site et à son fonctionnement.</p>
      <div class="vpd-compose">
        <textarea data-vpd-home-prompt placeholder="Exemple : Crée une démonstration générale de Velvet. Montre l’accueil, la recherche de membres, un profil, la messagerie, les événements et la carte. Utilise uniquement l’interface Zwit avec une voix off claire et premium."></textarea>
        <button class="vpd-main-button" data-vpd-open>Créer la démonstration<small>Interface Zwit + voix off + montage</small></button>
      </div>
      <div class="vpd-benefits"><span>Interface Zwit réelle</span><span>Données fictives internes</span><span>Aucune image inventée</span><span>Voix off française</span></div>
    </section>
    <section class="vpd-flow">
      <article><b>1</b><strong>Décrivez</strong><span>Une phrase suffit pour préciser les fonctions à montrer.</span></article>
      <article><b>2</b><strong>L’IA raconte</strong><span>Le scénario et la voix off sont créés automatiquement.</span></article>
      <article><b>3</b><strong>Zwit se présente</strong><span>Les vrais écrans de démonstration sont animés.</span></article>
      <article><b>4</b><strong>Téléchargez</strong><span>La vidéo finale est prête à être diffusée.</span></article>
    </section>`;
  }

  function installHome() {
    const shell = root.querySelector('.vs1-shell');
    if (!shell) return;

    shell.querySelectorAll(
      '.vs-simple-home,.vs-simple-flow,[data-vs-simple-open],[data-open-v2],[data-open-v3],[data-open-v31-media],.vs3-ready-badge,[data-v31-live-badge]'
    ).forEach((node) => node.classList.add('vpd-hidden'));

    const brandCopy = shell.querySelector('.vs1-brand small');
    if (brandCopy) brandCopy.textContent = 'Création de démonstrations vidéo';

    const topActions = shell.querySelector('.vs1-top-actions');
    if (topActions && !topActions.querySelector('[data-vpd-open]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vs1-btn primary vpd-top-launch';
      button.dataset.vpdOpen = 'true';
      button.textContent = '✦ Créer une démonstration';
      topActions.prepend(button);
    }

    const main = shell.querySelector('.vs1-project-main');
    if (!main || main.querySelector('[data-vpd-home]')) return;
    main.insertAdjacentHTML('afterbegin', homeMarkup());
  }

  function stepMarkup(id, number, label) {
    return `<div class="vpd-step" data-vpd-step="${id}"><i>${number}</i><span>${label}</span><small>En attente</small></div>`;
  }

  function overlayMarkup(prompt = '') {
    return `<div class="vpd-overlay" data-vpd-overlay>
      <section class="vpd-dialog" role="dialog" aria-modal="true" aria-label="Créer une démonstration Zwit">
        <header class="vpd-head">
          <div><strong>Créer une démonstration Zwit</strong><span>L’IA raconte. Zwit montre son véritable environnement.</span></div>
          <button class="vpd-close" data-vpd-close aria-label="Fermer">×</button>
        </header>
        <div class="vpd-body">
          <section class="vpd-card">
            <span class="vpd-eyebrow">VOTRE DEMANDE</span>
            <h2>Que doit montrer la vidéo ?</h2>
            <p class="vpd-muted">Indique simplement les fonctions à présenter et le ton de la voix off.</p>
            <textarea data-vpd-prompt>${esc(prompt)}</textarea>
            <div class="vpd-options">
              <label>Format<select data-vpd-format><option value="9:16">Vertical · Instagram / TikTok</option><option value="1:1">Carré · publication</option><option value="16:9">Paysage · site / YouTube</option></select></label>
              <label>Durée<select data-vpd-duration><option value="15">15 secondes</option><option value="30" selected>30 secondes</option><option value="45">45 secondes</option></select></label>
            </div>
            <button class="vpd-run" data-vpd-run>Produire la démonstration</button>
            <p class="vpd-note">Les écrans utilisent exclusivement des données synthétiques internes. Aucune donnée d’un membre réel n’est affichée.</p>
            <div class="vpd-steps">
              ${stepMarkup('plan', 1, 'Scénario et voix off')}
              ${stepMarkup('screens', 2, 'Navigation dans Zwit')}
              ${stepMarkup('voice', 3, 'Voix off française')}
              ${stepMarkup('render', 4, 'Montage et export')}
            </div>
          </section>
          <section class="vpd-card">
            <span class="vpd-eyebrow">APERÇU</span>
            <h2 data-vpd-title>La vidéo apparaîtra ici</h2>
            <p class="vpd-muted" data-vpd-copy>Zwit affiche les écrans au fur et à mesure de la production.</p>
            <div class="vpd-preview" data-vpd-preview><div class="vpd-placeholder"><b>V</b><strong>Prêt à créer</strong><p>Décrivez la visite produit puis lancez la production.</p></div></div>
            <div class="vpd-actions" data-vpd-actions hidden></div>
          </section>
        </div>
      </section>
    </div>`;
  }

  function openStudio(prompt = '') {
    document.querySelector('[data-vs-simple-overlay]')?.remove();
    document.querySelector('[data-vpd-overlay]')?.remove();
    document.body.insertAdjacentHTML('beforeend', overlayMarkup(prompt));
    document.body.style.overflow = 'hidden';
  }

  function closeStudio() {
    if (state.running) return notify('La démonstration est encore en cours de production.', 'error');
    document.querySelector('[data-vpd-overlay]')?.remove();
    document.body.style.overflow = '';
  }

  function setStep(id, status, detail) {
    const node = document.querySelector(`[data-vpd-step="${id}"]`);
    if (!node) return;
    node.classList.toggle('active', status === 'active');
    node.classList.toggle('done', status === 'done');
    const numbers = { plan: 1, screens: 2, voice: 3, render: 4 };
    node.querySelector('i').textContent = status === 'done' ? '✓' : numbers[id];
    node.querySelector('small').textContent = detail || (status === 'done' ? 'Terminé' : status === 'active' ? 'En cours' : 'En attente');
  }

  function resetSteps() {
    ['plan', 'screens', 'voice', 'render'].forEach((id) => setStep(id, 'idle', 'En attente'));
  }

  function setStatus(message) {
    const preview = document.querySelector('[data-vpd-preview]');
    if (!preview) return;
    let status = preview.querySelector('.vpd-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'vpd-status';
      preview.appendChild(status);
    }
    status.textContent = message;
  }

  async function apiJson(body) {
    const response = await fetch('/api/control/studio-media', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : { error: await response.text() };
    if (!response.ok) {
      const error = new Error(payload.error || `Erreur ${response.status}`);
      error.code = payload.code || '';
      error.action = payload.action || '';
      throw error;
    }
    return payload;
  }

  async function generatePlan(brief, format, duration) {
    const payload = await apiJson({ action: 'plan_video', brief, format, duration });
    if (!payload.plan?.scenes?.length) throw new Error('Le scénario IA est incomplet.');
    return payload.plan;
  }

  async function generateVoice(voiceOver) {
    const response = await fetch('/api/control/studio-media', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'generate_voice', text: voiceOver })
    });
    if (!response.ok) {
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('json') ? await response.json() : { error: await response.text() };
      const error = new Error(payload.error || `Voix off indisponible (${response.status})`);
      error.code = payload.code || '';
      throw error;
    }
    return response.blob();
  }

  function captureSize(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 900, height: 900 };
    return { width: 720, height: 1280 };
  }

  function randomHex(bytes = 24) {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    return [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
  }

  async function waitForCapture(iframe, timeout = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        const doc = iframe.contentDocument;
        if (doc?.querySelector('.vc-shell') && doc.querySelector('[data-vc-view="home"]')) return doc;
      } catch {}
      await sleep(120);
    }
    throw new Error('L’environnement de démonstration Zwit ne s’est pas chargé.');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Impossible de préparer un écran Velvet.'));
      image.src = src;
    });
  }

  async function domScreenToDataUrl(doc, width, height) {
    const source = doc.querySelector('.vc-shell');
    if (!source) throw new Error('Écran Zwit introuvable.');

    const clone = source.cloneNode(true);
    clone.querySelector('.vc-demo')?.remove();
    const styleText = [...doc.querySelectorAll('style')].map((node) => node.textContent || '').join('\n')
      + '\n.vc-nav{top:0!important}.vc-shell{width:100%!important;min-height:100%!important}.vc-main{min-height:100%!important}';

    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;background:#0D0D0D">
          <style>${styleText.replace(/<\/style/gi, '<\\/style')}</style>
          ${serialized}
        </div>
      </foreignObject>
    </svg>`;

    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = await loadImage(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#0D0D0D';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function fallbackScreen(view, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0D0D0D';
    ctx.fillRect(0, 0, width, height);
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#171317');
    grad.addColorStop(1, '#50172f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height * .22);
    ctx.fillStyle = '#C6A96A';
    ctx.font = `600 ${Math.max(24, width * .035)}px Georgia`;
    ctx.fillText('ZWIT', width * .06, height * .09);
    ctx.fillStyle = '#F4F4F2';
    ctx.font = `500 ${Math.max(34, width * .055)}px Georgia`;
    ctx.fillText(VIEW_LABELS[view] || 'Zwit', width * .06, height * .18);
    const columns = width > height ? 3 : 2;
    const gap = width * .025;
    const cardWidth = (width * .88 - gap * (columns - 1)) / columns;
    for (let index = 0; index < 6; index += 1) {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = width * .06 + col * (cardWidth + gap);
      const y = height * .29 + row * (height * .24);
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, height * .19, 22);
      ctx.fill();
      ctx.fillStyle = index % 2 ? '#641B36' : '#2B2428';
      ctx.beginPath();
      ctx.roundRect(x + 14, y + 14, cardWidth * .28, height * .13, 16);
      ctx.fill();
      ctx.fillStyle = '#EEEAE7';
      ctx.font = `600 ${Math.max(12, width * .018)}px Inter,Arial`;
      ctx.fillText(['Profils vérifiés', 'Messages', 'Événements', 'Carte', 'Albums', 'Confiance'][index], x + cardWidth * .35, y + height * .075);
    }
    return canvas.toDataURL('image/png');
  }

  async function captureVelvetScreens(plan, format, onProgress) {
    const size = captureSize(format);
    const iframe = document.createElement('iframe');
    iframe.title = 'Environnement Zwit de démonstration';
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0',
      width: `${size.width}px`,
      height: `${size.height}px`,
      border: '0',
      opacity: '0',
      pointerEvents: 'none'
    });
    iframe.src = `/membres/?velvet_capture=${randomHex(24)}`;
    document.body.appendChild(iframe);

    const frames = [];
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Chargement de Zwit trop long.')), 12000);
        iframe.addEventListener('load', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
      const doc = await waitForCapture(iframe);
      const scenes = plan.scenes.slice(0, 6);

      for (let index = 0; index < scenes.length; index += 1) {
        const view = VIEW_LABELS[scenes[index].screen] ? scenes[index].screen : ['home', 'discover', 'profile', 'messages', 'events', 'map'][index % 6];
        doc.querySelector(`[data-vc-view="${view}"]`)?.click();
        await sleep(180);
        let dataUrl;
        try {
          dataUrl = await domScreenToDataUrl(doc, size.width, size.height);
        } catch {
          dataUrl = fallbackScreen(view, size.width, size.height);
        }
        frames.push({ dataUrl, view, scene: { ...scenes[index], screen: view } });
        onProgress?.(index + 1, scenes.length, dataUrl, view);
      }
      return frames;
    } finally {
      iframe.remove();
    }
  }

  function outputSize(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 1080, height: 1080 };
    return { width: 720, height: 1280 };
  }

  function rounded(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function cover(ctx, image, width, height, zoom = 1, driftX = 0, driftY = 0) {
    const scale = Math.max(width / image.width, height / image.height) * zoom;
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(
      image,
      (width - drawWidth) / 2 + driftX * width * .018,
      (height - drawHeight) / 2 + driftY * height * .012,
      drawWidth,
      drawHeight
    );
  }

  function sceneTimeline(plan, totalDuration) {
    const weights = plan.scenes.map((scene) => Math.max(1, Number(scene.duration || 1)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    return plan.scenes.map((scene, index) => {
      const duration = totalDuration * (weights[index] / total);
      const item = { ...scene, start: cursor, end: cursor + duration, index };
      cursor += duration;
      return item;
    });
  }

  function wrapText(ctx, value, x, y, maxWidth, lineHeight, maxLines = 2) {
    const words = String(value || '').split(/\s+/);
    let line = '';
    let row = 0;
    for (const word of words) {
      const candidate = `${line}${word} `;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        ctx.fillText(line.trim(), x, y + row * lineHeight);
        row += 1;
        line = `${word} `;
        if (row >= maxLines) return;
      } else {
        line = candidate;
      }
    }
    if (row < maxLines) ctx.fillText(line.trim(), x, y + row * lineHeight);
  }

  function drawCursor(ctx, width, height, progress, screen) {
    const targets = {
      home: [.72, .42],
      discover: [.33, .46],
      profile: [.55, .63],
      messages: [.72, .72],
      events: [.42, .54],
      map: [.65, .48]
    };
    const [tx, ty] = targets[screen] || [.58, .5];
    const x = width * (.2 + (tx - .2) * Math.min(1, progress * 1.8));
    const y = height * (.18 + (ty - .18) * Math.min(1, progress * 1.8));
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.min(1, progress) * Math.PI) * .95;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(6, width * .008), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C6A96A';
    ctx.lineWidth = Math.max(2, width * .003);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(14, width * .018) * (1 + Math.sin(progress * Math.PI * 5) * .12), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFrame(ctx, canvas, images, plan, seconds, totalDuration) {
    const width = canvas.width;
    const height = canvas.height;
    const timeline = sceneTimeline(plan, totalDuration);
    const scene = timeline.find((item) => seconds < item.end) || timeline.at(-1);
    const progress = Math.max(0, Math.min(1, (seconds - scene.start) / Math.max(.1, scene.end - scene.start)));
    const current = images[Math.min(scene.index, images.length - 1)];

    ctx.fillStyle = '#0D0D0D';
    ctx.fillRect(0, 0, width, height);
    if (current) cover(ctx, current, width, height, 1 + progress * .028, (progress - .5) * .5, (progress - .5) * -.35);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .22, width / 2, height / 2, Math.max(width, height) * .72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.38)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    drawCursor(ctx, width, height, progress, scene.screen);

    const panelHeight = height * .16;
    const panelY = height - panelHeight - height * .035;
    ctx.fillStyle = 'rgba(9,9,11,.82)';
    rounded(ctx, width * .045, panelY, width * .91, panelHeight, Math.max(18, width * .025));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#C6A96A';
    ctx.font = `750 ${Math.max(10, width * .015)}px Inter,Arial`;
    ctx.fillText((VIEW_LABELS[scene.screen] || 'ZWIT').toUpperCase(), width * .075, panelY + panelHeight * .27);
    ctx.fillStyle = '#F7F3EF';
    ctx.font = `600 ${Math.max(24, width * .038)}px Georgia`;
    wrapText(ctx, scene.onScreen || scene.title, width * .075, panelY + panelHeight * .61, width * .82, panelHeight * .32, 2);

    if (seconds > totalDuration - 2.2) {
      const alpha = Math.min(1, (seconds - (totalDuration - 2.2)) / .7);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(13,13,13,.94)';
      ctx.fillRect(0, 0, width, height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#C6A96A';
      ctx.font = `600 ${Math.max(46, width * .075)}px Georgia`;
      ctx.fillText('ZWIT', width / 2, height * .47);
      ctx.fillStyle = '#F5F1ED';
      ctx.font = `500 ${Math.max(17, width * .026)}px Inter,Arial`;
      ctx.fillText('Là où les plus belles rencontres commencent.', width / 2, height * .54);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255,255,255,.18)';
    rounded(ctx, width * .06, height * .975, width * .88, Math.max(4, height * .004), 99);
    ctx.fill();
    ctx.fillStyle = '#C6A96A';
    rounded(ctx, width * .06, height * .975, width * .88 * (seconds / totalDuration), Math.max(4, height * .004), 99);
    ctx.fill();
  }

  async function renderVideo(plan, frames, voiceBlob, format, requestedDuration, onProgress) {
    if (!window.MediaRecorder) throw new Error('Ce navigateur ne permet pas encore l’export vidéo.');
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Le moteur audio du navigateur est indisponible.');

    const images = await Promise.all(frames.map((frame) => loadImage(frame.dataUrl)));
    const audioContext = new Audio();
    await audioContext.resume();
    const audioBuffer = await audioContext.decodeAudioData(await voiceBlob.arrayBuffer());
    const totalDuration = Math.min(48, Math.max(Number(requestedDuration || 30), audioBuffer.duration + .4));

    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);

    const size = outputSize(format);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type)) || '';
    const chunks = [];
    const recorder = new MediaRecorder(stream, mimeType ? {
      mimeType,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 128_000
    } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.start(250);
    source.start();

    const started = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        const seconds = Math.min(totalDuration, (now - started) / 1000);
        drawFrame(ctx, canvas, images, plan, seconds, totalDuration);
        onProgress?.(Math.round(seconds / totalDuration * 100));
        if (seconds >= totalDuration) return resolve();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    try { source.stop(); } catch {}
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
      recorder.stop();
    });
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
    return { blob, duration: Math.round(totalDuration) };
  }

  function cleanFileName(value) {
    return String(value || 'demo-velvet')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 70) || 'demo-velvet';
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    return url;
  }

  function friendlyError(error) {
    const messages = {
      workers_ai_binding_missing: 'Workers AI n’est pas disponible sur le déploiement actif.',
      studio_access_required: 'Ton compte doit disposer de l’accès Direction ou Admin.',
      workers_ai_voice_missing: 'Workers AI n’a pas renvoyé la voix off.',
      workers_ai_invalid_input: 'Workers AI a refusé une entrée. Le détail technique a été enregistré.',
      capture_mode_synthetic_only: 'Le mode de démonstration protège correctement les données réelles.'
    };
    if (error.code === '8002') return 'Workers AI a refusé une entrée (8002). Réduis légèrement la voix off ou relance la production.';
    return messages[error.message] || error.message || 'La production a rencontré une erreur.';
  }

  async function runProduction() {
    if (state.running) return;
    const overlay = document.querySelector('[data-vpd-overlay]');
    const brief = overlay?.querySelector('[data-vpd-prompt]')?.value.trim();
    const format = overlay?.querySelector('[data-vpd-format]')?.value || '9:16';
    const duration = Number(overlay?.querySelector('[data-vpd-duration]')?.value || 30);
    if (!brief || brief.length < 12) return notify('Décris un peu plus précisément la démonstration souhaitée.', 'error');

    state.running = true;
    const button = overlay.querySelector('[data-vpd-run]');
    const title = overlay.querySelector('[data-vpd-title]');
    const copy = overlay.querySelector('[data-vpd-copy]');
    const actions = overlay.querySelector('[data-vpd-actions]');
    button.disabled = true;
    button.textContent = 'Production en cours…';
    actions.hidden = true;
    resetSteps();

    try {
      setStep('plan', 'active', 'L’IA écrit');
      title.textContent = 'Écriture de la démonstration';
      copy.textContent = 'Zwit choisit les écrans utiles et prépare la voix off.';
      const plan = await generatePlan(brief, format, duration);
      setStep('plan', 'done', 'Scénario prêt');
      title.textContent = plan.title;
      copy.textContent = plan.voiceOver;

      setStep('screens', 'active', 'Ouverture de Zwit');
      const frames = await captureVelvetScreens(plan, format, (current, total, dataUrl, view) => {
        setStep('screens', 'active', `${current} / ${total}`);
        const preview = overlay.querySelector('[data-vpd-preview]');
        preview.innerHTML = `<img src="${dataUrl}" alt="Écran ${esc(VIEW_LABELS[view] || view)} de Zwit"><div class="vpd-status">${esc(VIEW_LABELS[view] || view)} · écran ${current} sur ${total}</div>`;
      });
      setStep('screens', 'done', `${frames.length} écrans Zwit`);

      setStep('voice', 'active', 'Génération');
      setStatus('Création de la voix off française…');
      const voice = await generateVoice(plan.voiceOver);
      setStep('voice', 'done', 'Voix prête');

      setStep('render', 'active', 'Montage 0 %');
      setStatus('Animation des écrans Zwit et synchronisation de la voix…');
      const rendered = await renderVideo(plan, frames, voice, format, duration, (progress) => {
        setStep('render', 'active', `${progress} %`);
        setStatus(`Montage et synchronisation · ${progress} %`);
      });
      setStep('render', 'done', 'Vidéo prête');

      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      state.fileName = `${cleanFileName(plan.title)}.webm`;
      state.videoUrl = downloadBlob(rendered.blob, state.fileName);
      const preview = overlay.querySelector('[data-vpd-preview]');
      preview.innerHTML = `<video src="${state.videoUrl}" controls playsinline></video>`;
      actions.hidden = false;
      actions.innerHTML = `<a class="vpd-download" href="${state.videoUrl}" download="${esc(state.fileName)}">Télécharger la vidéo</a><button class="vpd-secondary" data-vpd-new>Créer une autre</button>`;
      title.textContent = plan.title;
      copy.textContent = `Démonstration terminée · ${rendered.duration} secondes · interface Zwit et voix off incluses`;
      saveHistory({ title: plan.title, format, duration: rendered.duration, createdAt: new Date().toISOString(), brief });
      notify('La démonstration Zwit est prête');
    } catch (error) {
      const message = friendlyError(error);
      title.textContent = 'La production s’est arrêtée';
      copy.textContent = message;
      setStatus(message);
      notify(message, 'error');
    } finally {
      state.running = false;
      button.disabled = false;
      button.textContent = 'Produire la démonstration';
    }
  }

  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-vpd-open]');
    if (open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const prompt = root.querySelector('[data-vpd-home-prompt]')?.value || '';
      openStudio(prompt);
      return;
    }
    if (event.target.closest('[data-vpd-close]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeStudio();
      return;
    }
    if (event.target.closest('[data-vpd-run]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      runProduction();
      return;
    }
    if (event.target.closest('[data-vpd-new]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const overlay = document.querySelector('[data-vpd-overlay]');
      overlay.querySelector('[data-vpd-actions]').hidden = true;
      overlay.querySelector('[data-vpd-preview]').innerHTML = '<div class="vpd-placeholder"><b>V</b><strong>Nouvelle démonstration</strong><p>Modifiez la demande puis relancez la production.</p></div>';
      resetSteps();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-vpd-overlay]')) closeStudio();
  });

  injectStyles();
  const observer = new MutationObserver(() => requestAnimationFrame(installHome));
  observer.observe(root, { childList: true, subtree: true });
  installHome();
})();
