import Foundation

enum RealtimeMessageDate {
    static func date(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        if let date = ISO8601DateFormatter().date(from: value) {
            return date
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX"
        return formatter.date(from: value) ?? .distantPast
    }
}
