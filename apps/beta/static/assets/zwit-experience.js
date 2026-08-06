(() => {
  'use strict';
  if (window.__ZWIT_EXPERIENCE_V2__) return;
  window.__ZWIT_EXPERIENCE_V2__ = true;

  const openingWords = ['Chut', 'Silencio', 'Silenzio', '嘘'];
  const logoSource = window.ZWIT_BRAND?.assets?.splash || '/assets/zwit-logo-transparent.png?v=20260806-9';
  const state = { profileId: '' };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function toast(message, error = false) {
    const existing = document.querySelector('#toast');
    if (existing) {
      existing.textContent = message;
      existing.classList.add('show');
      setTimeout(() => existing.classList.remove('show'), 3800);
      return;
    }
    const node = document.createElement('div');
    node.className = `zwit-toast${error ? ' error' : ''}`;
    node.textContent = message;
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => node.remove(), 4200);
  }

  function removeLegacyFloatingBrand() {
    document.querySelectorAll('.zwit-global-brand,[data-zwit-global-brand]').forEach((node) => node.remove());
  }

  function showOpening() {
    if (!/^\/(?:$|membres|pro|acces-prive)/.test(location.pathname)) return;
    if (sessionStorage.getItem('zwit-opening-v2-seen') === '1') return;
    sessionStorage.setItem('zwit-opening-v2-seen', '1');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = document.createElement('div');
    layer.className = `zwit-opening-v2${reduced ? ' reduced' : ''}`;
    layer.innerHTML = `
      <div class="zwit-word-stage" aria-live="polite">
        ${openingWords.map((word, index) => `<div class="zwit-word" style="--step:${index}"><strong>${escapeHTML(word)}</strong></div>`).join('')}
      </div>
      <div class="zwit-fog"><i></i><i></i><i></i><i></i></div>
      <div class="zwit-logo-reveal"><img src="${logoSource}" alt="Zwit"><small>Un secret se partage. Jamais il ne s’impose.</small></div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));
    setTimeout(() => layer.classList.add('fogging'), reduced ? 900 : 4300);
    setTimeout(() => layer.classList.add('revealed'), reduced ? 1050 : 5100);
    setTimeout(() => {
      layer.classList.add('leaving');
      setTimeout(() => layer.remove(), 850);
    }, reduced ? 1900 : 7200);
  }

  function parsedMessageDate(message) {
    const time = message.querySelector('time[datetime], time');
    const raw = message.dataset.createdAt || message.dataset.messageCreatedAt || time?.dateTime || time?.getAttribute('datetime');
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dayDate(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Aujourd’hui';
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(date);
  }

  function patchMessages() {
    const candidates = [...document.querySelectorAll('[data-message-id], .message-row, .chat-message, .message-bubble')]
      .filter((node) => parsedMessageDate(node));
    let previousDay = '';
    candidates.forEach((message) => {
      const date = parsedMessageDate(message);
      if (!date) return;
      const day = date.toDateString();
      if (day !== previousDay && !message.previousElementSibling?.classList.contains('zwit-day-separator')) {
        const separator = document.createElement('div');
        separator.className = 'zwit-day-separator';
        separator.textContent = dayDate(date);
        message.before(separator);
      }
      previousDay = day;
      message.classList.remove('zwit-dated-message');
      delete message.dataset.zwitFullDate;
      message.removeAttribute('aria-label');
    });
  }

  function currentProfileId(container) {
    return state.profileId || container?.dataset.profileId || container?.querySelector('[data-profile-id]')?.dataset.profileId || '';
  }

  async function requestAlbum(profileId) {
    const conversation = await api('/api/members/conversations', { method:'POST', body: JSON.stringify({ profileId }) });
    await api('/api/members/messages', {
      method:'POST',
      body: JSON.stringify({ conversationId: conversation.conversationId, body: '🔐 Votre profil nous plaît. Accepteriez-vous de nous ouvrir l’un de vos albums privés ?' })
    });
    toast('La demande d’ouverture a été envoyée dans votre conversation privée.');
  }

  async function openMyAlbums(profileId) {
    const payload = await api('/api/members/profile');
    const albums = (payload.profile?.albums || []).filter((album) => album.confidentiality !== 'public');
    if (!albums.length) throw new Error('no_private_albums');
    const modal = document.createElement('section');
    modal.className = 'zwit-album-modal';
    modal.innerHTML = `<div><header><span>ACCÈS PRIVÉ</span><h2>Ouvrir mes albums</h2><button type="button" data-close>×</button></header><p>Choisis les albums à ouvrir et la durée d’accès.</p><div class="zwit-album-list">${albums.map((album) => `<label><input type="checkbox" value="${escapeHTML(album.id)}"><span><b>${escapeHTML(album.name)}</b><small>${(album.media_assets || album.mediaAssets || []).length} média(s)</small></span></label>`).join('')}</div><select data-duration><option value="1">1 heure</option><option value="4" selected>4 heures</option><option value="12">12 heures</option><option value="24">24 heures</option><option value="permanent">Permanent</option></select><button type="button" class="primary" data-grant>Autoriser l’accès</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
    modal.querySelector('[data-grant]').onclick = async (event) => {
      const albumIds = [...modal.querySelectorAll('input:checked')].map((input) => input.value);
      if (!albumIds.length) return toast('Sélectionne au moins un album.', true);
      event.currentTarget.disabled = true;
      try {
        await api('/api/members/album-access', { method:'POST', body: JSON.stringify({ albumIds, profileId, duration: modal.querySelector('[data-duration]').value }) });
        modal.remove();
        toast('Tes albums privés sont maintenant ouverts à ce profil.');
      } catch {
        event.currentTarget.disabled = false;
        toast('L’accès n’a pas pu être accordé.', true);
      }
    };
  }

  function patchProfileActions() {
    const dialogs = [...document.querySelectorAll('[role="dialog"], .profile-modal, .member-profile, .profile-page')]
      .filter((node) => node.offsetParent !== null);
    dialogs.forEach((container) => {
      if (container.querySelector('[data-zwit-album-actions]')) return;
      const profileId = currentProfileId(container);
      if (!profileId) return;
      const host = container.querySelector('.profile-actions, .actions, footer') || container;
      const panel = document.createElement('div');
      panel.className = 'zwit-profile-album-actions';
      panel.dataset.zwitAlbumActions = '1';
      panel.innerHTML = '<button type="button" data-request-album>Demander l’ouverture d’un album</button><button type="button" data-open-my-albums>Ouvrir mes albums privés</button>';
      host.appendChild(panel);
      panel.querySelector('[data-request-album]').onclick = (event) => {
        event.currentTarget.disabled = true;
        requestAlbum(profileId).catch(() => toast('La demande n’a pas pu être envoyée.', true)).finally(() => { event.currentTarget.disabled = false; });
      };
      panel.querySelector('[data-open-my-albums]').onclick = () => openMyAlbums(profileId).catch((error) => toast(error.message === 'no_private_albums' ? 'Crée d’abord un album privé depuis ta fiche.' : 'Tes albums n’ont pas pu être chargés.', true));
    });
  }

  function patch() {
    removeLegacyFloatingBrand();
    patchMessages();
    patchProfileActions();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-profile]');
    if (trigger?.dataset.openProfile) state.profileId = trigger.dataset.openProfile;
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .zwit-opening-v2{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 45%,#30131f 0,#0c0b0e 45%,#020203 100%);color:#f5efe9;opacity:0;transition:opacity .65s}.zwit-opening-v2.visible{opacity:1}.zwit-opening-v2.leaving{opacity:0}.zwit-word-stage{position:absolute;inset:0;display:grid;place-items:center}.zwit-word{position:absolute;display:grid;justify-items:center;opacity:0;filter:blur(16px);transform:scale(.92);animation:zwitWord 1.18s cubic-bezier(.22,.72,.2,1) forwards;animation-delay:calc(var(--step)*1.02s)}.zwit-word strong{font:500 clamp(56px,12vw,126px)/1 Georgia,serif;letter-spacing:.04em;color:#f5efe9;text-shadow:0 0 40px #c6a96a22}.zwit-fog{position:absolute;inset:-20%;opacity:0;pointer-events:none}.zwit-fog i{position:absolute;width:65vw;height:65vw;border-radius:50%;background:radial-gradient(circle,#f6efe2aa 0,#b8a78c55 28%,transparent 68%);filter:blur(38px);mix-blend-mode:screen}.zwit-fog i:nth-child(1){left:-15%;top:12%}.zwit-fog i:nth-child(2){right:-18%;top:5%}.zwit-fog i:nth-child(3){left:18%;bottom:-25%}.zwit-fog i:nth-child(4){right:12%;bottom:-18%}.zwit-opening-v2.fogging .zwit-fog{animation:zwitFog 1.4s ease forwards}.zwit-logo-reveal{position:relative;display:grid;justify-items:center;gap:14px;opacity:0;transform:scale(.86);filter:blur(22px)}.zwit-logo-reveal img{width:min(92vw,760px);height:min(88vh,760px);object-fit:contain;border:0;border-radius:0;background:transparent;box-shadow:none;filter:drop-shadow(0 38px 80px #000b)}.zwit-logo-reveal small{max-width:340px;text-align:center;color:#c5bbb5;font:500 12px/1.55 Inter,Arial;letter-spacing:.05em}.zwit-opening-v2.revealed .zwit-word-stage{opacity:0;transition:opacity .45s}.zwit-opening-v2.revealed .zwit-logo-reveal{animation:zwitLogoReveal 1.25s cubic-bezier(.19,.8,.2,1) forwards}.zwit-opening-v2.reduced .zwit-word{animation:none;opacity:0}.zwit-opening-v2.reduced .zwit-word:first-child{opacity:1;filter:none;transform:none}.zwit-opening-v2.reduced.revealed .zwit-logo-reveal{animation-duration:.25s}@keyframes zwitWord{0%{opacity:0;filter:blur(18px);transform:scale(.9)}24%,72%{opacity:1;filter:blur(0);transform:scale(1)}100%{opacity:0;filter:blur(14px);transform:scale(1.06)}}@keyframes zwitFog{0%{opacity:0;transform:scale(.72) rotate(-8deg)}55%{opacity:1}100%{opacity:.82;transform:scale(1.25) rotate(7deg)}}@keyframes zwitLogoReveal{to{opacity:1;transform:scale(1);filter:blur(0)}}
    .zwit-day-separator{display:flex;align-items:center;gap:10px;margin:17px auto 11px;color:#aaa3a0;font:650 10px Inter,Arial;text-transform:capitalize}.zwit-day-separator:before,.zwit-day-separator:after{content:"";width:54px;height:1px;background:#ffffff16}
    .zwit-profile-album-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.zwit-profile-album-actions button{min-height:46px;border:1px solid #c6a96a44;border-radius:15px;background:#c6a96a0e;color:#d8bd77;font:700 12px Inter,Arial;cursor:pointer}.zwit-album-modal{position:fixed;z-index:999999;inset:0;display:grid;place-items:center;padding:16px;background:#050507dd;backdrop-filter:blur(16px)}.zwit-album-modal>div{width:min(520px,100%);max-height:85vh;overflow:auto;padding:24px;border:1px solid #ffffff18;border-radius:25px;background:#111114;color:#f5f0ec}.zwit-album-modal header{position:relative}.zwit-album-modal header span{color:#d8bd77;font:800 10px Inter;letter-spacing:.15em}.zwit-album-modal h2{margin:8px 0;font:500 32px Georgia}.zwit-album-modal [data-close]{position:absolute;right:0;top:0;border:0;background:none;color:#fff;font-size:24px}.zwit-album-list{display:grid;gap:8px;margin:17px 0}.zwit-album-list label{display:flex;gap:11px;padding:13px;border:1px solid #ffffff10;border-radius:14px;background:#ffffff05}.zwit-album-list span{display:grid}.zwit-album-list small{color:#918b88}.zwit-album-modal select,.zwit-album-modal .primary{width:100%;min-height:45px;margin-top:10px;border-radius:14px}.zwit-album-modal select{padding:0 12px;background:#09090b;color:#fff;border:1px solid #ffffff18}.zwit-album-modal .primary{border:0;background:#c6a96a;color:#171109;font-weight:800}.zwit-toast{position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translate(-50%,18px);padding:12px 17px;border:1px solid #c6a96a55;border-radius:999px;background:#101012ee;color:#eee;opacity:0;transition:.25s}.zwit-toast.show{opacity:1;transform:translate(-50%,0)}.zwit-toast.error{border-color:#ef8ca766}
  `;
  document.head.appendChild(style);
  showOpening();
  new MutationObserver(() => requestAnimationFrame(patch)).observe(document.documentElement, { childList:true, subtree:true });
  [0, 300, 1000].forEach((delay) => setTimeout(patch, delay));
})();