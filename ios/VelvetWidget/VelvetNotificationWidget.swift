import SwiftUI
import WidgetKit

private struct WidgetNotificationSnapshot: Codable, Equatable {
    let total: Int
    let messages: Int
    let visits: Int
    let likes: Int
    let events: Int
    let security: Int
    let other: Int
    let updatedAt: Date

    static let empty = WidgetNotificationSnapshot(
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

private enum WidgetSnapshotStore {
    static var appGroup: String {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "VelvetAppGroup") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !configured.isEmpty, !configured.contains("$(") else {
            return "group.com.velvetapplication.app"
        }
        return configured
    }

    static let storageKey = "velvet.notification.snapshot.v1"

    static func read() -> WidgetNotificationSnapshot {
        guard
            let data = UserDefaults(suiteName: appGroup)?.data(forKey: storageKey),
            let snapshot = try? JSONDecoder().decode(WidgetNotificationSnapshot.self, from: data)
        else {
            return .empty
        }
        return snapshot
    }
}

private struct VelvetWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetNotificationSnapshot
}

private struct VelvetWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> VelvetWidgetEntry {
        VelvetWidgetEntry(
            date: .now,
            snapshot: WidgetNotificationSnapshot(
                total: 8,
                messages: 3,
                visits: 2,
                likes: 2,
                events: 1,
                security: 0,
                other: 0,
                updatedAt: .now
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (VelvetWidgetEntry) -> Void) {
        completion(VelvetWidgetEntry(date: .now, snapshot: WidgetSnapshotStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<VelvetWidgetEntry>) -> Void) {
        let entry = VelvetWidgetEntry(date: .now, snapshot: WidgetSnapshotStore.read())
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

@main
struct VelvetWidgetBundle: WidgetBundle {
    var body: some Widget {
        VelvetNotificationWidget()
    }
}

private struct VelvetNotificationWidget: Widget {
    let kind = "VelvetNotificationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: VelvetWidgetProvider()) { entry in
            VelvetNotificationWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    ZStack {
                        Image(ZwitWidgetBrand.logoAsset)
                            .resizable()
                            .scaledToFill()
                            .blur(radius: 22)
                            .brightness(-0.48)
                            .opacity(0.42)
                        LinearGradient(
                            colors: [Color.black.opacity(0.66), Color(red: 0.22, green: 0.08, blue: 0.13).opacity(0.70)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                }
                .widgetURL(URL(string: "velvet://notifications"))
        }
        .configurationDisplayName(ZwitWidgetBrand.activityDisplayName)
        .description("Affiche uniquement les compteurs non lus, sans contenu privé.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
        .contentMarginsDisabled()
    }
}

private struct VelvetNotificationWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: VelvetWidgetEntry

    private let gold = Color(red: 0.84, green: 0.70, blue: 0.43)

    var body: some View {
        switch family {
        case .systemMedium:
            medium
        case .accessoryCircular:
            accessoryCircular
        case .accessoryRectangular:
            accessoryRectangular
        case .accessoryInline:
            Text("\(ZwitWidgetBrand.displayName) · \(entry.snapshot.total) activité\(entry.snapshot.total > 1 ? "s" : "")")
        default:
            small
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VelvetWidgetMark()
                Spacer()
                Image(systemName: "bell.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(gold)
            }

            Spacer()

            Text("\(entry.snapshot.total)")
                .font(.system(size: 48, weight: .light, design: .rounded))
                .foregroundStyle(.white)
                .contentTransition(.numericText())

            Text(entry.snapshot.total == 1 ? "activité non lue" : "activités non lues")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white.opacity(0.68))

            HStack(spacing: 9) {
                miniCounter("message.fill", entry.snapshot.messages)
                miniCounter("eye.fill", entry.snapshot.visits)
                miniCounter("heart.fill", entry.snapshot.likes)
            }
        }
        .padding(16)
    }

    private var medium: some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                VelvetWidgetMark()
                Spacer()
                Text("\(entry.snapshot.total)")
                    .font(.system(size: 52, weight: .light, design: .rounded))
                    .foregroundStyle(.white)
                Text("À retrouver dans \(ZwitWidgetBrand.displayName)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.64))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 8) {
                detailRow("message.fill", "Messages", entry.snapshot.messages)
                detailRow("eye.fill", "Visites", entry.snapshot.visits)
                detailRow("heart.fill", "Likes", entry.snapshot.likes)
                detailRow("calendar", "Sorties", entry.snapshot.events)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(18)
    }

    private var accessoryCircular: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image(ZwitWidgetBrand.logoAsset)
                .resizable()
                .scaledToFit()
                .padding(3)
        }
        .widgetLabel { Text(ZwitWidgetBrand.displayName) }
    }

    private var accessoryRectangular: some View {
        HStack(spacing: 9) {
            Image(ZwitWidgetBrand.logoAsset)
                .resizable()
                .scaledToFit()
                .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(entry.snapshot.total) non lu\(entry.snapshot.total > 1 ? "s" : "")")
                    .font(.system(size: 14, weight: .semibold))
                Text("✉︎ \(entry.snapshot.messages)  ◉ \(entry.snapshot.visits)  ♥ \(entry.snapshot.likes)")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
            }
        }
    }

    private func miniCounter(_ icon: String, _ value: Int) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
            Text("\(value)")
        }
        .font(.system(size: 10, weight: .bold, design: .rounded))
        .foregroundStyle(gold)
    }

    private func detailRow(_ icon: String, _ title: String, _ value: Int) -> some View {
        HStack(spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(gold)
                .frame(width: 20)
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.78))
            Spacer()
            Text("\(value)")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10)
        .frame(height: 31)
        .background(.white.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct VelvetWidgetMark: View {
    var body: some View {
        Image(ZwitWidgetBrand.logoAsset)
            .resizable()
            .scaledToFit()
            .frame(width: 64, height: 38, alignment: .leading)
            .accessibilityLabel(ZwitWidgetBrand.displayName)
    }
}
