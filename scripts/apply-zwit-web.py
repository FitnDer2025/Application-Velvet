from pathlib import Path

root = Path('.')
prod = root / 'apps/beta/static/assets/velvet-production-surface.js'
text = prod.read_text()
needle = "  [0, 250, 1000].forEach((delay) => setTimeout(() => clean(document), delay));\n"
loader = """  if (!document.querySelector('script[data-zwit-experience]')) {
    const experience = document.createElement('script');
    experience.src = '/assets/zwit-experience.js?v=20260806-1';
    experience.dataset.zwitExperience = 'true';
    document.head.appendChild(experience);
  }
"""
if 'data-zwit-experience' not in text:
    if needle not in text:
        raise SystemExit('production surface insertion point missing')
    text = text.replace(needle, needle + loader, 1)
prod.write_text(text)

test = root / 'apps/beta/test/zwit-experience.test.mjs'
test.write_text("""import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const web = await readFile(new URL('apps/beta/static/assets/zwit-experience.js', root), 'utf8');
const messaging = await readFile(new URL('ios/Velvet/Features/Messaging/RealtimeAppleMessagingViews.swift', root), 'utf8');
const profile = await readFile(new URL('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift', root), 'utf8');
const launch = await readFile(new URL('ios/Velvet/App/RootView.swift', root), 'utf8');

test('Zwit opening is multilingual and discreet', () => {
  assert.match(web, /Chut/);
  assert.match(web, /Silencio/);
  assert.match(web, /静かに/);
  assert.match(launch, /Un secret se partage/);
});

test('messages expose day separators and swipe dates', () => {
  assert.match(messaging, /RealtimeMessageDaySeparator/);
  assert.match(messaging, /DragGesture/);
  assert.match(web, /zwit-day-separator/);
});

test('member profiles expose both album actions', () => {
  assert.match(profile, /Demander l’ouverture d’un album/);
  assert.match(profile, /Ouvrir mes albums privés/);
  assert.match(web, /data-request-album/);
  assert.match(web, /data-open-my-albums/);
});
""")

for disposable in ['scripts/apply-zwit-web.py', '.github/workflows/apply-zwit-web.yml']:
    path = root / disposable
    if path.exists():
        path.unlink()
