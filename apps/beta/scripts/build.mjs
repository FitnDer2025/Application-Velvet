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

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let auth = await required(sources.auth);
auth = auth
  .replaceAll('./velvet-members-v6-beta-rc2.html', '/membres/')
  .replaceAll('./velvet-members-beta-rc1.html', '/membres/')
  .replace('</body>', '<script src="/assets/real-auth-gate.js"></script></body>');
await emit(resolve(output, 'index.html'), addLegalBar(auth));

await emit(resolve(output, 'membres/index.html'), addLegalBar(await required(sources.members)));

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
  .replace('</body>', '<script src="/assets/pro-live.js"></script><script src="/assets/account-access-menu.js?v=20260804-1"></script></body>');
await emit(resolve(output, 'pro/index.html'), addLegalBar(pro));

let control = await required(sources.control);
control = control.replace('</body>', '<script src="/assets/control-live.js?v=20260804-2"></script><script src="/assets/velvet-studio-control.js?v=20260804-1"></script><script src="/assets/account-access-menu.js?v=20260804-1"></script></body>');
await emit(resolve(output, 'control/index.html'), addLegalBar(control));
await cp(sources.controlD, resolve(output, 'control/velvet-control-intelligence-d-beta.html'));
await cp(sources.controlC, resolve(output, 'control/velvet-control-intelligence-c-beta.html'));
await cp(sources.controlB, resolve(output, 'control/velvet-control-intelligence-b-beta.html'));
await cp(sources.controlBase, resolve(output, 'control/velvet-control-v1-beta.html'));

await cp(staticDir, output, { recursive: true });
console.log(`Velvet BETA préparée dans ${output}`);
