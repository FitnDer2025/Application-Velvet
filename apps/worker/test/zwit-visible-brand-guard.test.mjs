import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile('apps/beta/static/assets/velvet-production-surface.js', 'utf8');

test('la couche visible remplace l’ancienne marque dans les contenus dynamiques', () => {
  assert.match(source, /\\bVELVET\\b\/g, 'ZWIT'/);
  assert.match(source, /\\bVelvet\\b\/g, 'Zwit'/);
  assert.match(source, /HTMLInputElement/);
  assert.match(source, /HTMLTextAreaElement/);
  assert.match(source, /cleanControlValue/);
});

test('Studio protège aussi les aperçus vidéo et la voix off', () => {
  assert.match(source, /CanvasRenderingContext2D/);
  assert.match(source, /guardedFillText/);
  assert.match(source, /guardedStrokeText/);
  assert.match(source, /SpeechSynthesisUtterance/);
  assert.match(source, /ZWIT_SPEECH_BRAND_GUARD/);
});

test('les identifiants techniques historiques restent intacts', () => {
  assert.match(source, /__VELVET_PRODUCTION_SURFACE__/);
  assert.match(source, /velvetProductionSurfaceStyles/);
  assert.match(source, /#velvetMarketingBadge/);
});
