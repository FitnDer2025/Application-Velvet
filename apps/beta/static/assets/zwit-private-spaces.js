(() => {
  if (!location.pathname.startsWith('/membres')) return;

  let layer = null;
  let spaces = [];
  let activeSpace = null;
  let pollTimer = null;
  let lastMessageId = 0;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const arr = v => Array.isArray(v) ? v : [];

  async function api(options = {}) {
    const response = await fetch(options.url || '/api/members/spaces', {
      credentials:'same-origin', cache:'no-store', ...options,
      headers:{...(options.body ? {'content-type':'application/json'} : {}),...(options.headers||{})}
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'space_failed');
    return payload;
  }

  function toast(message, error=false) {
    const node=document.querySelector('#toast'); if(!node)return;
    node.textContent=message; node.classList.toggle('error',error); node.classList.add('visible');
    setTimeout(()=>node.classList.remove('visible'),3300);
  }

  function stopPoll(){ if(pollTimer) clearTimeout(pollTimer); pollTimer=null; }
  function close(){ stopPoll(); layer?.remove(); layer=null; activeSpace=null; lastMessageId=0; }

  function ensureNav(){
    if(document.querySelector('[data-zwit-spaces-open]')) return;
    const tools=document.querySelector('.sidebar-tools');
    if(!tools) return;
    const btn=document.createElement('button'); btn.type='button'; btn.dataset.zwitSpacesOpen='1';
    btn.innerHTML='<span>◎</span>Cercles & chats';
    const tonight=tools.querySelector('[data-zwit-route="tonight"]');
    tonight?.insertAdjacentElement('afterend',btn) || tools.appendChild(btn);
  }

  function shell(){
    layer=document.createElement('section'); layer.className='zps-layer'; layer.dataset.zwitSpacesLayer='1';
    layer.innerHTML='<div class="zps-shell"><header><div><span>ESPACES PRIVÉS</span><h2>Cercles & chats</h2><p>Des petits espaces choisis. Jamais de groupe public imposé.</p></div><button type="button" data-zps-close>×</button></header><main data-zps-main><div class="zps-loading">Ouverture de vos espaces…</div></main></div>';
    document.body.appendChild(layer); requestAnimationFrame(()=>layer.classList.add('visible'));
  }

  function spaceCard(s){
    const invited=s.status==='invited'; const kind=s.kind==='event'?'Chat de soirée':'Cercle privé';
    return `<article class="zps-space"><button type="button" class="zps-space-open" data-zps-open="${esc(s.space_id)}" ${invited?'disabled':''}><span>${s.kind==='event'?'✦':'◎'}</span><div><small>${kind}</small><strong>${esc(s.title)}</strong><em>${Number(s.member_count||0)} membre${Number(s.member_count||0)>1?'s':''}${Number(s.unread_count||0)>0?` · ${Number(s.unread_count)} non lu${Number(s.unread_count)>1?'s':''}`:''}</em></div></button>${invited?`<button type="button" data-zps-accept="${esc(s.space_id)}">Accepter l’invitation</button>`:''}</article>`;
  }

  function renderList(){
    const main=layer?.querySelector('[data-zps-main]'); if(!main)return;
    main.innerHTML=`<section class="zps-list-head"><div><span>VOS ESPACES</span><strong>${spaces.length}</strong></div><button type="button" data-zps-new>Nouveau cercle</button></section><div class="zps-list">${spaces.length?spaces.map(spaceCard).join(''):'<div class="zps-empty"><strong>Votre premier cercle commence ici.</strong><p>Invitez seulement les personnes avec lesquelles vous souhaitez réellement partager un espace.</p></div>'}</div>`;
  }

  async function loadList(){
    const payload=await api(); spaces=arr(payload.spaces); renderList();
  }

  function createCircleForm(){
    const main=layer.querySelector('[data-zps-main]');
    main.innerHTML='<form class="zps-create" data-zps-create><button type="button" class="zps-back" data-zps-back>← Vos espaces</button><span>NOUVEAU CERCLE</span><h3>Un espace à votre mesure</h3><label><small>Nom</small><input name="title" maxlength="80" required placeholder="Ex. Nos belles rencontres"></label><label><small>Quelques mots</small><textarea name="description" maxlength="500" rows="4" placeholder="À qui s’adresse ce cercle, quelle ambiance…"></textarea></label><p>Le cercle est privé. Vous choisirez ensuite les profils à inviter depuis leur fiche.</p><button type="submit" class="primary">Créer le cercle</button></form>';
  }

  async function openSpace(id){
    activeSpace=spaces.find(s=>s.space_id===id)||{space_id:id,title:'Espace Zwit'}; lastMessageId=0;
    const main=layer.querySelector('[data-zps-main]');
    main.innerHTML=`<section class="zps-chat"><header><button type="button" data-zps-back>←</button><div><small>${activeSpace.kind==='event'?'CHAT DE SOIRÉE':'CERCLE PRIVÉ'}</small><strong>${esc(activeSpace.title)}</strong></div><button type="button" data-zps-members>Membres</button></header><div class="zps-messages" data-zps-messages><div class="zps-loading">Chargement…</div></div><form data-zps-send><textarea name="message" rows="1" maxlength="4000" placeholder="Écrire au cercle…" required></textarea><button type="submit">Envoyer</button></form></section>`;
    await refreshMessages(true); poll();
  }

  function messageHtml(m){
    return `<article class="zps-message${m.mine?' mine':''}" data-space-message-id="${Number(m.message_id)}"><small>${m.mine?'Vous':esc(m.sender_display_name||'Membre Zwit')}</small><p>${esc(m.body)}</p><time>${new Date(m.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time>${m.mine?'':`<button type="button" data-zps-report="${Number(m.message_id)}">Signaler</button>`}</article>`;
  }

  async function refreshMessages(reset=false){
    if(!activeSpace)return;
    const payload=await api({url:`/api/members/spaces?spaceId=${encodeURIComponent(activeSpace.space_id)}&afterMessageId=${reset?0:lastMessageId}`});
    const messages=arr(payload.messages); const host=layer?.querySelector('[data-zps-messages]'); if(!host)return;
    if(reset){host.innerHTML=''; lastMessageId=0;}
    messages.forEach(m=>{ if(Number(m.message_id)>lastMessageId){host.insertAdjacentHTML('beforeend',messageHtml(m));lastMessageId=Math.max(lastMessageId,Number(m.message_id));} });
    if(!host.children.length) host.innerHTML='<div class="zps-empty compact">Le premier message donnera le ton.</div>';
    if(messages.length) host.scrollTo({top:host.scrollHeight,behavior:reset?'auto':'smooth'});
    activeSpace.members=arr(payload.members);
  }

  function poll(){ stopPoll(); if(!activeSpace)return; pollTimer=setTimeout(async()=>{try{await refreshMessages(false);}catch{}finally{if(activeSpace)poll();}},2200); }

  function showMembers(){
    const members=arr(activeSpace?.members); const main=layer.querySelector('[data-zps-main]');
    main.innerHTML=`<section class="zps-members"><button type="button" class="zps-back" data-zps-reopen>← Conversation</button><span>MEMBRES</span><h3>${esc(activeSpace.title)}</h3><div>${members.map(m=>`<article><i>${esc((m.display_name||'Z').slice(0,1).toUpperCase())}</i><strong>${esc(m.display_name||'Membre Zwit')}</strong><small>${m.mine?'Vous':m.role==='owner'?'Créateur':m.role==='moderator'?'Modérateur':m.membership_status==='invited'?'Invité':'Membre'}</small></article>`).join('')}</div>${activeSpace.kind==='circle'&&activeSpace.role!=='owner'?'<button type="button" class="danger" data-zps-leave>Quitter ce cercle</button>':''}</section>`;
  }

  async function open(){ if(layer)return; shell(); try{await loadList();}catch{layer.querySelector('[data-zps-main]').innerHTML='<div class="zps-empty"><strong>Espaces indisponibles.</strong><p>Réessayez dans quelques instants.</p></div>';} }

  async function joinEventChat(eventId){
    try{
      const payload=await api({method:'POST',body:JSON.stringify({action:'event_chat',eventId})});
      await open(); await loadList(); await openSpace(payload.spaceId);
    }catch(error){ toast(error.message==='confirmed_registration_required'?'Le chat est réservé aux participants confirmés.':error.message==='event_chat_not_open_yet'?'Le chat ouvrira 48 h avant la soirée.':'Le chat de cette soirée n’est pas encore accessible.',true); }
  }

  function enhanceEvents(){
    document.querySelectorAll('[data-event-id],[data-event],[data-open-event]').forEach(node=>{
      const id=node.dataset.eventId||node.dataset.event||node.dataset.openEvent;
      if(!/^[0-9a-f-]{36}$/i.test(id||'')||node.querySelector?.('[data-zps-event-chat]'))return;
      const host=node.matches('article,section,div')?node:node.closest('article,section,div'); if(!host||host.querySelector('[data-zps-event-chat]'))return;
      const btn=document.createElement('button');btn.type='button';btn.className='zps-event-chat';btn.dataset.zpsEventChat=id;btn.textContent='Chat de la soirée';host.appendChild(btn);
    });
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-zwit-spaces-open]')) return open();
    if(event.target.closest('[data-zps-close]')||event.target.matches('[data-zwit-spaces-layer]')) return close();
    if(event.target.closest('[data-zps-new]')) return createCircleForm();
    if(event.target.closest('[data-zps-back]')){stopPoll();activeSpace=null;return renderList();}
    if(event.target.closest('[data-zps-reopen]')) return openSpace(activeSpace.space_id);
    const openBtn=event.target.closest('[data-zps-open]');if(openBtn)return openSpace(openBtn.dataset.zpsOpen);
    const accept=event.target.closest('[data-zps-accept]');if(accept){accept.disabled=true;api({method:'POST',body:JSON.stringify({action:'accept_invite',spaceId:accept.dataset.zpsAccept})}).then(loadList).catch(()=>{accept.disabled=false;});return;}
    if(event.target.closest('[data-zps-members]'))return showMembers();
    if(event.target.closest('[data-zps-leave]')){api({method:'POST',body:JSON.stringify({action:'leave',spaceId:activeSpace.space_id})}).then(async()=>{stopPoll();activeSpace=null;await loadList();}).catch(()=>toast('Impossible de quitter ce cercle.',true));return;}
    const report=event.target.closest('[data-zps-report]');if(report){const reason=prompt('Pourquoi signalez-vous ce message ?');if(reason?.trim())api({method:'POST',body:JSON.stringify({action:'report',spaceId:activeSpace.space_id,messageId:Number(report.dataset.zpsReport),reason})}).then(()=>toast('Signalement transmis à Zwit Contrôle.')).catch(()=>toast('Signalement impossible.',true));return;}
    const eventChat=event.target.closest('[data-zps-event-chat]');if(eventChat){event.preventDefault();event.stopPropagation();return joinEventChat(eventChat.dataset.zpsEventChat);}
  });

  document.addEventListener('submit',event=>{
    const create=event.target.closest('[data-zps-create]');if(create){event.preventDefault();const data=new FormData(create);const btn=create.querySelector('[type=submit]');btn.disabled=true;api({method:'POST',body:JSON.stringify({action:'create_circle',title:data.get('title'),description:data.get('description')})}).then(async payload=>{await loadList();await openSpace(payload.spaceId);toast('Cercle créé. Invitez maintenant les profils de votre choix.');}).catch(()=>{btn.disabled=false;toast('Le cercle n’a pas pu être créé.',true);});return;}
    const send=event.target.closest('[data-zps-send]');if(send){event.preventDefault();const textarea=send.querySelector('textarea');const text=textarea.value.trim();if(!text)return;const btn=send.querySelector('button');btn.disabled=true;api({method:'POST',body:JSON.stringify({action:'send',spaceId:activeSpace.space_id,message:text})}).then(async()=>{textarea.value='';btn.disabled=false;await refreshMessages(false);}).catch(()=>{btn.disabled=false;toast('Message non envoyé.',true);});}
  });

  const observer=new MutationObserver(()=>{ensureNav();enhanceEvents();});observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureNav();enhanceEvents();
  window.ZwitPrivateSpaces=Object.freeze({open,joinEventChat});
})();
