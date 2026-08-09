import SwiftUI
import UIKit

struct VelvetBackground: View {
    var body: some View {
        ZStack {
            VelvetColor.velvetBlack
                .ignoresSafeArea()

            RadialGradient(
                colors: [
                    VelvetColor.velvetBurgundy.opacity(0.18),
                    VelvetColor.velvetBlack.opacity(0)
                ],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 480
            )
            .ignoresSafeArea()
            .accessibilityHidden(true)

            RadialGradient(
                colors: [
                    VelvetColor.champagneGold.opacity(0.06),
                    VelvetColor.velvetBlack.opacity(0)
                ],
                center: .bottomLeading,
                startRadius: 20,
                endRadius: 360
            )
            .ignoresSafeArea()
            .accessibilityHidden(true)
        }
    }
}

struct VelvetMark: View {
    let size: CGFloat

    var body: some View {
        Image("VelvetMark")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                    .stroke(.white.opacity(0.10), lineWidth: 1)
            }
            .shadow(color: VelvetColor.velvetBurgundy.opacity(0.38), radius: 22, y: 10)
            .accessibilityHidden(true)
    }
}

struct VelvetCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(VelvetSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                LinearGradient(
                    colors: [
                        VelvetColor.ivory.opacity(0.055),
                        VelvetColor.ivory.opacity(0.012)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
            .background(VelvetColor.anthracite.opacity(0.82))
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                    .stroke(.white.opacity(0.09), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.28), radius: 28, y: 16)
    }
}

struct VelvetPrimaryButton: View {
    let title: String
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    init(
        _ title: String,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: VelvetSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                }
                Text(isLoading ? "Patiente un instant…" : title)
                    .font(VelvetTypography.body(size: 16, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 52)
            .foregroundStyle(.white)
            .background {
                LinearGradient(
                    colors: [
                        Color(hex: 0xA6204B),
                        VelvetColor.velvetBurgundy
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
            .shadow(
                color: VelvetColor.velvetBurgundy.opacity(isDisabled ? 0 : 0.38),
                radius: 18,
                y: 8
            )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .opacity(isDisabled ? 0.48 : 1)
        .accessibilityAddTraits(.isButton)
    }
}

struct VelvetField: View {
    let title: String
    let prompt: String
    @Binding var text: String
    var contentType: UITextContentType?
    var keyboardType: UIKeyboardType = .default
    var isSecure = false

    var body: some View {
        VStack(alignment: .leading, spacing: VelvetSpacing.xs) {
            Text(title)
                .font(VelvetTypography.caption(size: 13))
                .foregroundStyle(VelvetColor.textSecondary)

            Group {
                if isSecure {
                    SecureField(prompt, text: $text)
                } else {
                    TextField(prompt, text: $text)
                }
            }
            .textContentType(contentType)
            .keyboardType(keyboardType)
            .textInputAutocapitalization(keyboardType == .emailAddress ? .never : .sentences)
            .autocorrectionDisabled(keyboardType == .emailAddress)
            .font(VelvetTypography.body())
            .foregroundStyle(VelvetColor.ivory)
            .padding(.horizontal, VelvetSpacing.md)
            .frame(minHeight: 50)
            .background(.white.opacity(0.045))
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                    .stroke(.white.opacity(0.11), lineWidth: 1)
            }
        }
    }
}

struct VelvetSectionHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String?

    init(_ eyebrow: String, title: String, subtitle: String? = nil) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: VelvetSpacing.xs) {
            Text(eyebrow.uppercased())
                .font(VelvetTypography.caption(size: 11, weight: .semibold))
                .tracking(2.2)
                .foregroundStyle(VelvetColor.softBlush)

            Text(title)
                .font(VelvetTypography.title())
                .foregroundStyle(VelvetColor.ivory)

            if let subtitle {
                Text(subtitle)
                    .font(VelvetTypography.body(size: 15))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

struct VelvetTopBar: View {
    let unreadCount: Int
    let notifications: () -> Void
    let menu: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            VelvetMark(size: 30)
            Text("ZWIT")
                .font(VelvetTypography.brand(size: 17))
                .tracking(3.4)
                .foregroundStyle(VelvetColor.ivory)

            Spacer()

            Button(action: notifications) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "bell")
                        .font(.system(size: 16, weight: .medium))
                    if unreadCount > 0 {
                        Circle()
                            .fill(VelvetColor.burgundyLight)
                            .frame(width: 7, height: 7)
                            .overlay(Circle().stroke(VelvetColor.velvetBlack, lineWidth: 1))
                    }
                }
                .frame(width: 38, height: 38)
            }
            .accessibilityLabel("Notifications")

            Button(action: menu) {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 17, weight: .medium))
                    .frame(width: 38, height: 38)
            }
            .accessibilityLabel("Menu Zwit")
        }
        .foregroundStyle(VelvetColor.ivory)
        .padding(.horizontal, 18)
        .frame(height: 58)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.72))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(VelvetColor.borderSubtle)
                .frame(height: 1)
        }
    }
}

struct VelvetPageHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String?

    init(_ eyebrow: String, title: String, subtitle: String? = nil) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(eyebrow.uppercased())
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .tracking(2)
                .foregroundStyle(VelvetColor.champagneGold)

            Text(title)
                .font(VelvetTypography.title(size: 38))
                .tracking(-1.2)
                .foregroundStyle(VelvetColor.ivory)

            if let subtitle {
                Text(subtitle)
                    .font(VelvetTypography.body(size: 13))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct VelvetSearchField: View {
    let prompt: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(VelvetColor.champagneGold)
            TextField(prompt, text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(VelvetColor.ivory)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(VelvetColor.textSecondary)
                }
            }
        }
        .font(VelvetTypography.body(size: 15))
        .padding(.horizontal, 16)
        .frame(height: 50)
        .background(VelvetColor.ivory.opacity(0.045))
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}

struct VelvetEmptyState: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(VelvetColor.champagneGold.opacity(0.08))
                Circle()
                    .stroke(VelvetColor.champagneGold.opacity(0.42), lineWidth: 1)
                Image(systemName: symbol)
                    .font(.system(size: 24, weight: .light))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .frame(width: 64, height: 64)

            Text(title)
                .font(VelvetTypography.title(size: 23))
                .foregroundStyle(VelvetColor.ivory)
                .multilineTextAlignment(.center)

            Text(message)
                .font(VelvetTypography.body(size: 13))
                .foregroundStyle(VelvetColor.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .frame(maxWidth: 290)
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 290)
        .padding(24)
        .background {
            RadialGradient(
                colors: [
                    VelvetColor.velvetBurgundy.opacity(0.22),
                    VelvetColor.anthracite.opacity(0.58)
                ],
                center: .top,
                startRadius: 10,
                endRadius: 290
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(
                    VelvetColor.champagneGold.opacity(0.25),
                    style: StrokeStyle(lineWidth: 1, dash: [5, 7])
                )
        }
    }
}

struct VelvetMetricCard: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(value)")
                .font(VelvetTypography.title(size: 44))
                .tracking(-1.5)
                .foregroundStyle(VelvetColor.ivory)
            Text(label)
                .font(VelvetTypography.body(size: 12, weight: .medium))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(2)
        }
        .padding(20)
        .frame(width: 154, height: 150, alignment: .leading)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay(alignment: .leading) {
            LinearGradient(
                colors: [.clear, VelvetColor.champagneGold, .clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: 2)
        }
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}

struct VelvetChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(VelvetTypography.caption(size: 12, weight: .semibold))
                .foregroundStyle(selected ? VelvetColor.velvetBlack : VelvetColor.textSecondary)
                .padding(.horizontal, 15)
                .frame(height: 36)
                .background(selected ? VelvetColor.champagneGold : VelvetColor.ivory.opacity(0.045))
                .clipShape(Capsule())
                .overlay {
                    Capsule()
                        .stroke(
                            selected ? VelvetColor.champagneGold : VelvetColor.borderSubtle,
                            lineWidth: 1
                        )
                }
        }
        .buttonStyle(.plain)
    }
}
