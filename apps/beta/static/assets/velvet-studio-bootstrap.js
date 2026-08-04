(() => {
  const root = document.querySelector('#controlApp');
  if (!root) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);

  function renderStudio() {
    root.innerHTML = `
      <section style="min-height:100vh;padding:34px;color:#F4F4F2;background:radial-gradient(circle at 80% 0,#641b3638,transparent 30%),#0D0D0D;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <header style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:26px">
          <div><p style="margin:0 0 9px;color:#C6A96A;text-transform:uppercase;letter-spacing:.18em;font-size:11px">Velvet Control · Marketing Intelligence</p><h1 style="margin:0;font:500 clamp(38px,5vw,64px)/1 Georgia,serif">Velvet Studio</h1><p style="max-width:760px;color:#c9c5c1;line-height:1.65">Crée les campagnes photo et vidéo de Velvet à partir des capacités réelles du site, avec contrôle de marque, scripts, storyboards et exports réseaux sociaux.</p></div>
          <button type="button" data-vsb-back style="border:1px solid #ffffff22;border-radius:999px;padding:11px 16px;background:#ffffff0b;color:#F4F4F2;cursor:pointer">Retour au pilotage</button>
        </header>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px">
          ${[['Campagnes','0','dans la bibliothèque'],['Prêtes','0','validées et exportables'],['En production','0','assets en cours'],['Coût engagé','0 €','gratuit-first actif']].map(([a,b,c])=>`<article style="border:1px solid #ffffff14;border-radius:22px;padding:19px;background:#ffffff08"><small style="color:#aaa">${esc(a)}</small><strong style="display:block;font-size:30px;margin:8px 0">${esc(b)}</strong><span style="color:#aaa">${esc(c)}</span></article>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1.15fr .85fr;gap:16px">
          <section style="border:1px solid #ffffff14;border-radius:24px;padding:22px;background:#ffffff08">
            <h2 style="margin-top:0;font:500 30px Georgia,serif">Créer une campagne</h2>
            <div style="display:grid;gap:13px">
              <label style="display:grid;gap:7px;color:#d8c69f;font-size:12px">Type<select data-vsb-type style="border:1px solid #ffffff1f;border-radius:14px;padding:12px;background:#09090b;color:white"><option>Film manifeste</option><option>Velvet Membres</option><option>Velvet Pro</option><option>Fonctionnalité</option><option>Événement</option></select></label>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"><label style="display:grid;gap:7px;color:#d8c69f;font-size:12px">Canal<select data-vsb-channel style="border:1px solid #ffffff1f;border-radius:14px;padding:12px;background:#09090b;color:white"><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>LinkedIn</option><option>YouTube Shorts</option></select></label><label style="display:grid;gap:7px;color:#d8c69f;font-size:12px">Format<select style="border:1px solid #ffffff1f;border-radius:14px;padding:12px;background:#09090b;color:white"><option>9:16</option><option>1:1</option><option>16:9</option></select></label><label style="display:grid;gap:7px;color:#d8c69f;font-size:12px">Ton<select style="border:1px solid #ffffff1f;border-radius:14px;padding:12px;background:#09090b;color:white"><option>Premium</option><option>Émotionnel</option><option>Business</option></select></label></div>
              <label style="display:grid;gap:7px;color:#d8c69f;font-size:12px">Objectif<textarea data-vsb-objective style="min-height:90px;border:1px solid #ffffff1f;border-radius:14px;padding:12px;background:#09090b;color:white">Présenter Velvet comme la nouvelle référence premium des rencontres libres.</textarea></label>
              <button type="button" data-vsb-generate style="border:0;border-radius:999px;padding:13px 18px;background:#C6A96A;color:#151515;font-weight:800;cursor:pointer">Générer le concept</button>
            </div>
          </section>
          <aside style="border:1px solid #ffffff14;border-radius:24px;padding:22px;background:#ffffff08"><h2 style="margin-top:0;font:500 30px Georgia,serif">Brand Guard</h2><div style="display:flex;gap:18px;align-items:center"><div style="display:grid;place-items:center;width:88px;height:88px;border-radius:50%;border:7px solid #C6A96A;font-size:23px;font-weight:800">92</div><div><strong>Identité maîtrisée</strong><p style="color:#aaa;line-height:1.55">Confiance, consentement, discrétion, élégance et promesses vérifiables.</p></div></div><hr style="border:0;border-top:1px solid #ffffff12;margin:22px 0"><h3>Moteurs actifs</h3><p style="color:#aaa">Captures Velvet · FFmpeg / Remotion · fournisseurs gratuits en priorité.</p></aside>
        </div>
        <section data-vsb-result style="display:none;margin-top:16px;border:1px solid #c6a96a55;border-radius:24px;padding:22px;background:#ffffff08"></section>
      </section>`;

    root.querySelector('[data-vsb-generate]')?.addEventListener('click', () => {
      const type = root.querySelector('[data-vsb-type]')?.value || 'Film manifeste';
      const channel = root.querySelector('[data-vsb-channel]')?.value || 'Instagram';
      const objective = root.querySelector('[data-vsb-objective]')?.value || '';
      const result = root.querySelector('[data-vsb-result]');
      result.style.display = 'block';
      result.innerHTML = `<p style="color:#C6A96A;text-transform:uppercase;letter-spacing:.16em;font-size:11px">Concept généré</p><h2 style="font:500 34px Georgia,serif">Le libertinage évolue.</h2><p style="color:#ccc;line-height:1.65"><strong>${esc(type)} · ${esc(channel)}</strong><br>${esc(objective)}</p><ol style="color:#bbb;line-height:1.8"><li>Ouverture par le ruban Velvet et la signature de marque.</li><li>Captures réelles : découverte, événements, messagerie et confiance.</li><li>Passage Velvet Pro : gestion, réservations et pilotage.</li><li>Conclusion : « Là où les plus belles rencontres commencent. »</li></ol>`;
    });

    root.querySelector('[data-vsb-back]')?.addEventListener('click', () => location.reload());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function install() {
    if (document.querySelector('[data-velvet-studio-bootstrap]')) return;
    const buttons = [...document.querySelectorAll('button')];
    const communications = buttons.find((button) => /communications/i.test(button.textContent || ''));
    const nav = communications?.parentElement || document.querySelector('header nav') || document.querySelector('nav');
    if (!nav) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.velvetStudioBootstrap = 'true';
    button.className = communications?.className || '';
    button.innerHTML = '<span aria-hidden="true">✦</span><span>Velvet Studio</span>';
    button.addEventListener('click', renderStudio);
    communications ? communications.insertAdjacentElement('afterend', button) : nav.appendChild(button);
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  install();
})();