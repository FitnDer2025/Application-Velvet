(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const PROJECTS_KEY = 'velvet_studio_sprint1_projects_v2';
  const ACTIVE_KEY = 'velvet_studio_sprint1_active_v2';
  const RENDER_KEY = 'velvet_studio_v2_render_history';
  const FPS = 30;
  const MAX_RENDER_SECONDS = 90;

  const runtime = {
    raf: 0,
    playing: false,
    startedAt: 0,
    playhead: 0,
    audio: null,
    musicNodes: [],
    renderRecorder: null,
    renderChunks: [],
    rendering: false,
    lastFrameAt: 0,
    mediaCache: new Map(),
    capability: null
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function readProjects() {
    try {
      const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      return Array.isArray(projects) ? projects : [];
    } catch {
      return [];
    }
  }

  function currentProject() {
    const projects = readProjects();
    const id = localStorage.getItem(ACTIVE_KEY);
    return projects.find((item) => item.id === id) || projects[0] || null;
  }

  function totalDuration(project) {
    return Math.min(MAX_RENDER_SECONDS, (project?.scenes || []).reduce((sum, scene) => sum + Number(scene.duration || 0), 0));
  }

  function sceneAt(project, seconds) {
    let cursor = 0;
    for (let index = 0; index < (project?.scenes || []).length; index += 1) {
      const scene = project.scenes[index];
      const duration = Math.max(0.25, Number(scene.duration || 0));
      if (seconds < cursor + duration || index === project.scenes.length - 1) {
        return { scene, index, local: clamp((seconds - cursor) / duration, 0, 1), start: cursor, duration };
      }
      cursor += duration;
    }
    return { scene: null, index: 0, local: 0, start: 0, duration: 1 };
  }

  function formatSize(format) {
    if (format === '16:9') return { width: 1280, height: 720, css: 'wide' };
    if (format === '1:1') return { width: 1080, height: 1080, css: 'square' };
    return { width: 720, height: 1280, css: 'vertical' };
  }

  function ensureAudio() {
    if (!runtime.audio) runtime.audio = new (window.AudioContext || window.webkitAudioContext)();
    if (runtime.audio.state === 'suspended') runtime.audio.resume();
    return runtime.audio;
  }

  function stopAudio() {
    runtime.musicNodes.forEach((node) => {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    });
    runtime.musicNodes = [];
  }

  function musicProfile(project) {
    const music = project?.music || {};
    return {
      tempo: clamp(music.tempo || 92, 60, 150),
      intensity: clamp(music.intensity || 58, 1, 100) / 100,
      genre: String(music.genre || 'Cinématographique premium'),
      ducking: 0.72
    };
  }

  function startMusic(project, destination = null, offset = 0) {
    stopAudio();
    const ctx = ensureAudio();
    const profile = musicProfile(project);
    const master = ctx.createGain();
    master.gain.value = 0.13 * profile.intensity;
    master.connect(ctx.destination);
    if (destination) master.connect(destination);
    runtime.musicNodes.push(master);

    const beat = 60 / profile.tempo;
    const base = /electro|club/i.test(profile.genre) ? 55 : 65.41;
    const scheduleUntil = ctx.currentTime + Math.min(totalDuration(project), MAX_RENDER_SECONDS) + 1;

    for (let time = ctx.currentTime - (offset % beat); time < scheduleUntil; time += beat) {
      const kick = ctx.createOscillator();
      const gain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(base * 2.2, time);
      kick.frequency.exponentialRampToValueAtTime(base * 0.75, time + 0.12);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.22 * profile.intensity, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
      kick.connect(gain).connect(master);
      kick.start(time);
      kick.stop(time + 0.24);
      runtime.musicNodes.push(kick, gain);
    }

    const chords = [0, 3, 7, 10];
    chords.forEach((semitone, index) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = index % 2 ? 'triangle' : 'sine';
      osc.frequency.value = 130.81 * Math.pow(2, semitone / 12);
      filter.type = 'lowpass';
      filter.frequency.value = 620 + profile.intensity * 1400;
      gain.gain.value = (0.025 + profile.intensity * 0.035) / (index + 1);
      osc.connect(filter).connect(gain).connect(master);
      osc.start();
      runtime.musicNodes.push(osc, filter, gain);
    });

    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 880;
    shimmerGain.gain.value = 0.008 * profile.intensity;
    shimmer.connect(shimmerGain).connect(master);
    shimmer.start();
    runtime.musicNodes.push(shimmer, shimmerGain);
    return master;
  }

  function speakVoice(project) {
    if (!('speechSynthesis' in window)) return notify('Synthèse vocale indisponible sur ce navigateur.', 'error');
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(project?.voiceOver || 'Velvet. Là où les plus belles rencontres commencent.');
    utterance.lang = 'fr-FR';
    utterance.rate = clamp(project?.voice?.pace || 0.95, 0.65, 1.25);
    utterance.pitch = /mascul/i.test(project?.voice?.gender || '') ? 0.78 : 1.08;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('fr')) || null;
    speechSynthesis.speak(utterance);
    notify('Voix off générée localement pour prévisualisation.');
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
  }

  function drawProductMock(ctx, x, y, width, height, scene, progress) {
    const deviceX = x + width * (0.05 + progress * 0.025);
    const deviceY = y + height * 0.06;
    const deviceW = width * 0.9;
    const deviceH = height * 0.88;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#111114';
    roundedRect(ctx, deviceX, deviceY, deviceW, deviceH, width * 0.045);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const pad = deviceW * 0.055;
    ctx.fillStyle = '#641B36';
    roundedRect(ctx, deviceX + pad, deviceY + pad, deviceW - pad * 2, deviceH * 0.16, 18);
    ctx.fill();
    ctx.fillStyle = '#C6A96A';
    ctx.font = `700 ${Math.max(15, width * 0.025)}px Georgia`;
    ctx.fillText('VELVET', deviceX + pad * 1.5, deviceY + pad + deviceH * 0.09);

    const cards = 4;
    for (let i = 0; i < cards; i += 1) {
      const cardW = (deviceW - pad * 2.6) / 2;
      const cardH = deviceH * 0.25;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = deviceX + pad + col * (cardW + pad * 0.6);
      const cy = deviceY + deviceH * 0.24 + row * (cardH + pad * 0.55);
      const gradient = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      gradient.addColorStop(0, i % 2 ? '#34252b' : '#4f1d32');
      gradient.addColorStop(1, '#18181b');
      ctx.fillStyle = gradient;
      roundedRect(ctx, cx, cy, cardW, cardH, 18);
      ctx.fill();
      ctx.fillStyle = 'rgba(244,244,242,.88)';
      ctx.font = `600 ${Math.max(11, width * 0.018)}px Inter, sans-serif`;
      ctx.fillText(i % 2 ? 'Événement premium' : 'Profil vérifié', cx + 14, cy + cardH - 24);
      ctx.fillStyle = '#C6A96A';
      ctx.font = `500 ${Math.max(9, width * 0.014)}px Inter, sans-serif`;
      ctx.fillText(i % 2 ? 'Près de chez vous' : 'Confiance 94 %', cx + 14, cy + cardH - 8);
    }
    ctx.restore();
  }

  function drawNoise(ctx, width, height, strength = 0.045) {
    ctx.save();
    ctx.globalAlpha = strength;
    for (let i = 0; i < 220; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const value = 180 + Math.random() * 75;
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    ctx.restore();
  }

  function drawFrame(canvas, project, seconds) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const active = sceneAt(project, seconds);
    const scene = active.scene || {};
    const palette = scene.palette || ['#0D0D0D', '#641B36'];
    const eased = active.local * active.local * (3 - 2 * active.local);

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, palette[0] || '#0D0D0D');
    background.addColorStop(1, palette[1] || '#641B36');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * (0.75 + eased * 0.05), height * 0.16, 0, width * 0.75, height * 0.16, width * 0.8);
    glow.addColorStop(0, 'rgba(198,169,106,.23)');
    glow.addColorStop(1, 'rgba(198,169,106,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * (0.9 - eased * 0.08), height * 0.13);
    ctx.rotate(0.35);
    ctx.strokeStyle = 'rgba(139,49,81,.78)';
    ctx.lineWidth = Math.max(38, width * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.34, height * 0.64, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const safeX = width * 0.07;
    const safeW = width * 0.86;
    const visualTop = height * 0.12;
    const visualH = height * 0.48;
    drawProductMock(ctx, safeX, visualTop, safeW, visualH, scene, eased);

    const lower = height * 0.67;
    ctx.fillStyle = '#C6A96A';
    ctx.font = `700 ${Math.max(13, width * 0.022)}px Inter, sans-serif`;
    ctx.letterSpacing = `${Math.max(1, width * 0.002)}px`;
    ctx.fillText(`SCÈNE ${String(active.index + 1).padStart(2, '0')} · VELVET`, safeX, lower);

    ctx.fillStyle = '#F4F4F2';
    ctx.font = `500 ${Math.max(34, width * 0.065)}px Georgia`;
    wrapText(ctx, scene.title || 'Velvet', safeX, lower + height * 0.055, safeW, height * 0.055, 2);

    ctx.fillStyle = 'rgba(244,244,242,.82)';
    ctx.font = `500 ${Math.max(18, width * 0.031)}px Inter, sans-serif`;
    wrapText(ctx, scene.text || scene.visual || '', safeX, lower + height * 0.19, safeW, height * 0.038, 3);

    const progressY = height * 0.94;
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    roundedRect(ctx, safeX, progressY, safeW, Math.max(5, height * 0.006), 999);
    ctx.fill();
    ctx.fillStyle = '#C6A96A';
    roundedRect(ctx, safeX, progressY, safeW * clamp(seconds / Math.max(totalDuration(project), 1), 0, 1), Math.max(5, height * 0.006), 999);
    ctx.fill();

    const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, height * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    drawNoise(ctx, width, height);

    const monitor = document.querySelector('[data-v2-time]');
    if (monitor) monitor.textContent = `${seconds.toFixed(1)} s / ${totalDuration(project).toFixed(1)} s`;
    const sceneLabel = document.querySelector('[data-v2-scene]');
    if (sceneLabel) sceneLabel.textContent = scene.title || 'Scène';
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let lines = 0;
    for (let index = 0; index < words.length; index += 1) {
      const test = `${line}${words[index]} `;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, y + lines * lineHeight);
        line = `${words[index]} `;
        lines += 1;
        if (lines >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (lines < maxLines) ctx.fillText(line.trim(), x, y + lines * lineHeight);
  }

  function stopPlayback() {
    runtime.playing = false;
    cancelAnimationFrame(runtime.raf);
    stopAudio();
    document.querySelector('[data-v2-play]')?.classList.remove('is-playing');
  }

  function startPlayback(from = 0) {
    const project = currentProject();
    const canvas = document.querySelector('[data-v2-canvas]');
    if (!project || !canvas) return;
    stopPlayback();
    runtime.playing = true;
    runtime.playhead = clamp(from, 0, totalDuration(project));
    runtime.startedAt = performance.now() - runtime.playhead * 1000;
    startMusic(project, null, runtime.playhead);
    document.querySelector('[data-v2-play]')?.classList.add('is-playing');

    const loop = (now) => {
      if (!runtime.playing) return;
      runtime.playhead = (now - runtime.startedAt) / 1000;
      if (runtime.playhead >= totalDuration(project)) {
        runtime.playhead = totalDuration(project);
        drawFrame(canvas, project, runtime.playhead);
        stopPlayback();
        return;
      }
      drawFrame(canvas, project, runtime.playhead);
      runtime.raf = requestAnimationFrame(loop);
    };
    runtime.raf = requestAnimationFrame(loop);
  }

  async function createRenderManifest(project) {
    const local = {
      id: uid('render'),
      projectId: project.id,
      createdAt: new Date().toISOString(),
      duration: totalDuration(project),
      format: project.format || '9:16',
      fps: FPS,
      scenes: project.scenes.map((scene, index) => ({
        index, id: scene.id, duration: Number(scene.duration || 0), visualPrompt: scene.prompt || scene.visual,
        overlay: scene.text || '', transition: scene.transition || 'Velvet Fade'
      })),
      voice: { ...project.voice, text: project.voiceOver || '' },
      music: { ...project.music },
      brandGuard: ['adult_only', 'non_explicit', 'consent', 'privacy', 'velvet_palette'],
      provider: 'velvet-browser-renderer-v2'
    };
    try {
      const response = await fetch('/api/control/studio-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'render_manifest', project })
      });
      if (response.ok) return (await response.json()).manifest || local;
    } catch {}
    return local;
  }

  async function renderVideo() {
    if (runtime.rendering) return;
    const project = currentProject();
    const canvas = document.querySelector('[data-v2-canvas]');
    if (!project || !canvas || !canvas.captureStream || !window.MediaRecorder) {
      return notify('Le rendu vidéo nécessite un navigateur compatible MediaRecorder.', 'error');
    }
    runtime.rendering = true;
    stopPlayback();
    const manifest = await createRenderManifest(project);
    const progress = document.querySelector('[data-v2-render-progress]');
    const label = document.querySelector('[data-v2-render-label]');
    progress.hidden = false;
    label.textContent = 'Préparation du rendu…';

    const ctx = ensureAudio();
    const destination = ctx.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(FPS);
    startMusic(project, destination, 0);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks()
    ]);
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type)) || '';
    runtime.renderChunks = [];
    runtime.renderRecorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
    runtime.renderRecorder.ondataavailable = (event) => { if (event.data?.size) runtime.renderChunks.push(event.data); };
    runtime.renderRecorder.onstop = () => {
      const blob = new Blob(runtime.renderChunks, { type: runtime.renderRecorder.mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${String(project.title || 'velvet-v2').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const history = readRenderHistory();
      history.unshift({ ...manifest, status: 'completed', bytes: blob.size });
      localStorage.setItem(RENDER_KEY, JSON.stringify(history.slice(0, 20)));
      runtime.rendering = false;
      progress.hidden = true;
      stopAudio();
      notify('Vidéo V2 rendue avec musique et motion design.');
      refreshHistory();
    };

    runtime.renderRecorder.start(1000);
    const started = performance.now();
    const duration = Math.max(1, totalDuration(project));
    const renderLoop = (now) => {
      const seconds = Math.min(duration, (now - started) / 1000);
      drawFrame(canvas, project, seconds);
      const ratio = seconds / duration;
      progress.querySelector('i').style.width = `${ratio * 100}%`;
      label.textContent = `Rendu temps réel ${Math.round(ratio * 100)} % · ${sceneAt(project, seconds).scene?.title || ''}`;
      if (seconds >= duration) {
        runtime.renderRecorder.stop();
        canvasStream.getTracks().forEach((track) => track.stop());
        destination.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);
  }

  function readRenderHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(RENDER_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function refreshHistory() {
    const node = document.querySelector('[data-v2-history]');
    if (!node) return;
    const history = readRenderHistory();
    node.innerHTML = history.length ? history.map((item) => `
      <article><span class="vs2-dot done"></span><div><strong>${esc(item.status === 'completed' ? 'Rendu terminé' : item.status)}</strong><small>${new Date(item.createdAt).toLocaleString('fr-FR')} · ${esc(item.format)} · ${Number(item.duration || 0).toFixed(0)} s</small></div><b>${item.bytes ? `${(item.bytes / 1024 / 1024).toFixed(1)} Mo` : esc(item.provider || '')}</b></article>
    `).join('') : '<p class="vs2-empty">Aucun rendu V2 pour le moment.</p>';
  }

  async function loadCapabilities() {
    try {
      const response = await fetch('/api/control/studio-v2', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ action: 'capabilities' })
      });
      if (response.ok) runtime.capability = await response.json();
    } catch {}
    renderCapabilities();
  }

  function renderCapabilities() {
    const target = document.querySelector('[data-v2-capabilities]');
    if (!target) return;
    const providers = runtime.capability?.providers || [
      { name: 'Compositor Velvet', status: 'ready', mode: 'local' },
      { name: 'Voix navigateur', status: 'ready', mode: 'local' },
      { name: 'Musique procédurale', status: 'ready', mode: 'local' },
      { name: 'Vidéo générative', status: 'disabled', mode: 'optionnel' }
    ];
    target.innerHTML = providers.map((provider) => `
      <div><span class="vs2-dot ${provider.status === 'ready' ? 'done' : provider.status === 'configured' ? 'warn' : ''}"></span><p><strong>${esc(provider.name)}</strong><small>${esc(provider.mode || provider.status)}</small></p><b>${esc(provider.status)}</b></div>
    `).join('');
  }

  function notify(message, tone = 'ok') {
    let node = document.querySelector('#vs2Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vs2Toast';
      document.body.appendChild(node);
    }
    node.className = `vs2-toast ${tone}`;
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('show'));
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function openDesk() {
    const project = currentProject();
    if (!project) return notify('Ouvre d’abord un projet Velvet Studio.', 'error');
    closeDesk();
    const size = formatSize(project.format);
    const modal = document.createElement('section');
    modal.className = 'vs2-desk';
    modal.dataset.velvetStudioV2 = 'true';
    modal.innerHTML = `
      <header class="vs2-head">
        <div><span class="vs2-mark">V2</span><p><strong>Velvet Studio · Réalisation temps réel</strong><small>${esc(project.title)} · ${esc(project.format)} · ${totalDuration(project).toFixed(0)} s</small></p></div>
        <div class="vs2-head-actions"><button data-v2-voice>Voix OFF</button><button data-v2-play>▶ Prévisualiser</button><button class="primary" data-v2-render>Rendre la vidéo</button><button class="close" data-v2-close>×</button></div>
      </header>
      <main class="vs2-layout">
        <aside class="vs2-sidebar">
          <section><span class="vs2-kicker">Pipeline IA</span><h2>Production</h2><div class="vs2-pipeline">
            ${['Direction créative','Compositing temps réel','Voix OFF','Musique originale','Montage & sous-titres','Contrôle de marque'].map((label, index) => `<article><span class="vs2-dot ${index < 2 ? 'done' : index < 5 ? 'warn' : ''}"></span><div><strong>${label}</strong><small>${index < 2 ? 'Opérationnel' : index < 5 ? 'Prêt à générer' : 'Validation finale'}</small></div></article>`).join('')}
          </div></section>
          <section><span class="vs2-kicker">Moteurs</span><div class="vs2-capabilities" data-v2-capabilities></div></section>
        </aside>
        <section class="vs2-monitor-column">
          <div class="vs2-monitor-head"><div><span class="vs2-live"></span><strong data-v2-scene>Moniteur réalisateur</strong></div><span data-v2-time>0.0 s</span></div>
          <div class="vs2-monitor ${size.css}"><canvas data-v2-canvas width="${size.width}" height="${size.height}"></canvas><div class="vs2-safe-area"></div></div>
          <div class="vs2-render-progress" data-v2-render-progress hidden><div><i></i></div><span data-v2-render-label>Préparation…</span></div>
          <div class="vs2-scene-strip">${(project.scenes || []).map((scene, index) => `<button data-v2-seek="${project.scenes.slice(0,index).reduce((sum,item)=>sum+Number(item.duration||0),0)}"><span>${String(index + 1).padStart(2,'0')}</span><strong>${esc(scene.title)}</strong><small>${Number(scene.duration || 0)} s</small></button>`).join('')}</div>
        </section>
        <aside class="vs2-inspector">
          <section><span class="vs2-kicker">Direction sonore</span><h2>Voix & musique</h2><div class="vs2-sound-card"><strong>${esc(project.voice?.gender || 'Féminine')} · ${esc(project.voice?.tone || 'Chaleureuse')}</strong><p>${esc(project.voiceOver || '')}</p><button data-v2-voice>Écouter la voix</button></div><div class="vs2-sound-card"><strong>${esc(project.music?.genre || 'Cinématographique')}</strong><p>${esc(project.music?.instruments || 'Piano feutré, basse et textures')}</p><div><span>${Number(project.music?.tempo || 92)} BPM</span><span>Intensité ${Number(project.music?.intensity || 58)} %</span></div></div></section>
          <section><span class="vs2-kicker">Historique</span><div class="vs2-history" data-v2-history></div></section>
        </aside>
      </main>`;
    document.body.appendChild(modal);
    document.body.classList.add('vs2-open');
    const canvas = modal.querySelector('[data-v2-canvas]');
    drawFrame(canvas, project, 0);
    refreshHistory();
    loadCapabilities();
    bindDesk(modal);
  }

  function closeDesk() {
    stopPlayback();
    speechSynthesis?.cancel?.();
    document.querySelector('[data-velvet-studio-v2]')?.remove();
    document.body.classList.remove('vs2-open');
  }

  function bindDesk(modal) {
    modal.querySelector('[data-v2-close]')?.addEventListener('click', closeDesk);
    modal.querySelectorAll('[data-v2-voice]').forEach((button) => button.addEventListener('click', () => speakVoice(currentProject())));
    modal.querySelector('[data-v2-play]')?.addEventListener('click', () => runtime.playing ? stopPlayback() : startPlayback(0));
    modal.querySelector('[data-v2-render]')?.addEventListener('click', renderVideo);
    modal.querySelectorAll('[data-v2-seek]').forEach((button) => button.addEventListener('click', () => {
      const seconds = Number(button.dataset.v2Seek || 0);
      stopPlayback();
      runtime.playhead = seconds;
      drawFrame(modal.querySelector('[data-v2-canvas]'), currentProject(), seconds);
    }));
  }

  function installButton() {
    const shell = root.querySelector('.vs1-shell');
    if (!shell) return;
    const target = shell.querySelector('.vs1-top-actions,.vs1-editor-actions');
    if (!target || target.querySelector('[data-open-v2]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vs1-btn primary vs2-launch';
    button.dataset.openV2 = 'true';
    button.innerHTML = '<span>◉</span> Réalisation V2';
    button.addEventListener('click', openDesk);
    target.prepend(button);
    const badge = document.createElement('span');
    badge.className = 'vs2-ready-badge';
    badge.textContent = 'V2 REALTIME';
    shell.querySelector('.vs1-brand')?.appendChild(badge);
  }

  const observer = new MutationObserver(() => requestAnimationFrame(installButton));
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('pagehide', closeDesk);
  installButton();
})();
