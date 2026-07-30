import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'Velvet.xcodeproj/project.pbxproj',
  'Velvet/VelvetApp.swift',
  'Velvet/App/AppState.swift',
  'Velvet/App/RootView.swift',
  'Velvet/Core/Networking/APIClient.swift',
  'Velvet/Core/Session/SessionService.swift',
  'Velvet/DesignSystem/VelvetTokens.swift',
  'Velvet/Features/Authentication/LoginView.swift',
  'Velvet/Features/Authentication/ConsentView.swift',
  'Velvet/Features/Onboarding/OnboardingFlowView.swift',
  'Velvet/Features/Home/HomeView.swift',
  'Velvet/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json'
];

for (const file of requiredFiles) {
  const result = await stat(resolve(root, file));
  assert(result.isFile(), `${file} doit être un fichier`);
}

const project = await readFile(resolve(root, 'Velvet.xcodeproj/project.pbxproj'), 'utf8');
assert.match(project, /productType = "com\.apple\.product-type\.application"/);
assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0/);
assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.velvetapplication\.app/);

const tokens = await readFile(resolve(root, 'Velvet/DesignSystem/VelvetTokens.swift'), 'utf8');
for (const color of ['0x0D0D0D', '0x641B36', '0xC6A96A', '0xF4F4F2']) {
  assert(tokens.includes(color), `Le token ${color} doit rester synchronisé`);
}

const debugConfig = await readFile(resolve(root, 'Config/Debug.xcconfig'), 'utf8');
assert.match(debugConfig, /velvet-beta\.sh96hv64dj\.workers\.dev/);

console.log('Velvet iOS foundation: structure validée.');
