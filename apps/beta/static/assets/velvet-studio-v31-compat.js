(() => {
  'use strict';

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-v31-video]')) return;
    const nativeAudioContext = window.AudioContext;
    const nativeWebkitAudioContext = window.webkitAudioContext;
    let audioChanged = false;
    try {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
      audioChanged = true;
    } catch {}
    if (!audioChanged) return;
    setTimeout(() => {
      try {
        window.AudioContext = nativeAudioContext;
        window.webkitAudioContext = nativeWebkitAudioContext;
      } catch {}
    }, 18_000);
  }, true);
})();
