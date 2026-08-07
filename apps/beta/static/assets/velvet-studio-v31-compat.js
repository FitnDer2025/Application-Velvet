(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const HISTORY_KEY = 'velvet_studio_simple_video_history_v1';
  const PROFILE = { id: 'couple_lille', label: 'Élise & Marc', age: '36 & 39 ans', city: 'Lille' };
  const state = { running: false, lastVideoUrl: null, lastFileName: null };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

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
    node._timer = setTimeout(() => node.classList.remove('show'), 3800);
  }

  function injectStyles() {
    if (document.querySelector('#velvetStudioSimpleStyle')) return;
    const style = document.createElement('style');
    style.id = 'velvetStudioSimpleStyle';
    style.textContent = `
      .vs-simple-mode .vs1-hero-card,.vs-simple-mode .vs1-metrics{display:none!important}
      .vs-simple-mode .vs1-project-main{padding-top:28px}
      .vs-simple-home{position:relative;overflow:hidden;border:1px solid rgba(198,169,106,.24);border-radius:30px;padding:44px;background:linear-gradient(135deg,#181416 0%,#23151c 52%,#531831 100%);box-shadow:0 28px 80px rgba(0,0,0,.32);margin-bottom:34px}
      .vs-simple-home:after{content:"";position:absolute;width:480px;height:480px;border-radius:50%;right:-160px;top:-250px;background:radial-gradient(circle,rgba(198,169,106,.22),transparent 66%);pointer-events:none}
      .vs-simple-eyebrow{font:700 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.19em;text-transform:uppercase;color:#d6b86f}
      .vs-simple-home h1{position:relative;z-index:1;margin:12px 0 12px;max-width:820px;font:500 clamp(42px,5.4vw,76px)/.98 Georgia,serif;color:#f8f5f1;letter-spacing:-.035em}
      .vs-simple-home>p{position:relative;z-index:1;max-width:760px;margin:0 0 30px;color:rgba(247,243,239,.72);font-size:17px;line-height:1.65}
      .vs-simple-compose{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:stretch;padding:14px;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:rgba(6,6,8,.56);backdrop-filter:blur(18px)}
      .vs-simple-compose textarea{min-height:92px;resize:vertical;border:0!important;background:transparent!important;color:#fff!important;padding:13px 15px!important;font:500 16px/1.55 Inter,Arial,sans-serif!important;outline:none!important;box-shadow:none!important}
      .vs-simple-compose textarea::placeholder{color:rgba(255,255,255,.42)}
      .vs-simple-generate{min-width:220px;border:0;border-radius:18px;padding:18px 22px;background:linear-gradient(135deg,#dcc27e,#b68b43);color:#17120b;font:750 15px Inter,Arial,sans-serif;cursor:pointer;box-shadow:0 13px 35px rgba(198,169,106,.2)}
      .vs-simple-generate small{display:block;margin-top:5px;font-size:10px;font-weight:650;opacity:.67}
      .vs-simple-trust{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:18px;margin-top:18px;color:rgba(255,255,255,.58);font:600 12px Inter,Arial,sans-serif}
      .vs-simple-trust span:before{content:"✓";margin-right:7px;color:#d6b86f}
      .vs-simple-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 36px}
      .vs-simple-flow article{padding:20px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:#101012}
      .vs-simple-flow b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(198,169,106,.14);color:#d6b86f;font-size:12px;margin-bottom:16px}
      .vs-simple-flow strong{display:block;color:#f5f1ed;font-size:14px;margin-bottom:6px}
      .vs-simple-flow span{color:#8f8988;font-size:12px;line-height:1.45}
      .vs-simple-mode .vs1-section-head .vs1-kicker{font-size:0}
      .vs-simple-mode .vs1-section-head .vs1-kicker:after{content:"VOS CRÉATIONS";font-size:11px}
      .vs-simple-mode .vs1-section-head h2{font-size:0}
      .vs-simple-mode .vs1-section-head h2:after{content:"Projets et montages avancés";font-size:38px}
      .vs-simple-old-action{display:none!important}
      .vs-simple-primary-launch{white-space:nowrap}
      .vs-simple-overlay{position:fixed;inset:0;z-index:100000;background:rgba(3,3,5,.86);backdrop-filter:blur(22px);display:grid;place-items:center;padding:18px}
      .vs-simple-dialog{width:min(1180px,100%);height:min(820px,calc(100vh - 36px));overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#0d0d0f;color:#f7f4f0;box-shadow:0 40px 120px #000;display:grid;grid-template-rows:auto 1fr}
      .vs-simple-dialog-head{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,13,15,.92);backdrop-filter:blur(16px)}
      .vs-simple-dialog-head strong{font:600 20px Georgia,serif}.vs-simple-dialog-head span{display:block;margin-top:4px;color:#8f8988;font-size:12px}
      .vs-simple-close{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:#151518;color:#fff;font-size:22px;cursor:pointer}
      .vs-simple-dialog-body{padding:28px;display:grid;grid-template-columns:minmax(0,.92fr) minmax(420px,1.08fr);gap:24px}
      .vs-simple-brief-card,.vs-simple-output{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:#121214;padding:24px}
      .vs-simple-brief-card h2,.vs-simple-output h2{margin:8px 0 9px;font:500 34px/1.05 Georgia,serif}.vs-simple-muted{color:#918b89;font-size:13px;line-height:1.55}
      .vs-simple-brief-card textarea{width:100%;min-height:160px;margin:20px 0 15px;border:1px solid rgba(255,255,255,.12);border-radius:17px;background:#0b0b0d;color:#fff;padding:16px;font:500 15px/1.55 Inter,Arial,sans-serif;resize:vertical;box-sizing:border-box}
      .vs-simple-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px}.vs-simple-options label{display:grid;gap:7px;color:#aaa4a1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.vs-simple-options select{border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#0b0b0d;color:#fff;padding:13px}
      .vs-simple-run{width:100%;border:0;border-radius:16px;background:linear-gradient(135deg,#d9bd72,#b88c43);padding:17px;color:#17120b;font-weight:800;cursor:pointer}.vs-simple-run:disabled{opacity:.55;cursor:wait}
      .vs-simple-note{margin-top:13px;color:#77716f;font-size:11px;line-height:1.5}
      .vs-simple-progress{display:grid;gap:10px;margin:22px 0}.vs-simple-step{display:grid;grid-template-columns:30px 1fr auto;gap:11px;align-items:center;padding:12px 13px;border-radius:14px;background:#0b0b0d;border:1px solid rgba(255,255,255,.06);color:#777}.vs-simple-step i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#18181b;font-style:normal;font-size:11px}.vs-simple-step.active{color:#fff;border-color:rgba(198,169,106,.35)}.vs-simple-step.active i{background:#c6a96a;color:#111}.vs-simple-step.done{color:#b8b1ad}.vs-simple-step.done i{background:#365a48;color:#dff8e8}.vs-simple-step small{font-size:10px}
      .vs-simple-preview{min-height:430px;border-radius:20px;background:radial-gradient(circle at 50% 25%,#422033,#111 55%);overflow:hidden;display:grid;place-items:center;position:relative}.vs-simple-preview img,.vs-simple-preview video{width:100%;height:100%;max-height:520px;object-fit:contain;background:#08080a}.vs-simple-placeholder{text-align:center;padding:45px;color:#777}.vs-simple-placeholder b{display:grid;place-items:center;width:62px;height:62px;border-radius:50%;margin:0 auto 16px;background:rgba(198,169,106,.12);color:#d6b86f;font-size:26px}.vs-simple-preview-status{position:absolute;left:16px;right:16px;bottom:16px;padding:13px 15px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(7,7,9,.78);backdrop-filter:blur(14px);font-size:12px;color:#ddd}
      .vs-simple-result-actions{display:flex;gap:10px;margin-top:14px}.vs-simple-result-actions button,.vs-simple-result-actions a{flex:1;text-align:center;border-radius:14px;padding:13px;text-decoration:none;font-weight:750;font-size:12px;cursor:pointer}.vs-simple-download{border:0;background:#c6a96a;color:#16110a}.vs-simple-secondary{border:1px solid rgba(255,255,255,.12);background:#17171a;color:#fff}
      .vs-simple-history{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.vs-simple-history article{border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;background:#101012}.vs-simple-history strong{display:block;font-size:12px;color:#eee;margin-bottom:6px}.vs-simple-history span{font-size:10px;color:#777}
      @media(max-width:900px){.vs-simple-compose{grid-template-columns:1fr}.vs-simple-generate{min-width:0}.vs-simple-flow{grid-template-columns:1fr 1fr}.vs-simple-dialog-body{grid-template-columns:1fr}.vs-simple-dialog{height:calc(100vh - 20px)}.vs-simple-home{padding:28px}.vs-simple-history{grid-template-columns:1fr}}
      @media(max-width:560px){.vs-simple-flow{grid-template-columns:1fr}.vs-simple-options{grid-template-columns:1fr}.vs-simple-dialog-body{padding:16px}.vs-simple-overlay{padding:10px}}
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

  function historyMarkup() {
    const history = readHistory().slice(0, 3);
    if (!history.length) return '';
    return `<div class="vs-simple-history">${history.map((item) => `<article><strong>${esc(item.title)}</strong><span>${esc(item.format)} · ${esc(item.duration)} s · ${new Date(item.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span></article>`).join('')}</div>`;
  }

  function homeMarkup() {
    return `<section class="vs-simple-home" data-vs-simple-home>
      <span class="vs-simple-eyebrow">ZWIT STUDIO · CRÉATION ASSISTÉE PAR IA</span>
      <h1>Décrivez votre idée.<br>Zwit crée la vidéo.</h1>
      <p>Écrivez simplement ce que vous souhaitez promouvoir. L’IA prépare le scénario, génère les visuels, crée la voix off et réalise automatiquement le montage.</p>
      <div class="vs-simple-compose">
        <textarea data-vs-simple-home-prompt placeholder="Exemple : Crée une vidéo verticale de 15 secondes qui présente Zwit comme une rencontre premium, rassurante et moderne, avec un couple complice et une démonstration du profil membre."></textarea>
        <button class="vs-simple-generate" data-vs-simple-open>Créer ma vidéo<small>Scénario + visuels + voix + montage</small></button>
      </div>
      <div class="vs-simple-trust"><span>Workers AI connecté</span><span>Personnes fictives majeures</span><span>Aucune compétence de montage requise</span></div>
      ${historyMarkup()}
    </section>
    <section class="vs-simple-flow" aria-label="Fonctionnement de Zwit Studio">
      <article><b>1</b><strong>Décrivez</strong><span>Une phrase suffit pour expliquer le résultat attendu.</span></article>
      <article><b>2</b><strong>L’IA réalise</strong><span>Scénario, visuels et voix off sont produits automatiquement.</span></article>
      <article><b>3</b><strong>Zwit monte</strong><span>Les scènes, textes et démonstrations sont assemblés.</span></article>
      <article><b>4</b><strong>Téléchargez</strong><span>La vidéo est prête au format du réseau choisi.</span></article>
    </section>`;
  }

  function simplifyHome() {
    const shell = root.querySelector('.vs1-shell');
    if (!shell) return;
    shell.querySelectorAll('.vs3-ready-badge,[data-v31-live-badge]').forEach((node) => node.remove());
    shell.querySelectorAll('[data-open-v2],[data-open-v3],[data-open-v31-media]').forEach((node) => node.classList.add('vs-simple-old-action'));
    const brandCopy = shell.querySelector('.vs1-brand small');
    if (brandCopy) brandCopy.textContent = shell.classList.contains('vs1-projects') ? 'Création vidéo assistée par IA' : 'Montage avancé';
    const topActions = shell.querySelector('.vs1-top-actions');
    if (topActions && !topActions.querySelector('[data-vs-simple-open]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vs1-btn primary vs-simple-primary-launch';
      button.dataset.vsSimpleOpen = 'true';
      button.textContent = '✦ Créer une vidéo';
      topActions.prepend(button);
    }
    const main = shell.querySelector('.vs1-project-main');
    if (!main || main.querySelector('[data-vs-simple-home]')) return;
    shell.classList.add('vs-simple-mode');
    main.insertAdjacentHTML('afterbegin', homeMarkup());
  }

  function stepMarkup(id, number, label) {
    return `<div class="vs-simple-step" data-step="${id}"><i>${number}</i><span>${label}</span><small>En attente</small></div>`;
  }

  function overlayMarkup(initialPrompt = '') {
    return `<div class="vs-simple-overlay" data-vs-simple-overlay>
      <section class="vs-simple-dialog" role="dialog" aria-modal="true" aria-label="Créer une vidéo avec Zwit Studio">
        <header class="vs-simple-dialog-head"><div><strong>Créer une vidéo avec l’IA</strong><span>Décrivez le résultat, Zwit s’occupe du reste.</span></div><button class="vs-simple-close" data-vs-simple-close aria-label="Fermer">×</button></header>
        <div class="vs-simple-dialog-body">
          <section class="vs-simple-brief-card">
            <span class="vs-simple-eyebrow">VOTRE DEMANDE</span><h2>Que doit raconter la vidéo ?</h2><p class="vs-simple-muted">Parlez naturellement : le sujet, le public et l’émotion recherchée suffisent.</p>
            <textarea data-vs-simple-prompt>${esc(initialPrompt)}</textarea>
            <div class="vs-simple-options">
              <label>Format<select data-vs-simple-format><option value="9:16">Vertical · Instagram / TikTok</option><option value="1:1">Carré · publication</option><option value="16:9">Paysage · site / YouTube</option></select></label>
              <label>Durée<select data-vs-simple-duration><option value="15">15 secondes</option><option value="20">20 secondes</option><option value="30">30 secondes</option></select></label>
            </div>
            <button class="vs-simple-run" data-vs-simple-run>Produire ma vidéo</button>
            <p class="vs-simple-note">Zwit utilise uniquement des personnages fictifs adultes et une représentation non explicite adaptée aux réseaux sociaux.</p>
            <div class="vs-simple-progress" data-vs-simple-progress>${stepMarkup('plan', 1, 'Scénario et voix off')}${stepMarkup('images', 2, 'Visuels photoréalistes')}${stepMarkup('voice', 3, 'Voix off française')}${stepMarkup('render', 4, 'Montage et export')}</div>
          </section>
          <section class="vs-simple-output">
            <span class="vs-simple-eyebrow">APERÇU</span><h2 data-vs-simple-title>Votre vidéo apparaîtra ici</h2><p class="vs-simple-muted" data-vs-simple-copy>Zwit affiche chaque étape pendant la production.</p>
            <div class="vs-simple-preview" data-vs-simple-preview><div class="vs-simple-placeholder"><b>✦</b><strong>Prêt à créer</strong><p>Décrivez la vidéo puis lancez la production.</p></div></div>
            <div class="vs-simple-result-actions" data-vs-simple-result hidden></div>
          </section>
        </div>
      </section>
    </div>`;
  }

  function openSimpleStudio(prompt = '') {
    document.querySelector('[data-vs-simple-overlay]')?.remove();
    document.body.insertAdjacentHTML('beforeend', overlayMarkup(prompt));
    document.body.style.overflow = 'hidden';
  }

  function closeSimpleStudio() {
    if (state.running) return notify('La vidéo est encore en cours de production.', 'error');
    document.querySelector('[data-vs-simple-overlay]')?.remove();
    document.body.style.overflow = '';
  }

  function setStep(id, status, detail) {
    const node = document.querySelector(`[data-step="${id}"]`);
    if (!node) return;
    node.classList.toggle('active', status === 'active');
    node.classList.toggle('done', status === 'done');
    node.querySelector('i').textContent = status === 'done' ? '✓' : ({ plan: 1, images: 2, voice: 3, render: 4 })[id];
    node.querySelector('small').textContent = detail || (status === 'done' ? 'Terminé' : status === 'active' ? 'En cours' : 'En attente');
  }

  function resetSteps() {
    ['plan', 'images', 'voice', 'render'].forEach((id) => setStep(id, 'idle', 'En attente'));
  }

  function setPreviewStatus(message) {
    const preview = document.querySelector('[data-vs-simple-preview]');
    if (!preview) return;
    let status = preview.querySelector('.vs-simple-preview-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'vs-simple-preview-status';
      preview.appendChild(status);
    }
    status.textContent = message;
  }

  async function apiJson(body) {
    const response = await fetch('/api/control/studio-media', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
    if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
    return payload;
  }

  async function generatePlan(brief, format, duration) {
    const payload = await apiJson({ action: 'plan_video', brief, format, duration });
    if (!payload.plan?.scenes?.length) throw new Error('Le scénario IA est incomplet.');
    return payload.plan;
  }

  async function generateImages(plan, format) {
    const scenes = plan.scenes.slice(0, 3);
    const images = [];
    for (let index = 0; index < scenes.length; index += 1) {
      setStep('images', 'active', `${index + 1} / ${scenes.length}`);
      const scene = scenes[index];
      const payload = await apiJson({ action: 'generate_image', prompt: scene.prompt, scenario: scene.scenario, format, preset: 'rencontre-premium', mockProfile: PROFILE.id, steps: 8, seed: Math.floor(Math.random() * 2_000_000_000) + 1 });
      images.push(payload.media.dataUri);
      const preview = document.querySelector('[data-vs-simple-preview]');
      if (preview) preview.innerHTML = `<img src="${payload.media.dataUri}" alt="Visuel généré par Zwit Studio"><div class="vs-simple-preview-status">Visuel ${index + 1} sur ${scenes.length} généré</div>`;
    }
    return images;
  }

  async function generateVoice(voiceOver) {
    const response = await fetch('/api/control/studio-media', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate_voice', text: voiceOver }) });
    if (!response.ok) {
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('json') ? await response.json() : { error: await response.text() };
      throw new Error(payload.error || `Voix off indisponible (${response.status})`);
    }
    return response.blob();
  }

  function dimensions(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 1080, height: 1080 };
    return { width: 720, height: 1280 };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function rounded(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function cover(ctx, image, width, height, zoom, drift) {
    const scale = Math.max(width / image.width, height / image.height) * zoom;
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(image, (width - drawWidth) / 2 + drift * width * .025, (height - drawHeight) / 2 - drift * height * .018, drawWidth, drawHeight);
  }

  function wrapText(ctx, value, x, y, maxWidth, lineHeight, maxLines = 3) {
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
      } else line = candidate;
    }
    if (row < maxLines) ctx.fillText(line.trim(), x, y + row * lineHeight);
  }

  function drawPhone(ctx, width, height, scenario, opacity) {
    const landscape = width > height;
    const phoneWidth = landscape ? width * .23 : width * .58;
    const phoneHeight = landscape ? height * .74 : height * .38;
    const x = landscape ? width * .69 : width * .35;
    const y = landscape ? height * .13 : height * .43;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 35;
    ctx.fillStyle = '#111114'; rounded(ctx, x, y, phoneWidth, phoneHeight, phoneWidth * .08); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke();
    const pad = phoneWidth * .075;
    ctx.fillStyle = '#651c37'; rounded(ctx, x + pad, y + pad, phoneWidth - pad * 2, phoneHeight * .14, 15); ctx.fill();
    ctx.fillStyle = '#d2b46d'; ctx.font = `700 ${Math.max(13, phoneWidth * .055)}px Georgia`; ctx.fillText('ZWIT', x + pad * 1.4, y + phoneHeight * .105);
    ctx.fillStyle = '#282429'; rounded(ctx, x + pad, y + phoneHeight * .23, phoneWidth - pad * 2, phoneHeight * .4, 18); ctx.fill();
    ctx.fillStyle = '#f5f1ed'; ctx.font = `650 ${Math.max(12, phoneWidth * .052)}px Inter,Arial`; ctx.fillText(PROFILE.label, x + pad * 1.35, y + phoneHeight * .48);
    ctx.fillStyle = '#c8aa66'; ctx.font = `500 ${Math.max(9, phoneWidth * .033)}px Inter,Arial`; ctx.fillText(`${PROFILE.age} · ${PROFILE.city}`, x + pad * 1.35, y + phoneHeight * .55);
    ctx.fillStyle = '#651c37'; rounded(ctx, x + pad, y + phoneHeight * .7, phoneWidth - pad * 2, phoneHeight * .17, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `650 ${Math.max(10, phoneWidth * .038)}px Inter,Arial`;
    const action = scenario === 'message' ? 'Nouveau message' : scenario === 'evenement' ? 'Événement à proximité' : scenario === 'recherche' ? 'Découvrir' : 'Profil vérifié';
    ctx.fillText(action, x + pad * 1.35, y + phoneHeight * .805);
    ctx.restore();
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

  function drawFrame(ctx, canvas, images, plan, seconds, totalDuration) {
    const width = canvas.width;
    const height = canvas.height;
    const timeline = sceneTimeline(plan, totalDuration);
    const scene = timeline.find((item) => seconds < item.end) || timeline.at(-1);
    const progress = Math.max(0, Math.min(1, (seconds - scene.start) / Math.max(.1, scene.end - scene.start)));
    const image = images[Math.min(scene.index, images.length - 1)];
    ctx.fillStyle = '#0b090b'; ctx.fillRect(0, 0, width, height);
    if (image) cover(ctx, image, width, height, 1.03 + progress * .08, progress - .5);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(7,7,9,.14)'); gradient.addColorStop(.5, 'rgba(7,7,9,.22)'); gradient.addColorStop(1, 'rgba(7,7,9,.92)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const pad = width * .07;
    ctx.fillStyle = '#d2b46d'; ctx.font = `700 ${Math.max(17, width * .028)}px Georgia`; ctx.fillText('ZWIT', pad, height * .078);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = `600 ${Math.max(9, width * .014)}px Inter,Arial`; ctx.fillText('RENCONTRES · CONFIANCE · EXPÉRIENCES', pad, height * .108);
    if (scene.index > 0 && scene.index < plan.scenes.length - 1) drawPhone(ctx, width, height, scene.scenario, Math.min(1, progress * 2.2));
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.max(38, width * .062)}px Georgia`; wrapText(ctx, scene.onScreen || scene.title, pad, height * .72, width * .78, height * .057, 3);
    ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = `500 ${Math.max(15, width * .024)}px Inter,Arial`; wrapText(ctx, scene.voice || '', pad, height * .86, width * .8, height * .033, 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rounded(ctx, pad, height * .965, width * .86, Math.max(4, height * .004), 99); ctx.fill();
    ctx.fillStyle = '#d2b46d'; rounded(ctx, pad, height * .965, width * .86 * (seconds / totalDuration), Math.max(4, height * .004), 99); ctx.fill();
  }

  async function renderVideo(plan, imageSources, voiceBlob, format, requestedDuration, onProgress) {
    if (!window.MediaRecorder) throw new Error('Ce navigateur ne permet pas encore l’export vidéo.');
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Le moteur audio du navigateur est indisponible.');
    const images = await Promise.all(imageSources.map(loadImage));
    const audioContext = new Audio();
    await audioContext.resume();
    const audioBuffer = await audioContext.decodeAudioData(await voiceBlob.arrayBuffer());
    const totalDuration = Math.max(Number(requestedDuration || 15), audioBuffer.duration + .5);
    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);
    const size = dimensions(format);
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
    const chunks = [];
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_500_000, audioBitsPerSecond: 128_000 } : undefined);
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
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
    return String(value || 'video-zwit').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 70) || 'video-zwit';
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    return url;
  }

  function friendlyError(error) {
    const messages = { workers_ai_binding_missing: 'Workers AI n’est pas disponible sur le déploiement actif.', studio_access_required: 'Ton compte doit disposer de l’accès Direction ou Admin.', workers_ai_image_missing: 'L’IA n’a pas renvoyé le visuel attendu.', workers_ai_voice_missing: 'L’IA n’a pas renvoyé la voix off attendue.' };
    return messages[error.message] || error.message || 'La production a rencontré une erreur.';
  }

  async function runSimpleProduction() {
    if (state.running) return;
    const overlay = document.querySelector('[data-vs-simple-overlay]');
    const brief = overlay?.querySelector('[data-vs-simple-prompt]')?.value.trim();
    const format = overlay?.querySelector('[data-vs-simple-format]')?.value || '9:16';
    const duration = Number(overlay?.querySelector('[data-vs-simple-duration]')?.value || 15);
    if (!brief || brief.length < 12) return notify('Décris un peu plus précisément la vidéo souhaitée.', 'error');
    state.running = true;
    const button = overlay.querySelector('[data-vs-simple-run]');
    const title = overlay.querySelector('[data-vs-simple-title]');
    const copy = overlay.querySelector('[data-vs-simple-copy]');
    const resultActions = overlay.querySelector('[data-vs-simple-result]');
    button.disabled = true; button.textContent = 'Production en cours…'; resultActions.hidden = true;
    resetSteps();
    try {
      setStep('plan', 'active', 'L’IA écrit'); title.textContent = 'Écriture du scénario'; copy.textContent = 'Zwit transforme ta demande en scènes, textes et voix off.';
      const plan = await generatePlan(brief, format, duration);
      setStep('plan', 'done', 'Scénario prêt'); title.textContent = plan.title; copy.textContent = plan.voiceOver;
      setStep('images', 'active', '0 / 3');
      const images = await generateImages(plan, format);
      setStep('images', 'done', `${images.length} visuels`);
      setStep('voice', 'active', 'Génération'); setPreviewStatus('Création de la voix off française…');
      const voice = await generateVoice(plan.voiceOver);
      setStep('voice', 'done', 'Voix prête');
      setStep('render', 'active', 'Montage 0 %'); setPreviewStatus('Montage automatique avec voix off…');
      const rendered = await renderVideo(plan, images, voice, format, duration, (progress) => { setStep('render', 'active', `${progress} %`); setPreviewStatus(`Montage et synchronisation · ${progress} %`); });
      setStep('render', 'done', 'Vidéo prête');
      if (state.lastVideoUrl) URL.revokeObjectURL(state.lastVideoUrl);
      state.lastFileName = `${cleanFileName(plan.title)}.webm`;
      state.lastVideoUrl = downloadBlob(rendered.blob, state.lastFileName);
      const preview = overlay.querySelector('[data-vs-simple-preview]');
      preview.innerHTML = `<video src="${state.lastVideoUrl}" controls playsinline></video>`;
      resultActions.hidden = false;
      resultActions.innerHTML = `<a class="vs-simple-download" href="${state.lastVideoUrl}" download="${esc(state.lastFileName)}">Télécharger la vidéo</a><button class="vs-simple-secondary" data-vs-simple-new>Créer une autre vidéo</button>`;
      title.textContent = plan.title; copy.textContent = `Vidéo terminée · ${rendered.duration} secondes · voix off incluse`;
      saveHistory({ title: plan.title, format, duration: rendered.duration, createdAt: new Date().toISOString(), brief });
      notify('La vidéo est prête et téléchargée');
    } catch (error) {
      const message = friendlyError(error);
      title.textContent = 'La production s’est arrêtée'; copy.textContent = message;
      setPreviewStatus(message); notify(message, 'error');
    } finally {
      state.running = false; button.disabled = false; button.textContent = 'Produire ma vidéo';
    }
  }

  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-vs-simple-open]');
    if (open) {
      const prompt = root.querySelector('[data-vs-simple-home-prompt]')?.value || '';
      openSimpleStudio(prompt);
      return;
    }
    if (event.target.closest('[data-vs-simple-close]')) return closeSimpleStudio();
    if (event.target.closest('[data-vs-simple-run]')) return runSimpleProduction();
    if (event.target.closest('[data-vs-simple-new]')) {
      const overlay = document.querySelector('[data-vs-simple-overlay]');
      overlay?.querySelector('[data-vs-simple-prompt]')?.focus();
      overlay.querySelector('[data-vs-simple-result]').hidden = true;
      overlay.querySelector('[data-vs-simple-preview]').innerHTML = '<div class="vs-simple-placeholder"><b>✦</b><strong>Nouvelle création</strong><p>Modifie la demande puis relance la production.</p></div>';
      resetSteps();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-vs-simple-overlay]')) closeSimpleStudio();
  });

  injectStyles();
  const observer = new MutationObserver(() => requestAnimationFrame(simplifyHome));
  observer.observe(root, { childList: true, subtree: true });
  simplifyHome();
})();
