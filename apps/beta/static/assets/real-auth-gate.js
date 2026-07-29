(() => {
  let authConfig = {};
  let turnstileLoader = null;

  const api = (path, options = {}) => fetch(`/api/auth/${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Une erreur est survenue.');
    return payload;
  });

  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const messages = {
    credentials_required: 'Saisis ton e-mail et ton mot de passe.',
    invalid_credentials_or_unconfirmed_email: 'Identifiants incorrects ou e-mail non confirmé.',
    email_password_invitation_required: 'E-mail, mot de passe et invitation sont obligatoires.',
    password_too_short: 'Le mot de passe doit contenir au moins 12 caractères.',
    password_too_weak: 'Ajoute une majuscule, une minuscule, un chiffre et un symbole.',
    signup_refused: 'Invitation invalide, expirée ou déjà utilisée.',
    email_required: 'Saisis ton adresse e-mail.',
    human_verification_required: 'Confirme que tu es bien une personne.',
    human_verification_failed: 'La vérification de sécurité a expiré. Recommence.',
    invalid_recovery_link: 'Ce lien de récupération est incomplet.',
    invalid_or_expired_recovery_link: 'Ce lien de récupération est invalide ou expiré.',
    required_consents_missing: 'Les quatre validations sont obligatoires pour cette BETA.',
    activation_failed: 'L’activation n’a pas abouti. Contacte l’équipe Velvet.'
  };

  function shell(content) {
    return `<div class="vg-card">
      <div class="vg-mark">V</div>
      <p class="vg-kicker">BETA PRIVÉE · 18+</p>
      <h1>Velvet</h1>
      ${content}
      <p class="vg-legal"><a href="/legal/privacy/">Confidentialité</a> · <a href="/legal/terms/">Conditions</a> · <a href="/legal/safety/">Sécurité</a></p>
    </div>`;
  }

  function showMessage(text, error = false) {
    const node = document.querySelector('.vg-message');
    if (!node) return;
    node.textContent = messages[text] || text;
    node.dataset.error = error ? 'true' : 'false';
  }

  function loadTurnstile() {
    if (!authConfig.turnstileSiteKey) return Promise.resolve(null);
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileLoader) return turnstileLoader;
    turnstileLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('human_verification_failed'));
      document.head.appendChild(script);
    });
    return turnstileLoader;
  }

  async function renderTurnstile(action) {
    const container = document.querySelector('[data-turnstile]');
    if (!container || !authConfig.turnstileSiteKey) return;
    try {
      const turnstile = await loadTurnstile();
      turnstile.render(container, {
        sitekey: authConfig.turnstileSiteKey,
        action,
        theme: 'dark',
        appearance: 'interaction-only'
      });
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function formData(form) {
    const data = Object.fromEntries(new FormData(form));
    data.turnstileToken = data['cf-turnstile-response'] || null;
    delete data['cf-turnstile-response'];
    return data;
  }

  function loginView() {
    gate.innerHTML = shell(`
      <p class="vg-intro">Accès réservé aux personnes invitées à tester les quatre univers Velvet.</p>
      <form id="vg-login">
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label>
        <div class="vg-turnstile" data-turnstile></div>
        <button type="submit">Se connecter</button>
      </form>
      <p class="vg-message" role="status"></p>
      <button class="vg-link" id="vg-register" type="button">J’ai reçu une invitation</button>
      <button class="vg-link" id="vg-forgot" type="button">Mot de passe oublié</button>
    `);
    document.querySelector('#vg-register').onclick = () => registerView();
    document.querySelector('#vg-forgot').onclick = recoveryRequestView;
    renderTurnstile('login');
    document.querySelector('#vg-login').onsubmit = async (event) => {
      event.preventDefault();
      const data = formData(event.currentTarget);
      showMessage('Connexion sécurisée…');
      try {
        const result = await api('login', { method: 'POST', body: JSON.stringify(data) });
        result.account.status === 'pending_consent' ? consentView() : destinations(result.account);
      } catch (error) {
        showMessage(error.message, true);
      }
    };
  }

  function registerView(prefill = {}) {
    gate.innerHTML = shell(`
      <p class="vg-intro">Ton code est lié à l’adresse invitée. Il ne peut pas être partagé.</p>
      <form id="vg-signup">
        <label>E-mail invité<input name="email" type="email" autocomplete="email" value="${escape(prefill.email || '')}" required></label>
        <label>Code d’invitation<input name="inviteCode" autocomplete="one-time-code" value="${escape(prefill.inviteCode || '')}" required></label>
        <label>Mot de passe<input name="password" type="password" minlength="12" autocomplete="new-password" aria-describedby="vg-password-rule" required></label>
        <small id="vg-password-rule" class="vg-help">12 caractères minimum avec majuscule, minuscule, chiffre et symbole.</small>
        <div class="vg-turnstile" data-turnstile></div>
        <button type="submit">Créer mon accès</button>
      </form>
      <p class="vg-message" role="status"></p>
      <button class="vg-link" id="vg-back" type="button">Retour à la connexion</button>
    `);
    document.querySelector('#vg-back').onclick = loginView;
    renderTurnstile('signup');
    document.querySelector('#vg-signup').onsubmit = async (event) => {
      event.preventDefault();
      const data = formData(event.currentTarget);
      showMessage('Vérification de l’invitation…');
      try {
        const result = await api('signup', { method: 'POST', body: JSON.stringify(data) });
        window.history.replaceState({}, '', '/');
        showMessage(result.message);
      } catch (error) {
        showMessage(error.message, true);
      }
    };
  }

  function recoveryRequestView() {
    gate.innerHTML = shell(`
      <p class="vg-intro">Indique ton adresse. Si elle correspond à un compte Velvet, tu recevras un lien personnel pour choisir un nouveau mot de passe.</p>
      <form id="vg-recovery-request">
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <div class="vg-turnstile" data-turnstile></div>
        <button type="submit">Recevoir le lien</button>
      </form>
      <p class="vg-message" role="status"></p>
      <button class="vg-link" id="vg-back" type="button">Retour à la connexion</button>
    `);
    document.querySelector('#vg-back').onclick = loginView;
    renderTurnstile('recovery');
    document.querySelector('#vg-recovery-request').onsubmit = async (event) => {
      event.preventDefault();
      showMessage('Préparation du lien sécurisé…');
      try {
        await api('recovery-request', {
          method: 'POST',
          body: JSON.stringify(formData(event.currentTarget))
        });
        showMessage('Si cette adresse possède un compte, un e-mail vient de partir.');
      } catch (error) {
        showMessage(error.message, true);
      }
    };
  }

  function passwordResetView(tokens) {
    window.history.replaceState({}, '', '/');
    gate.innerHTML = shell(`
      <p class="vg-intro">Choisis maintenant un nouveau mot de passe pour sécuriser ton accès Velvet.</p>
      <form id="vg-password-reset">
        <label>Nouveau mot de passe<input name="password" type="password" minlength="12" autocomplete="new-password" required></label>
        <label>Confirmer le mot de passe<input name="confirmation" type="password" minlength="12" autocomplete="new-password" required></label>
        <small class="vg-help">12 caractères minimum avec majuscule, minuscule, chiffre et symbole.</small>
        <button type="submit">Enregistrer mon mot de passe</button>
      </form>
      <p class="vg-message" role="status"></p>
    `);
    document.querySelector('#vg-password-reset').onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (data.password !== data.confirmation) {
        showMessage('Les deux mots de passe ne correspondent pas.', true);
        return;
      }
      showMessage('Sécurisation du compte…');
      try {
        await api('password-update', {
          method: 'POST',
          body: JSON.stringify({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            password: data.password
          })
        });
        showMessage('Ton mot de passe est enregistré. Connexion en cours…');
        window.setTimeout(() => window.location.reload(), 700);
      } catch (error) {
        showMessage(error.message, true);
      }
    };
  }

  function consentView() {
    gate.innerHTML = shell(`
      <p class="vg-intro">Avant l’accès, Velvet doit enregistrer tes choix séparément.</p>
      <form id="vg-consent" class="vg-consents">
        <label><input name="adult" type="checkbox" required> Je déclare avoir 18 ans ou plus.</label>
        <label><input name="terms" type="checkbox" required> J’accepte les conditions de la BETA.</label>
        <label><input name="privacy" type="checkbox" required> J’ai lu l’information de confidentialité.</label>
        <label><input name="sensitiveProfile" type="checkbox" required> Je consens explicitement au traitement des données sensibles que je choisirai de publier sur mon profil. Je pourrai retirer ce consentement.</label>
        <button type="submit">Activer mon accès</button>
      </form>
      <p class="vg-message" role="status"></p>
    `);
    document.querySelector('#vg-consent').onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const data = {
        adult: Boolean(values.adult),
        terms: Boolean(values.terms),
        privacy: Boolean(values.privacy),
        sensitiveProfile: Boolean(values.sensitiveProfile)
      };
      try {
        const result = await api('consent', { method: 'POST', body: JSON.stringify(data) });
        destinations(result.account);
      } catch (error) {
        showMessage(error.message, true);
      }
    };
  }

  function destinations(account) {
    const roles = Array.isArray(account.roles) ? account.roles : [];
    const canChooseDestination = roles.includes('admin') || roles.includes('moderator');
    if (!canChooseDestination) {
      const controlRoles = ['support', 'auditor', 'direction'];
      const proRoles = ['organizer', 'pro_owner', 'pro_staff'];
      const destination = controlRoles.some((role) => roles.includes(role))
        ? '/control/'
        : proRoles.some((role) => roles.includes(role))
          ? '/pro/'
          : '/membres/';
      window.location.replace(destination);
      return;
    }
    const links = [{ href: '/membres/', label: 'Velvet Membres', roles: [] }];
    links.push({ href: '/pro/', label: 'Velvet Pro', roles: ['organizer', 'pro_owner', 'pro_staff', 'direction', 'admin'] });
    links.push({ href: '/control/', label: 'Velvet Control', roles: ['moderator', 'support', 'auditor', 'direction', 'admin'] });
    const allowed = links.filter((link) => !link.roles.length || link.roles.some((role) => roles.includes(role)));
    gate.innerHTML = shell(`
      <p class="vg-intro">Bienvenue ${escape(account.email)}. Choisis ton espace autorisé.</p>
      <div class="vg-destinations">${allowed.map((link) => `<a href="${link.href}">${link.label}<span>Ouvrir →</span></a>`).join('')}</div>
      <p class="vg-message" role="status"></p>
      <button class="vg-link" id="vg-logout" type="button">Se déconnecter</button>
    `);
    document.querySelector('#vg-logout').onclick = async () => {
      await api('logout', { method: 'POST', body: '{}' }).catch(() => {});
      loginView();
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    #velvet-real-gate{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:22px;background:rgba(5,4,5,.72);backdrop-filter:blur(16px);color:#f7f2f3;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto}
    .vg-card{width:min(100%,440px);padding:30px;border:1px solid rgba(255,255,255,.14);border-radius:28px;background:linear-gradient(145deg,rgba(32,20,25,.97),rgba(11,9,11,.98));box-shadow:0 28px 100px rgba(0,0,0,.55)}
    .vg-mark{width:54px;height:54px;margin:auto;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,#8b183c,#4f0d24);font:700 29px Georgia;color:white;box-shadow:0 10px 35px rgba(126,19,53,.42)}
    .vg-kicker{text-align:center;margin:17px 0 5px;color:#d3a6b4;font-size:11px;letter-spacing:.2em}.vg-card h1{text-align:center;margin:0 0 8px;font:500 36px Georgia}.vg-intro{text-align:center;color:#c8bec1;line-height:1.55;margin:0 0 22px}
    .vg-card form{display:grid;gap:14px}.vg-card label{display:grid;gap:7px;color:#d7cdd0;font-size:13px}.vg-card input:not([type=checkbox]){width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid #ffffff1f;border-radius:13px;background:#ffffff0b;color:white;font:inherit;outline:none}.vg-card input:focus{border-color:#b53a61;box-shadow:0 0 0 3px #8b183c33}
    .vg-card button[type=submit]{margin-top:4px;padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#a6204b,#68132f);color:white;font-weight:700;cursor:pointer}.vg-link{display:block;margin:16px auto 0;border:0;background:transparent;color:#d8a9b8;cursor:pointer}
    .vg-message{min-height:18px;text-align:center;color:#a8d5b7;font-size:13px}.vg-message[data-error=true]{color:#ff9eae}.vg-legal{text-align:center;margin:24px 0 0;color:#8f8588;font-size:11px}.vg-legal a{color:#b9adb1}.vg-consents label{grid-template-columns:20px 1fr;align-items:start;line-height:1.45}.vg-consents input{margin-top:3px;accent-color:#9f2149}.vg-help{display:block;margin-top:-7px;color:#988d91;font-size:11px;line-height:1.45}.vg-turnstile{min-height:1px}
    .vg-destinations{display:grid;gap:10px}.vg-destinations a{padding:15px 16px;border:1px solid #ffffff16;border-radius:15px;background:#ffffff08;color:white;text-decoration:none;font-weight:700;display:flex;justify-content:space-between}.vg-destinations span{color:#d9a3b5;font-weight:500}
  `;
  document.head.appendChild(style);
  const gate = document.createElement('div');
  gate.id = 'velvet-real-gate';
  document.body.appendChild(gate);

  const query = new URLSearchParams(window.location.search);
  const invitationPrefill = query.get('invite') && query.get('email')
    ? { inviteCode: query.get('invite'), email: query.get('email') }
    : null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const recoveryTokens = hash.get('type') === 'recovery' && hash.get('access_token') && hash.get('refresh_token')
    ? { accessToken: hash.get('access_token'), refreshToken: hash.get('refresh_token') }
    : null;

  api('config').catch(() => ({})).then((config) => {
    authConfig = config;
    if (recoveryTokens) {
      passwordResetView(recoveryTokens);
      return;
    }
    api('status')
      .then((result) => result.account.status === 'pending_consent' ? consentView() : destinations(result.account))
      .catch(() => invitationPrefill ? registerView(invitationPrefill) : loginView());
  });
})();
