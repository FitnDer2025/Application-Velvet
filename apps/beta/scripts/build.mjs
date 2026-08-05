import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const output = resolve(root, 'apps/beta/dist');
const web = resolve(root, 'apps/web');
const staticDir = resolve(root, 'apps/beta/static');

const sources = {
  auth: resolve(web, 'velvet-auth-beta-rc1.html'),
  members: resolve(web, 'velvet-members-beta-live.html'),
  pro: resolve(web, 'velvet-pro-beta-rc1.html'),
  control: resolve(web, 'velvet-control-intelligence-beta-final.html'),
  controlD: resolve(web, 'velvet-control-intelligence-d-beta.html'),
  controlC: resolve(web, 'velvet-control-intelligence-c-beta.html'),
  controlB: resolve(web, 'velvet-control-intelligence-b-beta.html'),
  controlBase: resolve(web, 'velvet-control-v1-beta.html')
};

async function required(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new Error(`Source BETA manquante : ${path}. Synchronisez d’abord la branche v1-lived-demo.`);
  }
}

async function emit(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function legalBar() {
  return `<nav aria-label="Informations légales" style="position:fixed;z-index:9998;right:12px;bottom:12px;display:flex;gap:8px;padding:8px 10px;border:1px solid #ffffff22;border-radius:999px;background:#0d0d0de8;backdrop-filter:blur(12px);font:11px Arial;color:#ddd">
    <a href="/legal/privacy/" style="color:#ddd">Confidentialité</a>
    <a href="/legal/terms/" style="color:#ddd">Conditions BETA</a>
    <a href="/legal/safety/" style="color:#ddd">Sécurité</a>
  </nav>`;
}

function addLegalBar(html) {
  return html.replace('</body>', `${legalBar()}</body>`);
}

function capturePage() {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#08080a"><title>Velvet Studio — Tournage social</title><link rel="icon" href="/assets/velvet-icon-192.png" type="image/png"><style>
  :root{--gold:#d8bd77;--wine:#7d294c;--bg:#08080a;--text:#f7f2ed;--muted:#aaa3a0}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 50% 0,#4b1d33 0,#111014 34%,#050507 72%);color:var(--text);font-family:Inter,Arial,sans-serif;overflow:hidden}button,a{font:inherit}.vsc-stage{position:fixed;inset:0;display:grid;place-items:center;padding:3vh 3vw}.vsc-frame{position:relative;overflow:hidden;border:1px solid #ffffff24;border-radius:24px;background:#0d0d0f;box-shadow:0 45px 140px #000c}.vsc-frame[data-format="9:16"]{height:94vh;aspect-ratio:9/16}.vsc-frame[data-format="1:1"]{width:min(92vw,92vh);aspect-ratio:1}.vsc-frame[data-format="16:9"]{width:94vw;aspect-ratio:16/9}.vsc-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#0d0d0f}.vsc-cursor{position:absolute;z-index:16;width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#d8bd77cc;box-shadow:0 5px 22px #0009;transform:translate(-50%,-50%);transition:left .5s cubic-bezier(.2,.8,.2,1),top .5s cubic-bezier(.2,.8,.2,1),transform .16s}.vsc-cursor.click{transform:translate(-50%,-50%) scale(.62)}.vsc-caption{position:absolute;z-index:14;left:18px;right:18px;bottom:18px;padding:13px 15px;border:1px solid #ffffff20;border-radius:15px;background:#070709d9;backdrop-filter:blur(14px);opacity:0;transform:translateY(12px);transition:.35s}.vsc-caption.visible{opacity:1;transform:none}.vsc-caption small{display:block;color:var(--gold);font-weight:900;font-size:9px;letter-spacing:.15em}.vsc-caption h2{margin:6px 0 3px;font:500 clamp(18px,3vw,30px) Georgia}.vsc-caption p{margin:0;color:#d0c8c4;font-size:11px}.vsc-intro,.vsc-outro{position:absolute;z-index:20;inset:0;display:grid;place-items:center;padding:30px;background:radial-gradient(circle at 50% 32%,#5a243d,#0b0b0d 67%);text-align:center;opacity:1;transition:opacity .6s}.vsc-intro.hidden,.vsc-outro.hidden{opacity:0;pointer-events:none}.vsc-logo{color:var(--gold);font:500 clamp(48px,9vw,100px) Georgia;letter-spacing:.12em}.vsc-tagline{max-width:650px;margin:17px auto 0;color:#f4efea;font:500 clamp(15px,2.2vw,23px)/1.5 Inter}.vsc-overlay{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:18px;background:#050507e8;backdrop-filter:blur(18px);transition:.35s}.vsc-overlay.hidden{opacity:0;pointer-events:none}.vsc-panel{width:min(620px,100%);padding:28px;border:1px solid #ffffff1f;border-radius:28px;background:radial-gradient(circle at 100% 0,#7d294c33,transparent 40%),#111114;box-shadow:0 40px 130px #000}.vsc-panel>span,.vsc-result-card>span{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:.18em}.vsc-panel h1,.vsc-result-card h1{margin:9px 0 12px;font:500 clamp(36px,6vw,58px)/1 Georgia}.vsc-panel p,.vsc-result-card p{color:var(--muted);line-height:1.65}.vsc-instructions{display:grid;gap:9px;margin:20px 0}.vsc-instructions div{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;padding:11px;border:1px solid #ffffff12;border-radius:13px;background:#ffffff06}.vsc-instructions b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#d8bd771c;color:var(--gold);font-size:11px}.vsc-status{min-height:18px;margin:13px 0;color:#bbb4b0;font-size:12px}.vsc-status[data-tone="error"]{color:#ef9aa8}.vsc-buttons{display:flex;gap:9px}.vsc-buttons button,.vsc-buttons a,.vsc-result-card>div a,.vsc-result-card>div button{flex:1;border:0;border-radius:999px;padding:13px 16px;background:linear-gradient(135deg,#dfc577,#b98a42);color:#171109;text-align:center;text-decoration:none;cursor:pointer;font-weight:900}.vsc-buttons button.secondary,.vsc-result-card>div button,.vsc-result-card>div a:last-child{border:1px solid #ffffff1f;background:#19191c;color:#f5f0ec}.vsc-progress{position:fixed;z-index:70;left:15px;bottom:14px;padding:9px 12px;border:1px solid #d8bd7733;border-radius:999px;background:#08080ad9;color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.13em}.vsc-result{position:fixed;z-index:120;inset:0;overflow:auto;padding:24px;background:radial-gradient(circle at 50% 0,#502038,#070709 58%)}.vsc-result-card{width:min(980px,100%);margin:auto;text-align:center}.vsc-result-card video{display:block;width:100%;max-height:68vh;margin:22px 0;border:1px solid #ffffff20;border-radius:24px;background:#000;box-shadow:0 28px 90px #000b}.vsc-result-card>div{display:flex;flex-wrap:wrap;gap:9px}.recording .vsc-progress{display:block}@media(max-width:600px){.vsc-panel{padding:22px}.vsc-buttons,.vsc-result-card>div{flex-direction:column}.vsc-frame[data-format="9:16"]{height:90vh}}
</style></head><body>
<main class="vsc-stage" data-vsc-progress><section class="vsc-frame" data-vsc-frame data-format="9:16"><iframe data-vsc-iframe title="Véritable environnement Velvet Marketing"></iframe><div class="vsc-cursor" data-vsc-cursor style="left:50%;top:50%"></div><div class="vsc-caption"><small data-vsc-step>PRÉPARATION</small><h2 data-vsc-title>Velvet</h2><p data-vsc-subtitle></p></div><div class="vsc-intro hidden" data-vsc-intro><div><div class="vsc-logo">VELVET</div><div class="vsc-tagline">Là où les plus belles rencontres commencent.</div></div></div><div class="vsc-outro hidden" data-vsc-outro><div><div class="vsc-logo">VELVET</div><div class="vsc-tagline">Rejoignez un univers pensé pour les rencontres, les expériences et la confiance.</div></div></div></section><div class="vsc-progress"><span data-vsc-universe>VELVET</span> · <span data-vsc-format>FORMAT SOCIAL</span></div></main>
<section class="vsc-overlay" data-vsc-overlay><div class="vsc-panel"><span>TOURNAGE SOCIAL VELVET</span><h1>Le vrai site.<br>La vraie histoire.</h1><p>Une seule autorisation est nécessaire pour enregistrer la navigation et la voix française dans la vidéo.</p><div class="vsc-instructions"><div><b>1</b><span>Clique sur « Démarrer le tournage ».</span></div><div><b>2</b><span>Choisis <strong>cet onglet Velvet</strong>.</span></div><div><b>3</b><span>Active impérativement <strong>Partager l’audio de l’onglet</strong>.</span></div></div><div class="vsc-status" data-vsc-status>Chargement du véritable environnement Velvet Marketing…</div><div class="vsc-buttons"><button type="button" data-vsc-start>Démarrer le tournage</button><button type="button" class="secondary" data-vsc-cancel>Annuler</button></div></div></section>
<section class="vsc-result" data-vsc-result hidden></section><script src="/assets/velvet-studio-capture.js?v=20260804-9"></script></body></html>`;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let auth = await required(sources.auth);
auth = auth
  .replaceAll('./velvet-members-v6-beta-rc2.html', '/membres/')
  .replaceAll('./velvet-members-beta-rc1.html', '/membres/')
  .replace('</body>', '<script src="/assets/real-auth-gate.js"></script></body>');
await emit(resolve(output, 'index.html'), addLegalBar(auth));

const membersSource = await required(sources.members);
let members = membersSource.replace('<head>', '<head><script src="/assets/velvet-capture-mode.js?v=20260804-5"></script>');
await emit(resolve(output, 'membres/index.html'), addLegalBar(members));

let marketing = membersSource
  .replace('<head>', '<head><script src="/assets/velvet-marketing-mode.js?v=20260804-9"></script>')
  .replace('<title>Velvet Membres — BETA privée</title>', '<title>Velvet — BETA Marketing</title>')
  .replaceAll('href="/membres/"', 'href="/marketing/"')
  .replaceAll('BETA privée', 'BETA Marketing')
  .replace('Données réelles Supabase', 'Données fictives · environnement marketing');
await emit(resolve(output, 'marketing/index.html'), addLegalBar(marketing));

let pro = await required(sources.pro);
pro = pro
  .replace(/const BASE_VENUES=\[[\s\S]*?\];\s*const MEMBERS=/, 'const BASE_VENUES=[];\nconst MEMBERS=')
  .replace(/const MEMBERS=\[[\s\S]*?\];\s*const BASE_EVENTS=/, 'const MEMBERS=[];\nconst BASE_EVENTS=')
  .replace(/const BASE_EVENTS=\[[\s\S]*?\];\s*const BASE_BOOKINGS=/, 'const BASE_EVENTS=[];\nconst BASE_BOOKINGS=')
  .replace(/const BASE_BOOKINGS=\[[\s\S]*?\];\s*const THREADS=/, 'const BASE_BOOKINGS=[];\nconst THREADS=')
  .replace(/const THREADS=\[[\s\S]*?\];\s*let S=/, 'const THREADS=[];\nlet S=')
  .replace(/function dashboard\(\)\{[\s\S]*?\n\}\nfunction eventCards/, 'function dashboard(){return `<div class="card">Connexion aux données Velvet Pro…</div>`}\nfunction eventCards')
  .replace(/function teamPage\(\)\{[\s\S]*?\n\}\nfunction openTeamInvite/, 'function teamPage(){return `<div class="card">La gestion d’équipe sera activée après raccordement serveur.</div>`}\nfunction openTeamInvite')
  .replace(/<div class="sidebar-foot">[\s\S]*?<\/div><\/div>\s*<\/aside>/, '<div class="sidebar-foot"><div class="account"><div><b>Compte Velvet Pro</b><small>Session sécurisée</small></div></div></div></aside>')
  .replace(/\nrender\(\);\n<\/script>/, '\nif(!document.body.classList.contains("pro-live-pending"))render();\n</script>')
  .replace('<body>', '<body class="pro-live-pending"><style>.pro-live-pending .shell,.pro-live-pending .mobile-nav{visibility:hidden}.pro-live-pending:after{content:"VELVET PRO · Connexion au CRM…";position:fixed;inset:0;display:grid;place-items:center;background:#09090b;color:#d5b477;font:500 16px Georgia;letter-spacing:.14em}</style>')
  .replace('</body>', '<script src="/assets/pro-live.js"></script><script src="/assets/velvet-pro-studio-ai.js?v=20260805-1"></script><script src="/assets/account-access-menu.js?v=20260804-1"></script></body>');
await emit(resolve(output, 'pro/index.html'), addLegalBar(pro));

let marketingPro = pro
  .replace('<head>', '<head><script src="/assets/velvet-marketing-pro-mode.js?v=20260804-9"></script>')
  .replace('<title>Velvet Pro — CRM établissements</title>', '<title>Velvet Pro — BETA Marketing</title>');
await emit(resolve(output, 'marketing-pro/index.html'), addLegalBar(marketingPro));

let control = await required(sources.control);
control = control.replace('</head>', '<link rel="stylesheet" href="/assets/velvet-studio-sprint1.css?v=20260804-3"></head>');
control = control.replace('</body>', '<script src="/assets/control-live.js?v=20260804-2"></script><script src="/assets/velvet-studio-sprint1.js?v=20260804-3"></script><script src="/assets/velvet-studio-ai-module.js?v=20260804-9"></script><script src="/assets/velvet-control-scroll-recovery.js?v=20260804-1"></script><script src="/assets/account-access-menu.js?v=20260804-1"></script></body>');
await emit(resolve(output, 'control/index.html'), addLegalBar(control));
await cp(sources.controlD, resolve(output, 'control/velvet-control-intelligence-d-beta.html'));
await cp(sources.controlC, resolve(output, 'control/velvet-control-intelligence-c-beta.html'));
await cp(sources.controlB, resolve(output, 'control/velvet-control-intelligence-b-beta.html'));
await cp(sources.controlBase, resolve(output, 'control/velvet-control-v1-beta.html'));

await emit(resolve(output, 'studio-capture/index.html'), capturePage());
await cp(staticDir, output, { recursive: true });
console.log(`Velvet BETA préparée dans ${output}`);
