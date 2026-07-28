(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone
  );

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.style.borderColor = error ? 'rgba(255,142,167,.45)' : '';
    node.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove('show'), 4200);
  }

  function base64UrlToBytes(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  }

  async function serviceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
    return navigator.serviceWorker.ready.catch(() => null);
  }

  async function showLocalNotification(title, body) {
    const registration = await serviceWorkerRegistration();
    if (!registration || Notification.permission !== 'granted') return false;
    await registration.showNotification(title, {
      body,
      icon: '/assets/velvet-icon-192.png',
      badge: '/assets/velvet-icon-192.png',
      tag: 'velvet-push-ready',
      data: { url: '/membres/' }
    });
    return true;
  }

  async function enableNotifications() {
    if (!('Notification' in window) || !('PushManager' in window)) {
      throw new Error('Ce navigateur ne prend pas en charge les notifications Web Push.');
    }
    if (isIos && !isStandalone()) {
      throw new Error('Sur iPhone, ajoute d’abord Velvet à l’écran d’accueil, puis ouvre le raccourci pour activer les notifications.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Les notifications restent bloquées dans les réglages de l’iPhone.');
    }

    const registration = await serviceWorkerRegistration();
    if (!registration) throw new Error('Le service de notification Velvet est indisponible.');

    const configResponse = await nativeFetch('/api/members/push-subscriptions', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok) throw new Error(config.error || 'Configuration Web Push indisponible.');

    if (!config.publicKey) {
      await showLocalNotification('Velvet est prêt', 'Les notifications locales sont actives sur cet iPhone.');
      throw new Error('L’iPhone est autorisé. La clé d’envoi distante sera activée avant l’ouverture de la BETA aux invités.');
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(config.publicKey)
      });
    }

    const response = await nativeFetch('/api/members/push-subscriptions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...subscription.toJSON(),
        installationOrigin: window.location.origin,
        standalone: isStandalone()
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Abonnement aux notifications impossible.');

    localStorage.setItem('velvet_push_origin', window.location.origin);
    await showLocalNotification('Velvet est prêt', 'Tes notifications sont maintenant reliées à cet iPhone.');
    return true;
  }

  async function disableNotifications() {
    const registration = await serviceWorkerRegistration();
    const subscription = await registration?.pushManager?.getSubscription?.();
    if (!subscription) return true;
    await nativeFetch(`/api/members/push-subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    }).catch(() => null);
    await subscription.unsubscribe().catch(() => null);
    localStorage.removeItem('velvet_push_origin');
    return true;
  }

  function showIosInstallGuide() {
    if (document.querySelector('#velvetIosGuide')) return;
    const sheet = document.createElement('div');
    sheet.id = 'velvetIosGuide';
    sheet.innerHTML = `<div class="velvet-ios-card">
      <button type="button" aria-label="Fermer">×</button>
      <span class="velvet-ios-icon">V</span>
      <p>Velvet sur iPhone</p>
      <h2>Ajoute Velvet à ton écran d’accueil.</h2>
      <ol><li>Dans Safari, touche <strong>Partager</strong>.</li><li>Choisis <strong>Sur l’écran d’accueil</strong>.</li><li>Ouvre ensuite l’icône Velvet et active les notifications dans Paramètres.</li></ol>
      <small>Lors du passage au domaine privé, l’autorisation Web Push devra être activée une nouvelle fois.</small>
    </div>`;
    sheet.querySelector('button').addEventListener('click', () => sheet.remove());
    sheet.addEventListener('click', (event) => { if (event.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
  }

  function addMigrationNotice() {
    const card = document.querySelector('.mobile-app-card');
    if (!card || card.querySelector('[data-domain-migration-note]')) return;
    const note = document.createElement('p');
    note.dataset.domainMigrationNote = 'true';
    note.className = 'status-box';
    note.textContent = 'Lors de la migration vers le domaine privé Velvet, cet appareil devra réautoriser une fois les notifications. Cette étape est déjà prévue dans le plan de bascule.';
    card.appendChild(note);
  }

  function injectStyles() {
    if (document.querySelector('#velvetPwaStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetPwaStyles';
    style.textContent = `.velvet-ios-card{width:min(520px,calc(100vw - 28px));margin:0 auto 12px;padding:24px;border:1px solid rgba(217,184,121,.32);border-radius:26px;background:#171014;color:#f6eee6;box-shadow:0 24px 80px #0009}.velvet-ios-card>button{float:right;border:0;background:transparent;color:#cdbfc4;font-size:30px}.velvet-ios-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:linear-gradient(145deg,#8f274e,#2a0d19);color:#f0d39b;font:700 30px Georgia,serif}.velvet-ios-card p{margin:18px 0 6px;color:#d9b879;text-transform:uppercase;letter-spacing:.12em;font-size:11px}.velvet-ios-card h2{margin:0 0 16px;font:400 29px Georgia,serif}.velvet-ios-card li{margin:9px 0;color:#d7cdd0}.velvet-ios-card small{display:block;margin-top:18px;color:#9e9297;line-height:1.5}#velvetIosGuide{position:fixed;inset:0;z-index:99999;display:grid;align-items:end;padding:16px;background:#030203b8;backdrop-filter:blur(8px)}`;
    document.head.appendChild(style);
  }

  document.addEventListener('click', async (event) => {
    const notificationButton = event.target.closest('[data-test-notification]');
    if (notificationButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notificationButton.disabled = true;
      try {
        await enableNotifications();
        const toggle = document.querySelector('[name=browser_enabled]');
        if (toggle) toggle.checked = true;
        toast('Notifications Velvet activées sur cet appareil.');
      } catch (error) {
        toast(error.message, true);
      } finally {
        notificationButton.disabled = false;
      }
      return;
    }

    const installButton = event.target.closest('[data-install-velvet]');
    if (installButton && isIos && !isStandalone()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showIosInstallGuide();
    }
  }, true);

  injectStyles();
  serviceWorkerRegistration();
  new MutationObserver(addMigrationNotice).observe(document.documentElement, { childList: true, subtree: true });
  addMigrationNotice();
  window.VelvetPWA = { enableNotifications, disableNotifications, isStandalone, showIosInstallGuide };
})();
