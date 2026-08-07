(() => {
  const studioApi = async (body) => {
    const response = await fetch('/api/control/studio', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'studio_request_failed');
    return payload;
  };

  function toast(message, tone = 'ok') {
    let node = document.querySelector('#velvetStudioToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'velvetStudioToast';
      Object.assign(node.style, {
        position: 'fixed', right: '18px', bottom: '18px', zIndex: '10050', maxWidth: '390px',
        padding: '13px 16px', borderRadius: '16px', color: '#F4F4F2', font: '600 13px/1.4 Inter,Arial',
        boxShadow: '0 18px 60px #0009', transition: 'opacity .2s ease'
      });
      document.body.appendChild(node);
    }
    node.style.background = tone === 'error' ? '#641B36' : '#1B1B1D';
    node.style.border = `1px solid ${tone === 'error' ? '#a6526d' : '#C6A96A55'}`;
    node.textContent = message;
    node.style.opacity = '1';
    clearTimeout(node._timer);
    node._timer = setTimeout(() => { node.style.opacity = '0'; }, 4200);
  }

  function currentBrief() {
    const value = (name, fallback = '') => document.querySelector(`[data-vs-input="${name}"]`)?.value || fallback;
    return {
      audience: value('template', 'manifesto'),
      channel: value('channel', 'Instagram'),
      format: value('format', '9:16'),
      tone: value('tone', 'Premium'),
      objective: value('objective'),
      feature: value('feature')
    };
  }

  function promptPanel(prompt, generative) {
    const scenes = Array.isArray(prompt.scenes) ? prompt.scenes : [];
    const old = document.querySelector('#velvetStudioAiResult');
    if (old) old.remove();
    const panel = document.createElement('section');
    panel.id = 'velvetStudioAiResult';
    panel.className = 'vs-card';
    panel.style.marginTop = '16px';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div><p class="vs-eyebrow">Copilote créatif ${generative ? 'IA générative' : 'moteur Zwit local'}</p><h2>${escapeHtml(prompt.title || 'Concept Zwit')}</h2><p>${escapeHtml(prompt.hook || '')}</p></div>
        <div class="vs-actions"><button class="vs-btn secondary" type="button" data-vs-copy-prompt>Copier le prompt</button><button class="vs-btn secondary" type="button" data-vs-export-ai>Exporter JSON</button></div>
      </div>
      <div class="vs-grid two">
        <div><h3>Prompt maître</h3><textarea readonly style="width:100%;min-height:220px;box-sizing:border-box;border-radius:16px;border:1px solid #ffffff1f;background:#09090b;color:#F4F4F2;padding:14px">${escapeHtml(prompt.masterPrompt || '')}</textarea></div>
        <div><h3>Voix off</h3><p>${escapeHtml(prompt.voiceOver || '')}</p><h3>À éviter</h3><p>${escapeHtml(prompt.negativePrompt || '')}</p></div>
      </div>
      <div class="vs-story">${scenes.map((scene) => `<article class="vs-scene"><time>${escapeHtml(scene.seconds || '')}</time><div><b>${escapeHtml(scene.visual || '')}</b><span>${escapeHtml(scene.message || '')}</span></div></article>`).join('')}</div>`;
    const page = document.querySelector('.vs-page');
    page?.appendChild(panel);
    panel.querySelector('[data-vs-copy-prompt]')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(prompt.masterPrompt || '');
      toast('Prompt Zwit copié.');
    });
    panel.querySelector('[data-vs-export-ai]')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `velvet-studio-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  }

  async function generatePrompt(button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'L’IA construit la campagne…';
    try {
      const result = await studioApi({ action: 'generate_prompt', brief: currentBrief() });
      promptPanel(result.prompt, result.generative);
      toast(result.generative ? 'Concept généré par Zwit IA.' : 'Concept généré par le moteur Zwit local.');
    } catch (error) {
      toast(`Génération impossible : ${error.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function startCapture(button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Préparation du membre démo…';
    try {
      const result = await studioApi({ action: 'capture_session' });
      sessionStorage.setItem('velvet_capture_session', JSON.stringify({ token: result.token, expiresAt: result.expiresAt, syntheticOnly: true }));
      window.open(result.url, 'velvetCapture', 'noopener');
      toast('Mode Capture ouvert avec données synthétiques uniquement.');
    } catch (error) {
      toast(`Mode Capture indisponible : ${error.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function enhance() {
    const page = document.querySelector('.vs-page');
    if (!page) return;
    const generate = page.querySelector('[data-vs-generate]');
    if (generate && !generate.dataset.vsAiBound) {
      generate.dataset.vsAiBound = 'true';
      generate.textContent = 'Générer avec l’IA Zwit';
      generate.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        generatePrompt(generate);
      }, true);
    }
    const actions = page.querySelector('.vs-head .vs-actions');
    if (actions && !actions.querySelector('[data-vs-capture]')) {
      const capture = document.createElement('button');
      capture.type = 'button';
      capture.className = 'vs-btn secondary';
      capture.dataset.vsCapture = 'true';
      capture.textContent = 'Ouvrir Zwit en mode Capture';
      capture.addEventListener('click', () => startCapture(capture));
      actions.prepend(capture);
    }
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
