(() => {
  'use strict';

  const form = document.querySelector('#waitlistForm');
  if (!form) return;

  const audienceInput = form.elements.audience;
  const tabs = [...document.querySelectorAll('[data-audience]')];
  const memberFields = document.querySelector('.vw-member-fields');
  const proFields = document.querySelector('.vw-pro-fields');
  const proPhone = document.querySelector('.vw-pro-phone');
  const status = document.querySelector('#formStatus');
  const success = document.querySelector('#waitlistSuccess');
  const referralBox = document.querySelector('#referralBox');
  const referralLink = document.querySelector('#referralLink');
  const copyReferral = document.querySelector('#copyReferral');
  const submit = form.querySelector('button[type="submit"]');
  let turnstileWidget = null;
  let turnstileToken = '';

  const query = new URLSearchParams(window.location.search);
  const attribution = {
    source: query.get('utm_source') || query.get('source') || 'direct',
    campaign: query.get('utm_campaign') || '',
    medium: query.get('utm_medium') || '',
    content: query.get('utm_content') || '',
    referral: query.get('ref') || ''
  };
  Object.entries(attribution).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value.slice(0, 120);
  });

  function setStatus(message = '', tone = '') {
    status.textContent = message;
    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  }

  function setAudience(audience) {
    const isPro = audience === 'pro';
    audienceInput.value = isPro ? 'pro' : 'member';
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.audience === audienceInput.value)));
    memberFields.hidden = isPro;
    proFields.hidden = !isPro;
    proPhone.hidden = !isPro;
    form.elements.memberType.required = !isPro;
    form.elements.businessName.required = isPro;
    form.elements.professionalType.required = isPro;
    form.elements.contactName.required = isPro;
    setStatus('');
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => setAudience(tab.dataset.audience)));
  const requestedAudience = query.get('audience');
  if (requestedAudience === 'pro') setAudience('pro');

  function markValidity() {
    [...form.querySelectorAll('[required]')].forEach((field) => {
      field.setAttribute('aria-invalid', String(!field.checkValidity()));
      field.addEventListener('input', () => field.removeAttribute('aria-invalid'), { once: true });
      field.addEventListener('change', () => field.removeAttribute('aria-invalid'), { once: true });
    });
  }

  async function mountTurnstile() {
    const config = await fetch('/api/auth/config', { headers: { accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : {})
      .catch(() => ({}));
    if (!config.turnstileSiteKey) return;
    const waitForLibrary = () => new Promise((resolve) => {
      if (window.turnstile) return resolve();
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (window.turnstile || Date.now() - started > 8000) {
          window.clearInterval(timer);
          resolve();
        }
      }, 120);
    });
    await waitForLibrary();
    if (!window.turnstile) return;
    turnstileWidget = window.turnstile.render('#turnstileSlot', {
      sitekey: config.turnstileSiteKey,
      theme: 'dark',
      action: 'waitlist',
      callback: (token) => { turnstileToken = token; setStatus(''); },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; setStatus('La vérification anti-robot doit être relancée.', 'error'); }
    });
  }

  function payload() {
    const data = new FormData(form);
    return {
      audience: data.get('audience'),
      email: data.get('email'),
      location: data.get('location'),
      country: data.get('country'),
      memberType: data.get('memberType'),
      businessName: data.get('businessName'),
      professionalType: data.get('professionalType'),
      contactName: data.get('contactName'),
      phone: data.get('phone'),
      wantsBeta: data.get('wantsBeta') === 'true',
      adultAttestation: data.get('adultAttestation') === 'true',
      launchConsent: data.get('launchConsent') === 'true',
      source: data.get('source'),
      campaign: data.get('campaign'),
      medium: data.get('medium'),
      content: data.get('content'),
      referral: data.get('referral'),
      website: data.get('website'),
      turnstileToken
    };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      markValidity();
      setStatus('Vérifiez les informations obligatoires avant de continuer.', 'error');
      form.querySelector(':invalid')?.focus();
      return;
    }

    submit.disabled = true;
    submit.querySelector('span').textContent = 'Enregistrement…';
    setStatus('Votre demande est enregistrée de manière sécurisée.');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload())
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages = {
          invalid_email: 'Cette adresse e-mail ne semble pas valide.',
          invalid_waitlist_request: 'Certaines informations doivent être corrigées.',
          launch_consent_required: 'Votre accord est nécessaire pour vous prévenir de l’ouverture.',
          adult_attestation_required: 'Zwit est exclusivement réservé aux personnes majeures.',
          human_verification_required: 'Validez la vérification anti-robot.',
          human_verification_failed: 'La vérification anti-robot a échoué. Merci de recommencer.',
          waitlist_not_configured: 'La liste d’accès est en cours d’activation. Revenez très prochainement.'
        };
        throw new Error(messages[result.error] || 'Impossible d’enregistrer la demande pour le moment.');
      }
      form.hidden = true;
      success.hidden = false;
      if (result.referralUrl) {
        referralLink.value = result.referralUrl;
        referralBox.hidden = false;
      }
      success.focus();
      window.history.replaceState({}, '', '/acces-prive/?inscription=confirmee');
    } catch (error) {
      setStatus(error.message || 'Une erreur est survenue. Réessayez.', 'error');
      if (turnstileWidget !== null && window.turnstile) {
        window.turnstile.reset(turnstileWidget);
        turnstileToken = '';
      }
    } finally {
      submit.disabled = false;
      submit.querySelector('span').textContent = 'Demander mon accès privé';
    }
  });

  copyReferral?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(referralLink.value);
      copyReferral.textContent = 'Copié';
      window.setTimeout(() => { copyReferral.textContent = 'Copier'; }, 1800);
    } catch {
      referralLink.select();
      document.execCommand('copy');
    }
  });

  mountTurnstile();
})();
