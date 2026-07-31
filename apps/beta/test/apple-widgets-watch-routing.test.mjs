import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('notification navigation leaves the modal before opening sensitive destinations', async () => {
  const [notifications, shell, service, appState] = await Promise.all([
    read('ios/Velvet/Features/Home/NotificationsView.swift'),
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Core/System/NotificationService.swift'),
    read('ios/Velvet/App/AppState.swift')
  ]);

  assert.match(notifications, /let onDestination: \(VelvetNotificationDestination\) -> Void/);
  assert.doesNotMatch(notifications, /navigationDestination/);
  assert.match(shell, /openPendingNotificationDestination/);
  assert.match(shell, /fullScreenCover\(item: \$routedConversation\)/);
  assert.match(shell, /sheet\(item: \$routedProfile\)/);
  assert.match(service, /struct VelvetNotificationRoute: Codable/);
  assert.match(service, /pending-route\.v2/);
  assert.match(appState, /NotificationService\.handleDeepLink/);
});

test('iPhone widget exposes only aggregate counters through a team-scoped app group', async () => {
  const [snapshot, widget, appInfo, widgetInfo, appEntitlements, widgetEntitlements, debugConfig, releaseConfig] = await Promise.all([
    read('ios/Velvet/Core/System/NotificationSnapshotStore.swift'),
    read('ios/VelvetWidget/VelvetNotificationWidget.swift'),
    read('ios/Velvet/Resources/Info.plist'),
    read('ios/VelvetWidget/Info.plist'),
    read('ios/Velvet/Resources/Velvet.entitlements'),
    read('ios/VelvetWidget/VelvetWidget.entitlements'),
    read('ios/Config/Debug.xcconfig'),
    read('ios/Config/Release.xcconfig')
  ]);

  assert.match(snapshot, /VelvetAppGroup/);
  assert.match(snapshot, /messages: Int/);
  assert.match(snapshot, /visits: Int/);
  assert.match(snapshot, /likes: Int/);
  assert.match(snapshot, /WidgetCenter\.shared\.reloadTimelines/);
  assert.match(widget, /VelvetAppGroup/);
  assert.match(widget, /velvet:\/\/notifications/);
  assert.match(widget, /Affiche uniquement les compteurs non lus/);
  assert.doesNotMatch(widget, /displayName|notification\.body|messageBody|previewUrl/);
  assert.match(appInfo, /<key>VelvetAppGroup<\/key>/);
  assert.match(widgetInfo, /<key>VelvetAppGroup<\/key>/);
  assert.match(appEntitlements, /\$\(VELVET_APP_GROUP\)/);
  assert.match(widgetEntitlements, /\$\(VELVET_APP_GROUP\)/);
  assert.match(debugConfig, /VELVET_APP_GROUP = group\.com\.velvetapplication\.\$\(DEVELOPMENT_TEAM\)\.app/);
  assert.match(releaseConfig, /VELVET_APP_GROUP = group\.com\.velvetapplication\.app/);
  assert.doesNotMatch(appEntitlements, /aps-environment/);
  assert.doesNotMatch(debugConfig, /APS_ENVIRONMENT/);
  assert.doesNotMatch(releaseConfig, /APS_ENVIRONMENT/);
});

test('Apple Watch app and complication receive counter-only snapshots through a team-scoped group', async () => {
  const [bridge, watchApp, watchWidget, watchInfo, watchWidgetInfo, watchEntitlements, watchWidgetEntitlements, debugConfig, project, workflow] = await Promise.all([
    read('ios/Velvet/Core/System/NotificationSnapshotStore.swift'),
    read('ios/VelvetWatch/VelvetWatchApp.swift'),
    read('ios/VelvetWatchWidget/VelvetWatchWidget.swift'),
    read('ios/VelvetWatch/Info.plist'),
    read('ios/VelvetWatchWidget/Info.plist'),
    read('ios/VelvetWatch/VelvetWatch.entitlements'),
    read('ios/VelvetWatchWidget/VelvetWatchWidget.entitlements'),
    read('ios/Config/Debug.xcconfig'),
    read('ios/Velvet.xcodeproj/project.pbxproj'),
    read('.github/workflows/ios-build.yml')
  ]);

  assert.match(bridge, /WatchConnectivity/);
  assert.match(bridge, /updateApplicationContext/);
  assert.match(watchApp, /didReceiveApplicationContext/);
  assert.match(watchApp, /VelvetWatchAppGroup/);
  assert.match(watchWidget, /VelvetWatchAppGroup/);
  assert.match(watchInfo, /<key>VelvetWatchAppGroup<\/key>/);
  assert.match(watchWidgetInfo, /<key>VelvetWatchAppGroup<\/key>/);
  assert.match(watchEntitlements, /\$\(VELVET_WATCH_APP_GROUP\)/);
  assert.match(watchWidgetEntitlements, /\$\(VELVET_WATCH_APP_GROUP\)/);
  assert.match(debugConfig, /VELVET_WATCH_APP_GROUP = group\.com\.velvetapplication\.\$\(DEVELOPMENT_TEAM\)\.watch/);
  assert.match(watchWidget, /accessoryCircular/);
  assert.match(watchWidget, /accessoryRectangular/);
  assert.doesNotMatch(watchApp, /displayName|notification\.body|previewUrl/);
  assert.match(project, /VelvetWidget\.appex/);
  assert.match(project, /VelvetWatch\.app/);
  assert.match(project, /VelvetWatchWidget\.appex/);
  assert.match(workflow, /generic\/platform=watchOS Simulator/);
});
