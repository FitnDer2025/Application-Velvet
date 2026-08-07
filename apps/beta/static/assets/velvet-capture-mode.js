(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('velvet_capture');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return;

  const target = new URL('/marketing/', location.origin);
  target.searchParams.set('velvet_capture', token);
  location.replace(target.toString());
})();

(() => {
  if (window.ZwitMediaOptimizer || document.querySelector('script[data-zwit-media-optimizer]')) return;
  const script = document.createElement('script');
  script.src = '/assets/zwit-media-optimizer.js?v=20260807-1';
  script.async = true;
  script.dataset.zwitMediaOptimizer = 'true';
  document.head.appendChild(script);
})();
