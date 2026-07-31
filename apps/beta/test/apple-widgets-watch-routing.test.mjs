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

test('iPhone widget exposes only aggregate counters through an app group', async () => {
  const [snapshot, widget, appEntitlements, widgetEntitlements] = await Promise.all([
    read('ios/Velvet/Core/System/NotificationSnapshotStore.swift'),
    read('ios/VelvetWidget/VelvetNotificationWidget.swift'),
    read('ios/Velvet/Resources/Velvet.entitlements'),
    read('ios/VelvetWidget/VelvetWidget.entitlements')
  ]);

  assert.match(snapshot, /group\.com\.velvetapplication\.app/);
  assert.match(snapshot, /messages: Int/);
  assert.match(snapshot, /visits: Int/);
  assert.match(snapshot, /likes: Int/);
  assert.match(snapshot, /WidgetCenter\.shared\.reloadTimelines/);
  assert.match(widget, /velvet:\/\/notifications/);
  assert.match(widget, /Affiche uniquement les compteurs non lus/);
  assert.doesNotMatch(widget, /displayName|notification\.body|messageBody|previewUrl/);
  assert.match(appEntitlements, /group\.com\.velvetapplication\.app/);
  assert.match(widgetEntitlements, /group\.com\.velvetapplication\.app/);
});

test('Apple Watch app and complication receive counter-only snapshots', async () => {
  const [bridge, watchApp, watchWidget, project, workflow] = await Promise.all([
    read('ios/Velvet/Core/System/NotificationSnapshotStore.swift'),
    read('ios/VelvetWatch/VelvetWatchApp.swift'),
    read('ios/VelvetWatchWidget/VelvetWatchWidget.swift'),
    read('ios/Velvet.xcodeproj/project.pbxproj'),
    read('.github/workflows/ios-build.yml')
  ]);

  assert.match(bridge, /WatchConnectivity/);
  assert.match(bridge, /updateApplicationContext/);
  assert.match(watchApp, /didReceiveApplicationContext/);
  assert.match(watchApp, /group\.com\.velvetapplication\.watch/);
  assert.match(watchWidget, /accessoryCircular/);
  assert.match(watchWidget, /accessoryRectangular/);
  assert.doesNotMatch(watchApp, /displayName|notification\.body|previewUrl/);
  assert.match(project, /VelvetWidget\.appex/);
  assert.match(project, /VelvetWatch\.app/);
  assert.match(project, /VelvetWatchWidget\.appex/);
  assert.match(workflow, /generic\/platform=watchOS Simulator/);
});
