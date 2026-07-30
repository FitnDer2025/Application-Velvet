import SwiftUI

enum VelvetColor {
    static let velvetBlack = Color(hex: 0x0D0D0D)
    static let anthracite = Color(hex: 0x1B1B1D)
    static let velourGray = Color(hex: 0x2D2D30)
    static let ivory = Color(hex: 0xF4F4F2)
    static let velvetBurgundy = Color(hex: 0x641B36)
    static let champagneGold = Color(hex: 0xC6A96A)
    static let warmBeige = Color(hex: 0xE8DDD3)
    static let softBlush = Color(hex: 0xE4CAD3)
    static let textSecondary = Color(hex: 0xB8B5B0)
    static let borderSubtle = Color(hex: 0x3A3637)
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
    static let small: CGFloat = 8
    static let medium: CGFloat = 14
    static let large: CGFloat = 22
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
        .system(size: size, weight: weight, design: .rounded)
    }

    static func caption(size: CGFloat = 12, weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .rounded)
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
