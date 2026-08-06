(() => {
  'use strict';
  if (window.__ZWIT_EXPERIENCE__) return;
  window.__ZWIT_EXPERIENCE__ = true;

  const words = ['Chut', 'Shh', 'Ssst', 'Silencio', 'Silenzio', 'Leise', 'Tyst', 'Cicho', 'Тише', '静かに', '쉿', 'هدوء'];
  const state = { profileId: '', patchedMessages: new WeakSet() };
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

  function showOpening() {
    if (!/^\/(?:$|membres|pro|acces-prive)/.test(location.pathname)) return;
    if (sessionStorage.getItem('zwit-opening-seen') === '1') return;
    sessionStorage.setItem('zwit-opening-seen', '1');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = document.createElement('div');
    layer.className = `zwit-opening${reduced ? ' reduced' : ''}`;
    layer.innerHTML = `<div class="zwit-opening-ring">${words.map((word, index) => `<span style="--i:${index};--n:${words.length}">${escapeHTML(word)}</span>`).join('')}</div><div class="zwit-opening-core"><img src="/assets/zwit-logo-1024.jpg" alt=""><strong>Zwit</strong><small>Un secret se partage. Jamais il ne s’impose.</small></div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));
    setTimeout(() => {
      layer.classList.add('leaving');
      setTimeout(() => layer.remove(), 650);
    }, reduced ? 1200 : 2700);
  }

  function parsedMessageDate(message) {
    const time = message.querySelector('time[datetime], time');
    const raw = message.dataset.createdAt || message.dataset.messageCreatedAt || time?.dateTime || time?.getAttribute('datetime');
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fullDate(date) {
    return new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date);
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
      if (state.patchedMessages.has(message)) return;
      state.patchedMessages.add(message);
      message.classList.add('zwit-dated-message');
      message.dataset.zwitFullDate = fullDate(date);
      message.setAttribute('aria-label', `${message.textContent.trim()}. Envoyé ${fullDate(date)}`);
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
    patchMessages();
    patchProfileActions();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-profile]');
    if (trigger?.dataset.openProfile) state.profileId = trigger.dataset.openProfile;
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .zwit-opening{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 42%,#4b1b31 0,#111014 34%,#050506 72%);color:#f5efe9;opacity:0;transition:opacity .45s}.zwit-opening.visible{opacity:1}.zwit-opening.leaving{opacity:0}.zwit-opening-ring{position:absolute;width:min(76vw,430px);aspect-ratio:1;border:1px solid #c6a96a33;border-radius:50%;animation:zwitOrbit 15s linear infinite}.zwit-opening-ring span{position:absolute;left:50%;top:50%;font:600 11px Inter,Arial;letter-spacing:.12em;color:#f4f0ea66;transform:rotate(calc(var(--i)*360deg/var(--n))) translateX(195px) rotate(calc(var(--i)*-360deg/var(--n)))}.zwit-opening-ring span:nth-child(3n){color:#d6b86fbb;font-size:13px}.zwit-opening-core{position:relative;display:grid;justify-items:center;gap:9px;text-align:center}.zwit-opening-core img{width:118px;height:118px;object-fit:contain;border-radius:26px;filter:drop-shadow(0 20px 45px #000)}.zwit-opening-core strong{font:500 45px Georgia,serif;letter-spacing:.12em;color:#d8bd77}.zwit-opening-core small{max-width:290px;color:#bcb4b0;font:500 12px/1.5 Inter,Arial}.zwit-opening.reduced .zwit-opening-ring{animation:none}@keyframes zwitOrbit{to{transform:rotate(360deg)}}
    .zwit-day-separator{display:flex;align-items:center;gap:10px;margin:17px auto 11px;color:#aaa3a0;font:650 10px Inter,Arial;text-transform:capitalize}.zwit-day-separator:before,.zwit-day-separator:after{content:"";width:54px;height:1px;background:#ffffff16}.zwit-dated-message{position:relative;transition:transform .2s;touch-action:pan-y}.zwit-dated-message:after{content:attr(data-zwit-full-date);position:absolute;top:50%;right:calc(100% + 9px);transform:translateY(-50%);white-space:nowrap;color:#d8bd77;font:600 9px Inter,Arial;opacity:0;transition:.2s}.zwit-dated-message:hover:after,.zwit-dated-message:active:after{opacity:1}@media(max-width:720px){.zwit-dated-message:active{transform:translateX(-84px)}.zwit-dated-message:active:after{right:-76px;opacity:1}.zwit-opening-ring span{transform:rotate(calc(var(--i)*360deg/var(--n))) translateX(145px) rotate(calc(var(--i)*-360deg/var(--n)))}}
    .zwit-profile-album-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.zwit-profile-album-actions button{min-height:46px;border:1px solid #c6a96a44;border-radius:15px;background:#c6a96a0e;color:#d8bd77;font:700 12px Inter,Arial;cursor:pointer}.zwit-album-modal{position:fixed;z-index:999999;inset:0;display:grid;place-items:center;padding:16px;background:#050507dd;backdrop-filter:blur(16px)}.zwit-album-modal>div{width:min(520px,100%);max-height:85vh;overflow:auto;padding:24px;border:1px solid #ffffff18;border-radius:25px;background:#111114;color:#f5f0ec}.zwit-album-modal header{position:relative}.zwit-album-modal header span{color:#d8bd77;font:800 10px Inter;letter-spacing:.15em}.zwit-album-modal h2{margin:8px 0;font:500 32px Georgia}.zwit-album-modal [data-close]{position:absolute;right:0;top:0;border:0;background:none;color:#fff;font-size:24px}.zwit-album-list{display:grid;gap:8px;margin:17px 0}.zwit-album-list label{display:flex;gap:11px;padding:13px;border:1px solid #ffffff10;border-radius:14px;background:#ffffff05}.zwit-album-list span{display:grid}.zwit-album-list small{color:#918b88}.zwit-album-modal select,.zwit-album-modal .primary{width:100%;min-height:45px;margin-top:10px;border-radius:14px}.zwit-album-modal select{padding:0 12px;background:#09090b;color:#fff;border:1px solid #ffffff18}.zwit-album-modal .primary{border:0;background:#c6a96a;color:#171109;font-weight:800}.zwit-toast{position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translate(-50%,18px);padding:12px 17px;border:1px solid #c6a96a55;border-radius:999px;background:#101012ee;color:#eee;opacity:0;transition:.25s}.zwit-toast.show{opacity:1;transform:translate(-50%,0)}.zwit-toast.error{border-color:#ef8ca766}
  `;
  document.head.appendChild(style);
  showOpening();
  new MutationObserver(() => requestAnimationFrame(patch)).observe(document.documentElement, { childList:true, subtree:true });
  [0, 300, 1000].forEach((delay) => setTimeout(patch, delay));
})();
