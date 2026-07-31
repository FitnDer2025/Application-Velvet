(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const route = params.get('route');
  const conversationId = params.get('conversation');
  const profileId = params.get('profile');
  const eventId = params.get('event');
  if (!route && !conversationId && !profileId && !eventId) return;

  const startedAt = Date.now();
  let completed = false;

  function click(target) {
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    return true;
  }

  function cleanUrl() {
    const url = new URL(location.href);
    ['route', 'conversation', 'profile', 'event'].forEach((key) => url.searchParams.delete(key));
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function complete() {
    completed = true;
    cleanUrl();
  }

  function attempt() {
    if (completed) return;

    if (conversationId) {
      const direct = document.querySelector(`[data-open-conversation="${CSS.escape(conversationId)}"]`);
      if (click(direct)) return complete();
      click(document.querySelector('[data-route="conversations"]'));
    } else if (profileId) {
      const direct = document.querySelector(`[data-open-profile="${CSS.escape(profileId)}"]`);
      if (click(direct)) return complete();
      click(document.querySelector('[data-route="discover"]'));
    } else if (eventId) {
      const direct = document.querySelector(`[data-open-event="${CSS.escape(eventId)}"], [data-event-id="${CSS.escape(eventId)}"]`);
      if (click(direct)) return complete();
      click(document.querySelector('[data-route="events"]'));
    } else if (route) {
      if (click(document.querySelector(`[data-route="${CSS.escape(route)}"]`))) return complete();
    }

    if (Date.now() - startedAt > 12_000) {
      complete();
      return;
    }
    window.setTimeout(attempt, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attempt, { once: true });
  } else {
    attempt();
  }
})();
