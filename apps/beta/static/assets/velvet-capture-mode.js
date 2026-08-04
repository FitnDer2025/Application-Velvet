(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('velvet_capture');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return;

  const target = new URL('/marketing/', location.origin);
  target.searchParams.set('velvet_capture', token);
  location.replace(target.toString());
})();
