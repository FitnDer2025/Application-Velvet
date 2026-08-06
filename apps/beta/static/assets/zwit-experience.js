(() => {
  'use strict';
  if (window.__ZWIT_EXPERIENCE__) return;
  window.__ZWIT_EXPERIENCE__ = true;

  const openingWords = [
    { word: 'Chut', language: 'Français' },
    { word: 'Silencio', language: 'Español' },
    { word: 'Silenzio', language: 'Italiano' },
    { word: '嘘…', language: '中文' }
  ];
  const OFFICIAL_LOGO = '/assets/zwit-logo-official.jpg';
  const OFFICIAL_MARK = OFFICIAL_LOGO;
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
  const key = 'zwit-opening-seen-v3';
  if (sessionStorage.getItem(key) === '1') return;
  sessionStorage.setItem(key, '1');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = document.createElement('div');
  layer.className = `zwit-opening${reduced ? ' reduced' : ''}`;
  layer.innerHTML = `<div class="zwit-opening-glow" aria-hidden="true"></div><div class="zwit-opening-word-stage" aria-live="polite"><small></small><strong></strong></div><div class="zwit-opening-mist" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}</div><div class="zwit-opening-logo"><img src="${OFFICIAL_LOGO}" alt="Logo Zwit"><span>CHUT.</span></div>`;
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('visible'));

  const finish = () => {
    layer.classList.add('leaving');
    setTimeout(() => layer.remove(), 760);
  };

  if (reduced) {
    layer.classList.add('is-logo');
    setTimeout(finish, 1450);
    return;
  }

  const stage = layer.querySelector('.zwit-opening-word-stage');
  const word = stage.querySelector('strong');
  const language = stage.querySelector('small');
  let index = 0;

  const revealLogo = () => {
    layer.classList.add('is-misting');
    setTimeout(() => layer.classList.add('is-logo'), 780);
    setTimeout(finish, 2450);
  };

  const revealWord = () => {
    const item = openingWords[index];
    language.textContent = item.language;
    word.textContent = item.word;
    requestAnimationFrame(() => stage.classList.add('is-visible'));
    setTimeout(() => {
      stage.classList.remove('is-visible');
      index += 1;
      if (index < openingWords.length) setTimeout(revealWord, 190);
      else setTimeout(revealLogo, 240);
    }, 660);
  };

  setTimeout(revealWord, 260);
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
      if (state.patchedMessages.has(message)) return;
      state.patchedMessages.add(message);
      message.classList.remove('zwit-dated-message');
      message.removeAttribute('data-zwit-full-date');
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

function installBrandLogo() {
  document.querySelectorAll('img[src*="zwit-logo.svg"]').forEach((image) => {
    image.src = OFFICIAL_MARK;
    image.alt = 'Zwit';
  });
  if (document.querySelector('[data-zwit-official-brand]')) return;
  const brand = document.createElement('a');
  brand.href = '/membres/';
  brand.className = 'zwit-official-brand';
  brand.dataset.zwitOfficialBrand = '1';
  brand.setAttribute('aria-label', 'Accueil Zwit');
  brand.innerHTML = `<img src="${OFFICIAL_MARK}" alt="Zwit">`;
  document.body.appendChild(brand);
}

  function patch() {
    installBrandLogo();
    patchMessages();
    patchProfileActions();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-profile]');
    if (trigger?.dataset.openProfile) state.profileId = trigger.dataset.openProfile;
  }, true);

  const style = document.createElement('style');
style.textContent = `
  .zwit-official-brand{position:fixed;z-index:9500;top:calc(env(safe-area-inset-top,0px) + 10px);left:14px;display:grid;place-items:center;width:56px;height:56px;border:1px solid rgba(198,169,106,.3);border-radius:17px;background:#09090b;box-shadow:0 14px 42px rgba(0,0,0,.38);overflow:hidden;transition:transform .24s ease,border-color .24s ease}.zwit-official-brand:hover{transform:translateY(-1px) scale(1.025);border-color:rgba(216,189,119,.64)}.zwit-official-brand img{width:100%;height:100%;object-fit:cover;display:block}
  .zwit-opening{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 44%,#2f1723 0,#0d0c0f 38%,#030304 76%);color:#f5efe9;opacity:0;transition:opacity .68s cubic-bezier(.22,.61,.36,1)}.zwit-opening.visible{opacity:1}.zwit-opening.leaving{opacity:0}.zwit-opening-glow{position:absolute;width:min(90vw,720px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(198,169,106,.11),rgba(100,27,54,.07) 35%,transparent 68%);filter:blur(20px);animation:zwitBreath 3.2s ease-in-out infinite alternate}.zwit-opening-word-stage{position:relative;z-index:3;display:grid;justify-items:center;gap:13px;opacity:0;filter:blur(18px);transform:translateY(16px) scale(.94);transition:opacity .36s ease,filter .44s ease,transform .44s cubic-bezier(.22,.61,.36,1)}.zwit-opening-word-stage.is-visible{opacity:1;filter:blur(0);transform:translateY(0) scale(1)}.zwit-opening-word-stage small{font:700 10px Inter,Arial;letter-spacing:.28em;text-transform:uppercase;color:#d8bd77aa}.zwit-opening-word-stage strong{font:500 clamp(58px,12vw,112px)/.95 Georgia,serif;letter-spacing:.02em;color:#f5efe9;text-shadow:0 20px 70px rgba(198,169,106,.16)}.zwit-opening-mist{position:absolute;inset:-18%;z-index:4;pointer-events:none;opacity:0;transition:opacity .8s ease}.zwit-opening-mist i{position:absolute;left:50%;top:50%;width:clamp(300px,58vw,840px);height:clamp(130px,26vw,360px);border-radius:50%;background:radial-gradient(ellipse,rgba(244,240,234,.24),rgba(179,169,163,.08) 46%,transparent 72%);filter:blur(42px);transform:translate(calc(-50% + (var(--i) - 4)*9vw),calc(-50% + (var(--i) - 4)*5vh)) scale(.4);animation:zwitMist 2.2s cubic-bezier(.2,.65,.3,1) infinite alternate;animation-delay:calc(var(--i)*-.17s)}.zwit-opening.is-misting .zwit-opening-mist{opacity:1}.zwit-opening.is-misting .zwit-opening-word-stage{opacity:0;filter:blur(24px);transform:scale(1.08)}.zwit-opening-logo{position:relative;z-index:5;display:grid;justify-items:center;gap:9px;opacity:0;filter:blur(28px);transform:scale(.86);transition:opacity .9s ease,filter 1.05s ease,transform 1.05s cubic-bezier(.16,1,.3,1)}.zwit-opening-logo img{width:min(72vw,390px);aspect-ratio:1;object-fit:cover;border-radius:32px;box-shadow:0 34px 100px rgba(0,0,0,.6)}.zwit-opening-logo span{font:700 10px Inter,Arial;letter-spacing:.42em;color:#d8bd77}.zwit-opening.is-logo .zwit-opening-logo{opacity:1;filter:blur(0);transform:scale(1)}.zwit-opening.is-logo .zwit-opening-mist{opacity:.38}.zwit-opening.reduced .zwit-opening-word-stage,.zwit-opening.reduced .zwit-opening-mist{display:none}@keyframes zwitBreath{to{transform:scale(1.08);opacity:.72}}@keyframes zwitMist{0%{transform:translate(calc(-50% + (var(--i) - 4)*9vw),calc(-50% + (var(--i) - 4)*5vh)) scale(.42) rotate(-4deg)}100%{transform:translate(calc(-50% - (var(--i) - 4)*6vw),calc(-50% - (var(--i) - 4)*3vh)) scale(1.15) rotate(7deg)}}
  .zwit-day-separator{display:flex;align-items:center;justify-content:center;gap:10px;margin:17px auto 11px;color:#aaa3a0;font:650 10px Inter,Arial;text-transform:capitalize}.zwit-day-separator:before,.zwit-day-separator:after{content:"";width:54px;height:1px;background:#ffffff16}
  .zwit-profile-album-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.zwit-profile-album-actions button{min-height:46px;border:1px solid #c6a96a44;border-radius:15px;background:#c6a96a0e;color:#d8bd77;font:700 12px Inter,Arial;cursor:pointer}.zwit-album-modal{position:fixed;z-index:999999;inset:0;display:grid;place-items:center;padding:16px;background:#050507dd;backdrop-filter:blur(16px)}.zwit-album-modal>div{width:min(520px,100%);max-height:85vh;overflow:auto;padding:24px;border:1px solid #ffffff18;border-radius:25px;background:#111114;color:#f5f0ec}.zwit-album-modal header{position:relative}.zwit-album-modal header span{color:#d8bd77;font:800 10px Inter;letter-spacing:.15em}.zwit-album-modal h2{margin:8px 0;font:500 32px Georgia}.zwit-album-modal [data-close]{position:absolute;right:0;top:0;border:0;background:none;color:#fff;font-size:24px}.zwit-album-list{display:grid;gap:8px;margin:17px 0}.zwit-album-list label{display:flex;gap:11px;padding:13px;border:1px solid #ffffff10;border-radius:14px;background:#ffffff05}.zwit-album-list span{display:grid}.zwit-album-list small{color:#918b88}.zwit-album-modal select,.zwit-album-modal .primary{width:100%;min-height:45px;margin-top:10px;border-radius:14px}.zwit-album-modal select{padding:0 12px;background:#09090b;color:#fff;border:1px solid #ffffff18}.zwit-album-modal .primary{border:0;background:#c6a96a;color:#171109;font-weight:800}.zwit-toast{position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translate(-50%,18px);padding:12px 17px;border:1px solid #c6a96a55;border-radius:999px;background:#101012ee;color:#eee;opacity:0;transition:.25s}.zwit-toast.show{opacity:1;transform:translate(-50%,0)}.zwit-toast.error{border-color:#ef8ca766}
  @media(max-width:720px){.zwit-official-brand{width:49px;height:49px;left:10px;border-radius:15px}.zwit-profile-album-actions{grid-template-columns:1fr}.zwit-opening-logo img{width:min(78vw,330px)}}
`;
document.head.appendChild(style);
  installBrandLogo();
  showOpening();
  new MutationObserver(() => requestAnimationFrame(patch)).observe(document.documentElement, { childList:true, subtree:true });
  [0, 300, 1000].forEach((delay) => setTimeout(patch, delay));
})();
