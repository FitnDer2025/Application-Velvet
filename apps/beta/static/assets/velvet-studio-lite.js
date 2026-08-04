(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const labels = {
    home: 'Accueil',
    discover: 'Recherche',
    profile: 'Profil membre',
    messages: 'Messagerie',
    events: 'Sorties & événements',
    map: 'Carte Velvet'
  };

  const state = {
    running: false,
    cancelled: false,
    controller: null,
    videoUrl: null,
    frameCache: new Map()
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const yieldToBrowser = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  function installStyles() {
    if (document.querySelector('#velvetStudioLiteStyle')) return;
    const style = document.createElement('style');
    style.id = 'velvetStudioLiteStyle';
    style.textContent = `
      .vsl-home{padding:44px;border:1px solid rgba(198,169,106,.24);border-radius:30px;background:radial-gradient(circle at 88% 8%,rgba(198,169,106,.18),transparent 26%),linear-gradient(135deg,#151316,#2b1720 58%,#581a34);box-shadow:0 28px 80px rgba(0,0,0,.3)}
      .vsl-home h1{margin:12px 0 14px;max-width:850px;color:#f8f5f1;font:500 clamp(42px,5.5vw,74px)/.98 Georgia,serif;letter-spacing:-.04em}
      .vsl-home>p{max-width:760px;margin:0 0 28px;color:rgba(248,245,241,.72);font-size:17px;line-height:1.6}
      .vsl-kicker{color:#d7ba71;font:750 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}
      .vsl-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:14px;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:rgba(7,7,9,.58);backdrop-filter:blur(18px)}
      .vsl-compose textarea{min-height:105px;padding:15px!important;border:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;outline:none!important;resize:vertical;font:500 16px/1.55 Inter,Arial,sans-serif!important}
      .vsl-compose textarea::placeholder{color:rgba(255,255,255,.4)}
      .vsl-primary{min-width:230px;border:0;border-radius:18px;background:linear-gradient(135deg,#dec57d,#b98d44);color:#17120b;padding:18px 22px;cursor:pointer;font:800 15px Inter,Arial,sans-serif;box-shadow:0 14px 36px rgba(198,169,106,.22)}
      .vsl-primary small{display:block;margin-top:6px;font-size:10px;opacity:.68}
      .vsl-points{display:flex;flex-wrap:wrap;gap:18px;margin-top:18px;color:rgba(255,255,255,.58);font:650 12px Inter,Arial,sans-serif}.vsl-points span:before{content:'✓';margin-right:7px;color:#d7ba71}
      .vsl-overlay{position:fixed;inset:0;z-index:100100;display:grid;place-items:center;padding:16px;background:rgba(3,3,5,.88);backdrop-filter:blur(18px)}
      .vsl-dialog{width:min(1120px,100%);height:min(820px,calc(100vh - 32px));overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#0d0d0f;color:#f7f4f0;box-shadow:0 42px 120px #000}
      .vsl-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,13,15,.94);backdrop-filter:blur(14px)}
      .vsl-head strong{font:600 20px Georgia,serif}.vsl-head span{display:block;margin-top:4px;color:#918b89;font-size:12px}
      .vsl-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#17171a;color:#fff;cursor:pointer;font-size:22px}
      .vsl-body{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:22px;padding:24px}
      .vsl-card{padding:22px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:#121214}
      .vsl-card h2{margin:8px 0 10px;font:500 32px/1.05 Georgia,serif}.vsl-muted{color:#928c89;font-size:13px;line-height:1.55}
      .vsl-card textarea{box-sizing:border-box;width:100%;min-height:165px;margin:18px 0 14px;padding:15px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#0b0b0d;color:#fff;resize:vertical;font:500 15px/1.55 Inter,Arial,sans-serif}
      .vsl-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.vsl-options label{display:grid;gap:7px;color:#aaa4a1;font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.vsl-options select{padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:#0b0b0d;color:#fff}
      .vsl-run{width:100%;padding:16px;border:0;border-radius:15px;background:linear-gradient(135deg,#d9bd72,#b88c43);color:#17120b;cursor:pointer;font-weight:850}.vsl-run:disabled{opacity:.55;cursor:wait}
      .vsl-note{margin:12px 0 0;color:#77716f;font-size:11px;line-height:1.5}
      .vsl-steps{display:grid;gap:9px;margin-top:18px}.vsl-step{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid rgba(255,255,255,.06);border-radius:13px;background:#0b0b0d;color:#777}.vsl-step i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#18181b;font-style:normal;font-size:11px}.vsl-step.active{border-color:rgba(198,169,106,.36);color:#fff}.vsl-step.active i{background:#c6a96a;color:#111}.vsl-step.done{color:#bbb4b0}.vsl-step.done i{background:#365a48;color:#dff8e8}.vsl-step small{font-size:10px}
      .vsl-preview{position:relative;display:grid;place-items:center;min-height:470px;overflow:hidden;border-radius:18px;background:radial-gradient(circle at 50% 25%,#422033,#111 55%)}
      .vsl-preview img,.vsl-preview video{width:100%;height:100%;max-height:545px;object-fit:contain;background:#08080a}.vsl-placeholder{text-align:center;padding:42px;color:#777}.vsl-placeholder b{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 15px;border-radius:50%;background:rgba(198,169,106,.12);color:#d6b86f;font-size:27px}
      .vsl-status{position:absolute;left:14px;right:14px;bottom:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(7,7,9,.84);color:#ddd;backdrop-filter:blur(12px);font-size:12px}
      .vsl-actions{display:flex;gap:10px;margin-top:13px}.vsl-actions a,.vsl-actions button{flex:1;padding:12px;border-radius:13px;text-align:center;text-decoration:none;font-weight:750;font-size:12px;cursor:pointer}.vsl-download{border:0;background:#c6a96a;color:#16110a}.vsl-secondary{border:1px solid rgba(255,255,255,.12);background:#17171a;color:#fff}
      @media(max-width:900px){.vsl-compose{grid-template-columns:1fr}.vsl-primary{min-width:0}.vsl-body{grid-template-columns:1fr}.vsl-dialog{height:calc(100vh - 18px)}.vsl-home{padding:28px}}
      @media(max-width:560px){.vsl-options{grid-template-columns:1fr}.vsl-body{padding:14px}.vsl-overlay{padding:8px}}
    `;
    document.head.appendChild(style);
  }

  function homeMarkup() {
    return `<section class="vsl-home">
      <span class="vsl-kicker">VELVET STUDIO</span>
      <h1>Décrivez la démonstration.<br>Velvet réalise la vidéo.</h1>
      <p>L’IA écrit la narration et la voix off. Les images proviennent directement de l’environnement Velvet avec des données fictives internes.</p>
      <div class="vsl-compose">
        <textarea data-vsl-home-prompt placeholder="Crée une démonstration générale de Velvet. Montre l’accueil, la recherche, un profil, la messagerie, les sorties et la carte, avec une voix off française premium."></textarea>
        <button class="vsl-primary" data-vsl-open>Créer la démonstration<small>Interface Velvet + voix off + montage</small></button>
      </div>
      <div class="vsl-points"><span>Ouverture immédiate</span><span>Aucune image inventée</span><span>Données synthétiques</span><span>Export vidéo avec voix</span></div>
    </section>`;
  }

  function installStudio() {
    const shell = root.querySelector('.vs1-shell');
    const main = shell?.querySelector('.vs1-project-main');
    if (!shell || !main) return false;

    shell.querySelectorAll('.vs1-hero-card,.vs1-metrics,.vs1-section-head,.vs1-project-grid,[data-open-v2],[data-open-v3],[data-open-v31-media],.vs3-ready-badge').forEach((node) => node.remove());
    const brandCopy = shell.querySelector('.vs1-brand small');
    if (brandCopy) brandCopy.textContent = 'Création vidéo assistée par IA';
    if (!main.querySelector('.vsl-home')) main.innerHTML = homeMarkup();
    return true;
  }

  function step(id, number, label) {
    return `<div class="vsl-step" data-vsl-step="${id}"><i>${number}</i><span>${label}</span><small>En attente</small></div>`;
  }

  function modalMarkup(prompt = '') {
    return `<div class="vsl-overlay" data-vsl-overlay>
      <section class="vsl-dialog" role="dialog" aria-modal="true" aria-label="Créer une démonstration Velvet">
        <header class="vsl-head"><div><strong>Créer une démonstration Velvet</strong><span>Le montage reste utilisable pendant toute la production.</span></div><button class="vsl-close" data-vsl-close aria-label="Fermer">×</button></header>
        <div class="vsl-body">
          <section class="vsl-card">
            <span class="vsl-kicker">VOTRE DEMANDE</span><h2>Que doit montrer la vidéo ?</h2><p class="vsl-muted">Décrivez les fonctions à présenter et le ton souhaité.</p>
            <textarea data-vsl-prompt>${esc(prompt)}</textarea>
            <div class="vsl-options">
              <label>Format<select data-vsl-format><option value="9:16">Vertical · Instagram / TikTok</option><option value="1:1">Carré · publication</option><option value="16:9">Paysage · site / YouTube</option></select></label>
              <label>Durée<select data-vsl-duration><option value="15" selected>15 secondes</option><option value="30">30 secondes</option></select></label>
            </div>
            <button class="vsl-run" data-vsl-run>Produire la démonstration</button>
            <p class="vsl-note">L’export vidéo dure approximativement la durée choisie, mais la page reste fluide. La croix permet d’annuler à tout moment.</p>
            <div class="vsl-steps">${step('plan',1,'Scénario et narration')}${step('screens',2,'Écrans Velvet')}${step('voice',3,'Voix off française')}${step('render',4,'Montage et export')}</div>
          </section>
          <section class="vsl-card"><span class="vsl-kicker">APERÇU</span><h2 data-vsl-title>La vidéo apparaîtra ici</h2><p class="vsl-muted" data-vsl-copy>Chaque étape s’affiche sans bloquer le navigateur.</p><div class="vsl-preview" data-vsl-preview><div class="vsl-placeholder"><b>V</b><strong>Prêt à créer</strong><p>Lancez la production lorsque la demande est prête.</p></div></div><div class="vsl-actions" data-vsl-actions hidden></div></section>
        </div>
      </section>
    </div>`;
  }

  function openStudio(prompt = '') {
    document.querySelector('[data-vsl-overlay]')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalMarkup(prompt));
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => document.querySelector('[data-vsl-prompt]')?.focus());
  }

  function closeStudio() {
    if (state.running) {
      state.cancelled = true;
      state.controller?.abort();
    }
    document.querySelector('[data-vsl-overlay]')?.remove();
    document.body.style.overflow = '';
  }

  function setStep(id, status, detail) {
    const node = document.querySelector(`[data-vsl-step="${id}"]`);
    if (!node) return;
    node.classList.toggle('active', status === 'active');
    node.classList.toggle('done', status === 'done');
    node.querySelector('i').textContent = status === 'done' ? '✓' : ({ plan:1, screens:2, voice:3, render:4 })[id];
    node.querySelector('small').textContent = detail || (status === 'done' ? 'Terminé' : status === 'active' ? 'En cours' : 'En attente');
  }

  function status(message) {
    const preview = document.querySelector('[data-vsl-preview]');
    if (!preview) return;
    let node = preview.querySelector('.vsl-status');
    if (!node) {
      node = document.createElement('div');
      node.className = 'vsl-status';
      preview.appendChild(node);
    }
    node.textContent = message;
  }

  function resetSteps() {
    ['plan','screens','voice','render'].forEach((id) => setStep(id, 'idle', 'En attente'));
  }

  async function apiJson(body) {
    const response = await fetch('/api/control/studio-media', {
      method: 'POST', credentials: 'same-origin', signal: state.controller?.signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('json') ? await response.json() : { error: await response.text() };
    if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
    return payload;
  }

  async function generatePlan(brief, format, duration) {
    const payload = await apiJson({ action: 'plan_video', brief, format, duration });
    if (!payload.plan?.scenes?.length) throw new Error('Le scénario IA est incomplet.');
    return payload.plan;
  }

  async function generateVoice(text) {
    const response = await fetch('/api/control/studio-media', {
      method: 'POST', credentials: 'same-origin', signal: state.controller?.signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate_voice', text })
    });
    if (!response.ok) {
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('json') ? await response.json() : { error: await response.text() };
      throw new Error(payload.error || `Voix off indisponible (${response.status})`);
    }
    return response.blob();
  }

  function captureSize(format) {
    if (format === '16:9') return { width: 960, height: 540 };
    if (format === '1:1') return { width: 720, height: 720 };
    return { width: 540, height: 960 };
  }

  function outputSize(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 900, height: 900 };
    return { width: 720, height: 1280 };
  }

  function randomToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  }

  function loadImage(src, timeout = 6000) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error('Préparation d’un écran trop longue.')), timeout);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Impossible de préparer un écran Velvet.')); };
      image.src = src;
    });
  }

  async function waitForCapture(iframe, timeout = 8000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (state.cancelled) throw new Error('studio_cancelled');
      try {
        const doc = iframe.contentDocument;
        if (doc?.querySelector('.vc-shell') && doc.querySelector('[data-vc-view="home"]')) return doc;
      } catch {}
      await delay(100);
    }
    throw new Error('L’environnement Velvet ne s’est pas chargé à temps.');
  }

  async function domToImage(doc, width, height) {
    const source = doc.querySelector('.vc-shell');
    if (!source) throw new Error('Écran Velvet introuvable.');
    const clone = source.cloneNode(true);
    clone.querySelector('.vc-demo')?.remove();
    const css = [...doc.querySelectorAll('style')].map((node) => node.textContent || '').join('\n') + '\n.vc-nav{top:0!important}.vc-shell{width:100%!important;min-height:100%!important}.vc-main{min-height:100%!important}';
    const html = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;background:#0D0D0D"><style>${css.replace(/<\/style/gi,'<\\/style')}</style>${html}</div></foreignObject></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0,0,width,height); ctx.drawImage(image,0,0,width,height);
      return canvas.toDataURL('image/jpeg', .88);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function fallbackScreen(view, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0,0,width,height);
    const grad = ctx.createLinearGradient(0,0,width,height*.3); grad.addColorStop(0,'#171317'); grad.addColorStop(1,'#5a1935');
    ctx.fillStyle = grad; ctx.fillRect(0,0,width,height*.24);
    ctx.fillStyle = '#C6A96A'; ctx.font = `600 ${Math.max(24,width*.045)}px Georgia`; ctx.fillText('VELVET',width*.06,height*.09);
    ctx.fillStyle = '#F4F4F2'; ctx.font = `500 ${Math.max(30,width*.065)}px Georgia`; ctx.fillText(labels[view] || 'Velvet',width*.06,height*.19);
    const cols = width > height ? 3 : 2; const gap = width*.025; const cardWidth = (width*.88-gap*(cols-1))/cols;
    for (let index=0; index<6; index+=1) {
      const x = width*.06 + (index%cols)*(cardWidth+gap); const y = height*.3 + Math.floor(index/cols)*(height*.22);
      ctx.fillStyle = '#18181B'; ctx.beginPath(); ctx.roundRect(x,y,cardWidth,height*.17,18); ctx.fill();
      ctx.fillStyle = index%2 ? '#641B36' : '#2B2428'; ctx.beginPath(); ctx.roundRect(x+12,y+12,cardWidth*.3,height*.11,14); ctx.fill();
      ctx.fillStyle = '#EEEAE7'; ctx.font = `600 ${Math.max(11,width*.02)}px Inter,Arial`; ctx.fillText(['Profils','Messages','Événements','Carte','Albums','Confiance'][index],x+cardWidth*.36,y+height*.07);
    }
    return canvas.toDataURL('image/jpeg', .9);
  }

  async function captureScreens(plan, format, onProgress) {
    const size = captureSize(format);
    const views = plan.scenes.slice(0, format === '9:16' && plan.duration <= 15 ? 4 : 6).map((scene,index) => labels[scene.screen] ? scene.screen : ['home','discover','profile','messages','events','map'][index%6]);
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position:'fixed', left:'-12000px', top:'0', width:`${size.width}px`, height:`${size.height}px`, border:'0', opacity:'0', pointerEvents:'none' });
    iframe.src = `/membres/?velvet_capture=${randomToken()}`;
    document.body.appendChild(iframe);
    try {
      await Promise.race([
        new Promise((resolve) => iframe.addEventListener('load', resolve, { once:true })),
        delay(8000).then(() => { throw new Error('Chargement de Velvet trop long.'); })
      ]);
      const doc = await waitForCapture(iframe);
      const frames = [];
      for (let index=0; index<views.length; index+=1) {
        if (state.cancelled) throw new Error('studio_cancelled');
        const view = views[index];
        const key = `${format}:${view}`;
        let dataUrl = state.frameCache.get(key);
        if (!dataUrl) {
          doc.querySelector(`[data-vc-view="${view}"]`)?.click();
          await yieldToBrowser();
          await delay(80);
          try { dataUrl = await domToImage(doc,size.width,size.height); }
          catch { dataUrl = fallbackScreen(view,size.width,size.height); }
          state.frameCache.set(key,dataUrl);
        }
        frames.push({ dataUrl, view, scene: { ...plan.scenes[index], screen:view } });
        onProgress?.(index+1, views.length, dataUrl, view);
        await yieldToBrowser();
      }
      return frames;
    } finally {
      iframe.remove();
    }
  }

  function timeline(plan, totalDuration) {
    const weights = plan.scenes.map((scene) => Math.max(1,Number(scene.duration||1)));
    const sum = weights.reduce((a,b) => a+b,0); let cursor=0;
    return plan.scenes.map((scene,index) => { const duration = totalDuration*(weights[index]/sum); const item={...scene,start:cursor,end:cursor+duration,index}; cursor+=duration; return item; });
  }

  function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function cover(ctx,image,w,h,zoom=1,dx=0,dy=0){const scale=Math.max(w/image.width,h/image.height)*zoom;const dw=image.width*scale;const dh=image.height*scale;ctx.drawImage(image,(w-dw)/2+dx*w*.015,(h-dh)/2+dy*h*.01,dw,dh);}

  function drawFrame(ctx,canvas,images,items,seconds,totalDuration) {
    const w=canvas.width,h=canvas.height; const scene=items.find((item)=>seconds<item.end)||items.at(-1); const progress=Math.max(0,Math.min(1,(seconds-scene.start)/Math.max(.1,scene.end-scene.start))); const current=images[Math.min(scene.index,images.length-1)];
    ctx.fillStyle='#0D0D0D';ctx.fillRect(0,0,w,h);if(current)cover(ctx,current,w,h,1+progress*.025,(progress-.5)*.4,(progress-.5)*-.25);
    const grad=ctx.createLinearGradient(0,h*.55,0,h);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,.78)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    const panelH=h*.15,panelY=h-panelH-h*.035;ctx.fillStyle='rgba(9,9,11,.82)';rounded(ctx,w*.045,panelY,w*.91,panelH,Math.max(18,w*.025));ctx.fill();
    ctx.fillStyle='#C6A96A';ctx.font=`750 ${Math.max(10,w*.015)}px Inter,Arial`;ctx.fillText((labels[scene.screen]||'VELVET').toUpperCase(),w*.075,panelY+panelH*.28);
    ctx.fillStyle='#F7F3EF';ctx.font=`600 ${Math.max(23,w*.037)}px Georgia`;ctx.fillText(String(scene.onScreen||scene.title||'Découvrir Velvet').slice(0,55),w*.075,panelY+panelH*.68);
    if(seconds>totalDuration-2){const alpha=Math.min(1,(seconds-(totalDuration-2))/.6);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(13,13,13,.95)';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#C6A96A';ctx.font=`600 ${Math.max(44,w*.07)}px Georgia`;ctx.fillText('VELVET',w/2,h*.48);ctx.fillStyle='#F5F1ED';ctx.font=`500 ${Math.max(16,w*.024)}px Inter,Arial`;ctx.fillText('Là où les plus belles rencontres commencent.',w/2,h*.55);ctx.restore();}
    ctx.fillStyle='rgba(255,255,255,.18)';rounded(ctx,w*.06,h*.975,w*.88,Math.max(4,h*.004),99);ctx.fill();ctx.fillStyle='#C6A96A';rounded(ctx,w*.06,h*.975,w*.88*(seconds/totalDuration),Math.max(4,h*.004),99);ctx.fill();
  }

  async function renderVideo(plan, frames, voiceBlob, format, requestedDuration, audioContext, onProgress) {
    if (!window.MediaRecorder) throw new Error('Ce navigateur ne permet pas encore l’export vidéo.');
    const images = await Promise.all(frames.map((frame) => loadImage(frame.dataUrl)));
    const audioBuffer = await audioContext.decodeAudioData(await voiceBlob.arrayBuffer());
    const totalDuration = Math.min(32,Math.max(Number(requestedDuration||15),audioBuffer.duration+.4));
    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource(); source.buffer=audioBuffer; source.connect(destination);
    const size=outputSize(format); const canvas=document.createElement('canvas'); canvas.width=size.width; canvas.height=size.height; const ctx=canvas.getContext('2d');
    const stream=canvas.captureStream(24); destination.stream.getAudioTracks().forEach((track)=>stream.addTrack(track));
    const mime=['video/webm;codecs=vp8,opus','video/webm'].find((type)=>MediaRecorder.isTypeSupported(type))||'';
    const chunks=[]; const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:4_000_000,audioBitsPerSecond:112_000}:undefined); recorder.ondataavailable=(event)=>{if(event.data?.size)chunks.push(event.data);}; recorder.start(400); source.start();
    const items=timeline(plan,totalDuration); const started=performance.now(); let lastUi=-1; let cancelled=false;
    await new Promise((resolve) => {
      const frame=(now)=>{const seconds=Math.min(totalDuration,(now-started)/1000);drawFrame(ctx,canvas,images,items,seconds,totalDuration);const pct=Math.round(seconds/totalDuration*100);if(pct>=lastUi+5||pct===100){lastUi=pct;onProgress?.(pct);}if(state.cancelled){cancelled=true;return resolve();}if(seconds>=totalDuration)return resolve();requestAnimationFrame(frame);};requestAnimationFrame(frame);
    });
    try{source.stop();}catch{}
    const blob=await new Promise((resolve)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||'video/webm'}));recorder.stop();});
    stream.getTracks().forEach((track)=>track.stop());
    if(cancelled)throw new Error('studio_cancelled');
    return {blob,duration:Math.round(totalDuration)};
  }

  function fileName(value){return String(value||'demo-velvet').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,65)||'demo-velvet';}

  async function runProduction() {
    if (state.running) return;
    const overlay=document.querySelector('[data-vsl-overlay]'); const brief=overlay?.querySelector('[data-vsl-prompt]')?.value.trim(); const format=overlay?.querySelector('[data-vsl-format]')?.value||'9:16'; const duration=Number(overlay?.querySelector('[data-vsl-duration]')?.value||15);
    if(!brief||brief.length<12)return;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){status('Le moteur audio du navigateur est indisponible.');return;}
    state.running=true;state.cancelled=false;state.controller=new AbortController();const audioContext=new Audio();await audioContext.resume();
    const button=overlay.querySelector('[data-vsl-run]');const title=overlay.querySelector('[data-vsl-title]');const copy=overlay.querySelector('[data-vsl-copy]');const actions=overlay.querySelector('[data-vsl-actions]');button.disabled=true;button.textContent='Production en cours…';actions.hidden=true;resetSteps();
    try{
      setStep('plan','active','L’IA écrit');title.textContent='Préparation de la démonstration';copy.textContent='Velvet choisit les écrans et rédige la narration.';await yieldToBrowser();
      const plan=await generatePlan(brief,format,duration);if(state.cancelled)throw new Error('studio_cancelled');setStep('plan','done','Scénario prêt');title.textContent=plan.title;copy.textContent=plan.voiceOver;
      setStep('screens','active','Ouverture de Velvet');setStep('voice','active','En parallèle');const voicePromise=generateVoice(plan.voiceOver);
      const frames=await captureScreens(plan,format,(current,total,dataUrl,view)=>{setStep('screens','active',`${current} / ${total}`);const preview=document.querySelector('[data-vsl-preview]');if(preview)preview.innerHTML=`<img src="${dataUrl}" alt="Écran ${esc(labels[view]||view)}"><div class="vsl-status">${esc(labels[view]||view)} · ${current}/${total}</div>`;});
      setStep('screens','done',`${frames.length} écrans`);const voice=await voicePromise;setStep('voice','done','Voix prête');if(state.cancelled)throw new Error('studio_cancelled');
      setStep('render','active','0 %');status('Montage fluide en cours…');const rendered=await renderVideo(plan,frames,voice,format,duration,audioContext,(pct)=>{setStep('render','active',`${pct} %`);status(`Montage et synchronisation · ${pct} %`);});setStep('render','done','Vidéo prête');
      if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);state.videoUrl=URL.createObjectURL(rendered.blob);const name=`${fileName(plan.title)}.webm`;const preview=document.querySelector('[data-vsl-preview]');if(preview)preview.innerHTML=`<video src="${state.videoUrl}" controls playsinline></video>`;actions.hidden=false;actions.innerHTML=`<a class="vsl-download" href="${state.videoUrl}" download="${esc(name)}">Télécharger la vidéo</a><button class="vsl-secondary" data-vsl-new>Créer une autre</button>`;title.textContent=plan.title;copy.textContent=`Vidéo terminée · ${rendered.duration} secondes · voix off incluse`;
    }catch(error){if(error.name!=='AbortError'&&error.message!=='studio_cancelled'){title.textContent='La production s’est arrêtée';copy.textContent=error.message||'Une erreur est survenue.';status(copy.textContent);}}
    finally{state.running=false;state.controller=null;button.disabled=false;button.textContent='Produire la démonstration';try{await audioContext.close();}catch{}}
  }

  document.addEventListener('click',(event)=>{
    if(event.target.closest('[data-vsl-open]')){event.preventDefault();openStudio(root.querySelector('[data-vsl-home-prompt]')?.value||'');return;}
    if(event.target.closest('[data-vsl-close]')){event.preventDefault();closeStudio();return;}
    if(event.target.closest('[data-vsl-run]')){event.preventDefault();runProduction();return;}
    if(event.target.closest('[data-vsl-new]')){const overlay=document.querySelector('[data-vsl-overlay]');overlay?.querySelector('[data-vsl-actions]')?.setAttribute('hidden','');const preview=overlay?.querySelector('[data-vsl-preview]');if(preview)preview.innerHTML='<div class="vsl-placeholder"><b>V</b><strong>Nouvelle démonstration</strong><p>Modifiez la demande puis relancez.</p></div>';resetSteps();}
  },true);

  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&document.querySelector('[data-vsl-overlay]'))closeStudio();});

  installStyles();
  let attempts=0;
  const timer=setInterval(()=>{attempts+=1;if(installStudio()||attempts>100)clearInterval(timer);},100);
  installStudio();
})();
