import SwiftUI
import UIKit

struct VelvetBackground: View {
    var body: some View {
        ZStack {
            VelvetColor.velvetBlack
                .ignoresSafeArea()

            RadialGradient(
                colors: [
                    VelvetColor.velvetBurgundy.opacity(0.20),
                    VelvetColor.velvetBlack.opacity(0)
                ],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 420
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
            .background(.ultraThinMaterial.opacity(0.82))
            .background(VelvetColor.anthracite.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                    .stroke(.white.opacity(0.09), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.40), radius: 24, y: 8)
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
