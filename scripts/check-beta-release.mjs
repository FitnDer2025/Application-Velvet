import { readFile } from 'node:fs/promises';

const [members, pro, control, worker] = await Promise.all([
  readFile('apps/beta/dist/membres/index.html', 'utf8'),
  readFile('apps/beta/dist/pro/index.html', 'utf8'),
  readFile('apps/beta/dist/control/index.html', 'utf8'),
  readFile('apps/beta/worker/index.js', 'utf8')
]);
const controlLive = await readFile('apps/beta/static/assets/control-live.js', 'utf8');

const checks = [
  [members.includes('/assets/members-onboarding-v2.js'), 'Velvet Membres doit charger son parcours Supabase'],
  [pro.includes('/assets/pro-live.js'), 'Velvet Pro doit charger son workspace Supabase'],
  [pro.includes('const BASE_VENUES=[];'), 'Les établissements fictifs doivent être retirés du livrable Pro'],
  [pro.includes('const MEMBERS=[];'), 'Les membres fictifs doivent être retirés du livrable Pro'],
  [pro.includes('const BASE_EVENTS=[];'), 'Les soirées fictives doivent être retirées du livrable Pro'],
  [pro.includes('const BASE_BOOKINGS=[];'), 'Les réservations fictives doivent être retirées du livrable Pro'],
  [pro.includes('const THREADS=[];'), 'Les conversations fictives doivent être retirées du livrable Pro'],
  [!pro.includes('@demo-velvet.fr'), 'Aucune identité de démonstration ne doit rester dans le livrable Pro'],
  [pro.includes('if(!document.body.classList.contains("pro-live-pending"))render();'), 'Le prototype Pro ne doit pas s’afficher avant le chargement serveur'],
  [control.includes('/assets/control-live.js'), 'Velvet Control doit charger ses opérations réelles'],
  [controlLive.includes('originalShowView') && controlLive.includes("document.querySelectorAll('.page')"), 'La navigation Control doit permettre le retour depuis Invitations'],
  [worker.includes("'GET /api/members/profile'"), 'Les API Membres doivent être routées'],
  [worker.includes("'GET /api/pro/workspace'"), 'Les API Pro doivent être routées'],
  [worker.includes("'GET /api/control/workspace'"), 'Les API Control doivent être routées']
];

for (const [valid, message] of checks) {
  if (!valid) throw new Error(message);
}

console.log(`Velvet BETA release gate passed: ${checks.length} contrôles de publication`);
