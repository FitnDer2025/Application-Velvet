(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('velvet_capture');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return;

  window.__VELVET_CAPTURE_MODE__ = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (/\/api\/(members|billing|pro)\//.test(url)) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'capture_mode_synthetic_only' }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      }));
    }
    return nativeFetch(input, init);
  };

  const profiles = [
    { name: 'Camille & Thomas', city: 'Lille', age: '34 & 37 ans', type: 'Couple', trust: 94, image: 'linear-gradient(145deg,#6f2944,#19191c)' },
    { name: 'Élise', city: 'Arras', age: '32 ans', type: 'Femme', trust: 91, image: 'linear-gradient(145deg,#8b4b61,#1b1b1d)' },
    { name: 'Léa & Julien', city: 'Bruxelles', age: '36 & 39 ans', type: 'Couple', trust: 96, image: 'linear-gradient(145deg,#4c2535,#242126)' },
    { name: 'Sophie', city: 'Tournai', age: '38 ans', type: 'Femme', trust: 89, image: 'linear-gradient(145deg,#765a46,#211c1b)' }
  ];
  const events = [
    { title: 'Élégance & Connexions', venue: 'L’Only · Lille', date: 'Samedi · 21 h 30', attending: 84 },
    { title: 'Nuit Velvet', venue: 'La Tentation · Belgique', date: 'Vendredi · 22 h', attending: 62 },
    { title: 'Cocktail Couples', venue: 'O’Pulsion · Hauts-de-France', date: 'Samedi · 20 h 30', attending: 48 }
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  }

  function profileCards() {
    return profiles.map((profile) => `<article class="vc-profile"><div class="vc-photo" style="background:${profile.image}"><span>Portrait synthétique</span></div><div class="vc-profile-copy"><small>${escapeHtml(profile.type)} · ${escapeHtml(profile.city)}</small><h3>${escapeHtml(profile.name)}</h3><p>${escapeHtml(profile.age)}</p><div class="vc-trust">Indice de confiance <strong>${profile.trust}%</strong></div></div></article>`).join('');
  }

  function eventCards() {
    return events.map((event) => `<article class="vc-event"><small>${escapeHtml(event.date)}</small><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.venue)}</p><strong>${event.attending} participants</strong></article>`).join('');
  }

  function screen(view) {
    const content = {
      home: `<section class="vc-hero"><p class="vc-eyebrow">Bonjour Camille & Thomas</p><h1>Des rencontres qui ont du sens.</h1><p>Découvrez des personnes, des lieux et des événements sélectionnés autour de vous.</p><button data-vc-view="discover">Découvrir les membres</button></section><section><div class="vc-title"><div><small>Près de Lille</small><h2>Découvrir d’autres membres</h2></div><button data-vc-view="discover">Tout voir</button></div><div class="vc-profiles">${profileCards()}</div></section><section><div class="vc-title"><div><small>Cette semaine</small><h2>Événements près de chez toi</h2></div><button data-vc-view="events">Agenda</button></div><div class="vc-events">${eventCards()}</div></section>`,
      discover: `<section><div class="vc-title"><div><small>Recherche Velvet</small><h1>Découvrir</h1></div><div class="vc-filters"><span>Couples</span><span>Femmes</span><span>50 km</span><span>Vérifiés</span></div></div><div class="vc-profiles large">${profileCards()}${profileCards()}</div></section>`,
      map: `<section><div class="vc-title"><div><small>Autour de Lille</small><h1>Carte</h1></div><div class="vc-filters"><span>Membres</span><span>Clubs</span><span>Événements</span></div></div><div class="vc-map"><div class="vc-map-grid"></div>${profiles.map((p,i)=>`<button class="vc-pin" style="left:${18+i*19}%;top:${25+(i%2)*32}%">${i%2?'V':'●'}</button>`).join('')}<aside><strong>12 membres</strong><span>8 établissements</span><span>5 événements</span></aside></div></section>`,
      events: `<section><div class="vc-title"><div><small>Agenda complet</small><h1>Sorties & événements</h1></div><div class="vc-filters"><span>Ce week-end</span><span>Couples</span><span>50 km</span></div></div><div class="vc-events large">${eventCards()}${eventCards()}</div></section>`,
      messages: `<section><div class="vc-title"><div><small>Conversations sécurisées</small><h1>Messages</h1></div></div><div class="vc-chat"><aside>${profiles.slice(0,3).map((p,i)=>`<button data-chat="${i}"><i></i><span><strong>${escapeHtml(p.name)}</strong><small>${i===0?'Avec plaisir, on échange…':'Votre profil nous plaît beaucoup.'}</small></span></button>`).join('')}</aside><main><header><strong>Camille & Thomas</strong><span>Profil vérifié · confiance 94%</span></header><div class="vc-bubbles"><p>Bonsoir, votre univers nous parle beaucoup.</p><p class="me">Merci, votre approche correspond parfaitement à l’esprit Velvet.</p><p>On se retrouve à la soirée de samedi ?</p></div><footer>Écrire un message… <button>Envoyer</button></footer></main></div></section>`,
      profile: `<section class="vc-profile-page"><div class="vc-cover"><span>Démonstration synthétique</span></div><div class="vc-profile-head"><div><small>Couple · Lille</small><h1>Camille & Thomas</h1><p>Complices, curieux et attachés aux échanges naturels, au respect et à la sensualité.</p></div><div class="vc-score">94<small>Confiance</small></div></div><div class="vc-grid"><article><h2>Notre univers</h2><p>Nous aimons les belles discussions, les soirées élégantes et les rencontres sans pression.</p></article><article><h2>Pacte Velvet</h2><p>Respect · Discrétion · Bienveillance · Consentement</p></article><article><h2>Albums privés</h2><p>Accès accordé uniquement par consentement explicite et pour une durée choisie.</p></article></div></section>`
    };
    return content[view] || content.home;
  }

  function render(view = 'home') {
    document.documentElement.style.background = '#0D0D0D';
    document.body.innerHTML = `<style>
      *{box-sizing:border-box}body{margin:0;background:#0D0D0D;color:#F4F4F2;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.vc-shell{min-height:100vh;background:radial-gradient(circle at 90% 0,#641b3635,transparent 30%),#0D0D0D}.vc-demo{position:sticky;top:0;z-index:20;display:flex;justify-content:center;gap:10px;padding:8px;background:#641B36;color:white;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.vc-nav{position:sticky;top:31px;z-index:19;display:flex;align-items:center;justify-content:space-between;padding:18px 5vw;border-bottom:1px solid #ffffff12;background:#0d0d0de8;backdrop-filter:blur(20px)}.vc-brand{font:500 26px Georgia;color:#C6A96A}.vc-links{display:flex;gap:6px}.vc-links button,.vc-title button,.vc-hero button{border:0;border-radius:999px;background:transparent;color:#ddd;padding:10px 13px;cursor:pointer}.vc-links button:hover,.vc-links button.active{background:#ffffff0d;color:#C6A96A}.vc-main{padding:34px 5vw 90px;display:grid;gap:42px}.vc-hero{min-height:420px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:42px;border:1px solid #ffffff16;border-radius:32px;background:linear-gradient(120deg,#181719,#361523)}.vc-eyebrow,.vc-title small{color:#C6A96A;text-transform:uppercase;letter-spacing:.16em;font-size:11px}.vc-hero h1,.vc-title h1,.vc-title h2,.vc-profile-head h1{font:500 clamp(34px,6vw,68px)/1 Georgia;margin:12px 0}.vc-hero p{max-width:640px;color:#d0cbc8;font-size:18px;line-height:1.65}.vc-hero button{background:#C6A96A;color:#141414;font-weight:800;padding:13px 18px}.vc-title{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:18px}.vc-title h2{font-size:36px}.vc-filters{display:flex;gap:8px;flex-wrap:wrap}.vc-filters span{border:1px solid #ffffff1c;border-radius:999px;padding:9px 12px;color:#ccc}.vc-profiles,.vc-events{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.vc-profiles.large{grid-template-columns:repeat(4,minmax(0,1fr))}.vc-profile,.vc-event{overflow:hidden;border:1px solid #ffffff12;border-radius:24px;background:#171719}.vc-photo{aspect-ratio:4/5;display:grid;place-items:end;padding:12px}.vc-photo span{font-size:10px;background:#0008;border-radius:999px;padding:6px 9px}.vc-profile-copy,.vc-event{padding:16px}.vc-profile h3,.vc-event h3{margin:5px 0;font-size:19px}.vc-profile p,.vc-event p{margin:5px 0;color:#aaa}.vc-profile small,.vc-event small{color:#C6A96A}.vc-trust{margin-top:12px;font-size:11px;color:#aaa}.vc-trust strong{float:right;color:#a8e0b1}.vc-events{grid-template-columns:repeat(3,minmax(0,1fr))}.vc-events.large{grid-template-columns:repeat(3,minmax(0,1fr))}.vc-event{min-height:190px;background:linear-gradient(145deg,#24151b,#161618)}.vc-event strong{display:block;margin-top:28px;color:#C6A96A}.vc-map{height:620px;position:relative;overflow:hidden;border:1px solid #ffffff14;border-radius:30px;background:#211e1d}.vc-map-grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:42px 42px;transform:rotate(8deg) scale(1.2)}.vc-pin{position:absolute;width:48px;height:48px;border:0;border-radius:50%;background:#641B36;color:#fff;box-shadow:0 8px 30px #0008}.vc-map aside{position:absolute;left:20px;bottom:20px;display:grid;gap:5px;padding:18px;border-radius:18px;background:#0d0d0de8}.vc-chat{display:grid;grid-template-columns:320px 1fr;min-height:650px;border:1px solid #ffffff14;border-radius:28px;overflow:hidden}.vc-chat aside{border-right:1px solid #ffffff12;background:#141416}.vc-chat aside button{width:100%;display:flex;gap:12px;padding:16px;border:0;border-bottom:1px solid #ffffff0d;background:transparent;color:white;text-align:left}.vc-chat aside i{width:42px;height:42px;border-radius:50%;background:#641B36}.vc-chat aside span{display:grid}.vc-chat aside small{color:#999}.vc-chat main{display:grid;grid-template-rows:auto 1fr auto}.vc-chat header,.vc-chat footer{padding:18px;border-bottom:1px solid #ffffff12}.vc-chat header span{display:block;color:#aaa;font-size:12px}.vc-bubbles{padding:30px}.vc-bubbles p{max-width:65%;padding:13px 16px;border-radius:18px;background:#232326}.vc-bubbles .me{margin-left:auto;background:#641B36}.vc-chat footer{border-top:1px solid #ffffff12;border-bottom:0;color:#888}.vc-chat footer button{float:right;border:0;border-radius:999px;background:#C6A96A;padding:8px 13px}.vc-cover{height:340px;border-radius:30px;background:linear-gradient(145deg,#641B36,#171719);display:grid;place-items:end;padding:18px}.vc-profile-head{display:flex;justify-content:space-between;gap:20px;padding:26px 0}.vc-profile-head p{max-width:700px;color:#aaa;line-height:1.6}.vc-score{width:110px;height:110px;border:1px solid #C6A96A;border-radius:50%;display:grid;place-items:center;font-size:34px;color:#C6A96A}.vc-score small{display:block;font-size:10px}.vc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.vc-grid article{padding:22px;border:1px solid #ffffff14;border-radius:22px;background:#171719}.vc-grid p{color:#aaa;line-height:1.6}@media(max-width:850px){.vc-links{overflow:auto}.vc-profiles,.vc-profiles.large{grid-template-columns:1fr 1fr}.vc-events,.vc-events.large,.vc-grid{grid-template-columns:1fr}.vc-chat{grid-template-columns:1fr}.vc-chat aside{display:none}}@media(max-width:540px){.vc-profiles,.vc-profiles.large{grid-template-columns:1fr}.vc-main{padding:22px 16px 90px}.vc-nav{padding:14px 16px}.vc-brand{display:none}}
    </style><div class="vc-shell"><div class="vc-demo">Démonstration interne · Données 100 % synthétiques · Aucune donnée membre réelle</div><nav class="vc-nav"><div class="vc-brand">VELVET</div><div class="vc-links">${[['home','Accueil'],['discover','Recherche'],['map','Carte'],['events','Sorties'],['messages','Messages'],['profile','Profil']].map(([id,label])=>`<button class="${id===view?'active':''}" data-vc-view="${id}">${label}</button>`).join('')}</div></nav><main class="vc-main">${screen(view)}</main></div>`;
    document.querySelectorAll('[data-vc-view]').forEach((button) => button.addEventListener('click', () => render(button.dataset.vcView)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render('home'), { once: true });
  else render('home');
})();
