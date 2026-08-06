import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = 'apps/beta/static/assets/velvet-studio-sprint1.js';
const stylePath = 'apps/beta/static/assets/velvet-studio-sprint1.css';
const buildPath = 'apps/beta/scripts/build.mjs';

test('Zwit Studio Sprint 1 exposes the professional production workspace', async () => {
  const [script, style, build] = await Promise.all([
    readFile(scriptPath, 'utf8'),
    readFile(stylePath, 'utf8'),
    readFile(buildPath, 'utf8')
  ]);

  for (const marker of [
    'Moniteur réalisateur',
    'Timeline',
    'Storyboard vivant',
    'Équipe créative IA',
    'Capturer écran',
    'Caméra',
    'Synthèse vocale',
    'maquette musicale',
    'Sauver une version',
    'Bibliothèque de projets'
  ]) assert.ok(script.includes(marker), `Marqueur Studio manquant : ${marker}`);

  assert.ok(script.includes('getDisplayMedia'), 'La capture écran live doit être disponible');
  assert.ok(script.includes('getUserMedia'), 'La prise de vue caméra doit être disponible');
  assert.ok(script.includes('MediaRecorder'), 'L’enregistrement de plans doit être disponible');
  assert.ok(script.includes('SpeechSynthesisUtterance'), 'La voix off locale doit être prévisualisable');
  assert.ok(script.includes('AudioContext'), 'La maquette musicale doit être prévisualisable');
  assert.ok(style.includes('.vs1-workspace'), 'Le layout studio doit exister');
  assert.ok(style.includes('.vs1-timeline'), 'Le style timeline doit exister');
  assert.ok(build.includes('velvet-studio-sprint1.js'), 'Le build BETA doit charger le Sprint 1');
  assert.ok(build.includes('velvet-studio-sprint1.css'), 'Le build BETA doit versionner le style Sprint 1');

  const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});
