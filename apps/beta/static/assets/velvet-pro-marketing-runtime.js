(() => {
  'use strict';

  if (!location.pathname.startsWith('/pro/') && !location.pathname.startsWith('/marketing-pro/')) return;
  if (window.__VELVET_PRO_MARKETING_RUNTIME__) return;
  window.__VELVET_PRO_MARKETING_RUNTIME__ = true;

  const messages = {
    marketing_preview_external_publish_disabled: 'La diffusion externe s’active depuis le portail Pro relié aux comptes officiels de l’établissement.',
    marketing_preview_connection_locked: 'Les connexions présentées dans cet aperçu sont protégées. Gérez les comptes officiels depuis le portail Pro.',
    marketing_human_approval_required: 'Validez personnellement la campagne avant sa programmation.',
    marketing_compliance_blocking: 'Le texte contient une formulation bloquante. Corrigez-la avant diffusion.',
    marketing_campaign_incomplete: 'Sélectionnez une soirée, une affiche et au moins un réseau.',
    meta_not_configured: 'La connexion Facebook et Instagram est en cours d’activation par Velvet.',
    tiktok_not_configured: 'La connexion TikTok est en cours d’activation par Velvet.',
    social_scheduler_not_configured: 'Le service de programmation est en cours d’activation.',
    velvet_public_origin_missing: 'Le domaine public Velvet doit être finalisé avant la diffusion externe.'
  };

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const response = await previousFetch(input, init);
    const url = new URL(typeof input === 'string' ? input : input?.url || '', location.origin);
    if (url.pathname !== '/api/pro/marketing' || response.ok) return response;
    const payload = await response.clone().json().catch(() => null);
    if (!payload?.error || !messages[payload.error]) return response;
    return new Response(JSON.stringify({ ...payload, error: messages[payload.error], errorCode: payload.error }), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  };

  let navigationButton = null;
  const timer = setInterval(() => {
    const nextButton = document.querySelector('[data-pro-marketing-nav]');
    if (nextButton && nextButton !== navigationButton) {
      navigationButton = nextButton;
      navigationButton.addEventListener('click', () => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const active = document.querySelector('.vpm-tabs button.active');
            if (!active) document.querySelector('[data-vpm-tab="create"]')?.click();
          }, 30);
        });
      }, true);
    }
    if (navigationButton && document.querySelector('[data-vpm-body]')) clearInterval(timer);
  }, 100);

  setTimeout(() => clearInterval(timer), 30_000);
})();
