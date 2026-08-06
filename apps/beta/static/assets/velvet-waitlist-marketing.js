(() => {
  'use strict';

  const source = document.querySelector('#campaignSource');
  const campaign = document.querySelector('#campaignName');
  const audience = document.querySelector('#campaignAudience');
  const output = document.querySelector('#generatedCampaignLink');
  const copyLink = document.querySelector('#copyCampaignLink');
  const cards = [...document.querySelectorAll('[data-copy-card]')];
  if (!source || !campaign || !audience || !output) return;

  function campaignLink() {
    const url = new URL('/acces-prive/', window.location.origin);
    url.searchParams.set('utm_source', source.value);
    url.searchParams.set('utm_medium', source.value === 'email' ? 'email' : 'social');
    url.searchParams.set('utm_campaign', campaign.value.trim() || 'ouverture_hdf_be');
    url.searchParams.set('utm_content', audience.value);
    url.searchParams.set('audience', audience.value);
    output.value = url.toString();
    return output.value;
  }

  async function copy(value, button) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const temporary = document.createElement('textarea');
      temporary.value = value;
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand('copy');
      temporary.remove();
    }
    const previous = button.textContent;
    button.textContent = 'Copié';
    window.setTimeout(() => { button.textContent = previous; }, 1600);
  }

  [source, audience].forEach((field) => field.addEventListener('change', campaignLink));
  campaign.addEventListener('input', campaignLink);
  copyLink.addEventListener('click', () => copy(campaignLink(), copyLink));

  cards.forEach((card) => {
    const textarea = card.querySelector('textarea');
    const button = card.querySelector('[data-copy]');
    button.addEventListener('click', () => {
      const finalText = textarea.value.replaceAll('{{LIEN}}', campaignLink());
      copy(finalText, button);
    });
  });

  campaignLink();
})();
