import SwiftUI
import WidgetKit

private struct WatchWidgetSnapshot: Codable {
    let total: Int
    let messages: Int
    let visits: Int
    let likes: Int
    let events: Int
    let security: Int
    let other: Int
    let updatedAt: Date

    static let empty = WatchWidgetSnapshot(
        total: 0,
        messages: 0,
        visits: 0,
        likes: 0,
        events: 0,
        security: 0,
        other: 0,
        updatedAt: .now
    )
}

private enum WatchWidgetStore {
    static var appGroup: String {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "VelvetWatchAppGroup") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !configured.isEmpty, !configured.contains("$(") else {
            return "group.com.velvetapplication.watch"
        }
        return configured
    }

    static let storageKey = "velvet.watch.notification.snapshot.v1"

    static func read() -> WatchWidgetSnapshot {
        guard
            let data = UserDefaults(suiteName: appGroup)?.data(forKey: storageKey),
            let value = try? JSONDecoder().decode(WatchWidgetSnapshot.self, from: data)
        else {
            return .empty
        }
        return value
    }
}

private struct WatchWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WatchWidgetSnapshot
}

private struct WatchWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchWidgetEntry {
        WatchWidgetEntry(
            date: .now,
            snapshot: WatchWidgetSnapshot(
                total: 7,
                messages: 3,
                visits: 2,
                likes: 2,
                events: 0,
                security: 0,
                other: 0,
                updatedAt: .now
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchWidgetEntry) -> Void) {
        completion(WatchWidgetEntry(date: .now, snapshot: WatchWidgetStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchWidgetEntry>) -> Void) {
        let entry = WatchWidgetEntry(date: .now, snapshot: WatchWidgetStore.read())
        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

@main
struct VelvetWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        VelvetWatchWidget()
    }
}

private struct VelvetWatchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VelvetWatchNotificationWidget", provider: WatchWidgetProvider()) { entry in
            VelvetWatchWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Color.clear
                }
        }
        .configurationDisplayName("Velvet")
        .description("Compte les activités non lues sans afficher de contenu privé.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

private struct VelvetWatchWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WatchWidgetEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text("V")
                        .font(.system(size: 10, weight: .bold, design: .serif))
                    Text("\(entry.snapshot.total)")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                }
            }
            .widgetLabel {
                Text("Activité Velvet")
            }

        case .accessoryRectangular:
            HStack(spacing: 7) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("VELVET")
                        .font(.system(size: 10, weight: .bold))
                    Text("\(entry.snapshot.total) non lu\(entry.snapshot.total > 1 ? "s" : "")")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Label("\(entry.snapshot.messages)", systemImage: "message.fill")
                    HStack(spacing: 5) {
                        Label("\(entry.snapshot.visits)", systemImage: "eye.fill")
                        Label("\(entry.snapshot.likes)", systemImage: "heart.fill")
                    }
                }
                .font(.system(size: 9, weight: .semibold, design: .rounded))
            }

        default:
            Text("Velvet \(entry.snapshot.total) · ✉︎\(entry.snapshot.messages) ◉\(entry.snapshot.visits) ♥\(entry.snapshot.likes)")
        }
    }
}
