(() => {
  const MOBILE_QUERY = '(max-width: 900px)';
  const state = {
    profiles: [],
    patchPending: false,
    patching: false
  };

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function initials(value) {
    return String(value || 'V')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'V';
  }

  function profileById(id) {
    return state.profiles.find((profile) => String(profile.id) === String(id));
  }

  function preferredAvatar(profile) {
    const expectedGallery = profile?.profile_type === 'couple'
      ? 'couple_gallery'
      : 'individual_gallery';

    return list(profile?.media_assets)
      .filter((asset) => asset?.moderation_status === 'approved' && asset?.previewUrl)
      .map((asset) => ({
        ...asset,
        avatarScore:
          (asset.media_role === 'individual_portrait' ? 100 : 0)
          + (asset.is_primary ? 30 : 0)
          + (asset.media_role === expectedGallery ? 10 : 0)
      }))
      .sort((left, right) =>
        right.avatarScore - left.avatarScore
        || new Date(right.created_at || 0) - new Date(left.created_at || 0)
      )[0] || null;
  }

  function patchFeedAvatars() {
    if (!state.profiles.length) return;

    document.querySelectorAll('.home-feed-card').forEach((card) => {
      const profileButton = card.querySelector('[data-open-profile]');
      const avatar = card.querySelector('.feed-avatar');
      if (!profileButton || !avatar) return;

      const profile = profileById(profileButton.dataset.openProfile);
      if (!profile) return;

      const asset = preferredAvatar(profile);
      const signature = `${profile.id}:${asset?.id || 'initials'}:${asset?.previewUrl || ''}`;
      if (avatar.dataset.velvetAvatarSignature === signature) return;

      avatar.dataset.velvetAvatarSignature = signature;
      avatar.classList.toggle('is-profile-portrait', asset?.media_role === 'individual_portrait');
      avatar.setAttribute('aria-label', `Photo de ${profile.display_name || 'ce membre'}`);

      if (asset?.previewUrl) {
        const image = document.createElement('img');
        image.src = asset.previewUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        avatar.replaceChildren(image);
      } else {
        avatar.textContent = initials(profile.display_name);
      }
    });
  }

  function patch() {
    state.patchPending = false;
    if (state.patching) return;
    state.patching = true;
    patchFeedAvatars();
    requestAnimationFrame(() => { state.patching = false; });
  }

  function schedulePatch() {
    if (state.patchPending || state.patching) return;
    state.patchPending = true;
    requestAnimationFrame(patch);
  }

  async function refreshProfiles() {
    try {
      const response = await fetch('/api/members/directory', {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) return;
      const directory = await response.json();
      state.profiles = list(directory.profiles);
      schedulePatch();
    } catch {
      // Le recadrage CSS reste actif même si le répertoire est momentanément indisponible.
    }
  }

  function relayMessagesRoute(event) {
    if (!matchMedia(MOBILE_QUERY).matches) return false;
    const messageButton = event.target.closest('.bottom-nav [data-route="conversations"]');
    if (!messageButton || messageButton.dataset.velvetRouteRelay === 'true') return false;

    const canonicalButton = document.querySelector('.sidebar [data-route="conversations"]');
    if (!canonicalButton) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    messageButton.dataset.velvetRouteRelay = 'true';
    canonicalButton.click();
    requestAnimationFrame(() => delete messageButton.dataset.velvetRouteRelay);
    return true;
  }

  document.addEventListener('click', (event) => {
    relayMessagesRoute(event);
  }, true);

  new MutationObserver(schedulePatch).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshProfiles();
  });
  window.addEventListener('focus', refreshProfiles);

  refreshProfiles();
  schedulePatch();
})();
