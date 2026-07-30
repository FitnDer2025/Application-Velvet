import SwiftUI

enum VelvetColor {
    // Tokens partagés avec members-live.css.
    static let velvetBlack = Color(hex: 0x0B080A)
    static let anthracite = Color(hex: 0x151013)
    static let panelRaised = Color(hex: 0x1B1418)
    static let velourGray = Color(hex: 0x2A2025)
    static let ivory = Color(hex: 0xF6EEE6)
    static let velvetBurgundy = Color(hex: 0x7E2045)
    static let burgundyLight = Color(hex: 0xB54570)
    static let champagneGold = Color(hex: 0xD9B879)
    static let warmBeige = Color(hex: 0xE8DDD3)
    static let softBlush = Color(hex: 0xE4CAD3)
    static let textSecondary = Color(hex: 0xA99DA2)
    static let borderSubtle = Color.white.opacity(0.085)
    static let success = Color(hex: 0x54A86B)
    static let warning = Color(hex: 0xD6A75D)
    static let danger = Color(hex: 0xC64157)
}

enum VelvetSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

enum VelvetRadius {
    static let small: CGFloat = 12
    static let medium: CGFloat = 18
    static let large: CGFloat = 24
    static let editorial: CGFloat = 34
    static let pill: CGFloat = 999
}

enum VelvetMotion {
    static let fast = 0.14
    static let normal = 0.22
    static let slow = 0.36
}

enum VelvetTypography {
    static func brand(size: CGFloat) -> Font {
        .system(size: size, weight: .medium, design: .serif)
    }

    static func title(size: CGFloat = 32) -> Font {
        .system(size: size, weight: .medium, design: .serif)
    }

    static func body(size: CGFloat = 16, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    static func caption(size: CGFloat = 12, weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
