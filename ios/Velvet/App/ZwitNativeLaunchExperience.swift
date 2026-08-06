import SwiftUI

struct ZwitNativeLaunchExperience: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let onFinished: () -> Void

    @State private var currentWordIndex: Int?
    @State private var wordOpacity = 0.0
    @State private var fogOpacity = 0.0
    @State private var fogScale = 0.72
    @State private var logoOpacity = 0.0
    @State private var logoBlur: CGFloat = 24
    @State private var logoScale: CGFloat = 0.90

    private let words = ["Chut", "Silencio", "Silenzio", "嘘"]

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                Image("ZwitOfficialLogo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                    .blur(radius: 48)
                    .scaleEffect(1.22)
                    .brightness(-0.48)
                    .saturation(0.78)
                    .opacity(logoOpacity * 0.44)

                RadialGradient(
                    colors: [
                        VelvetColor.champagneGold.opacity(0.08),
                        VelvetColor.velvetBurgundy.opacity(0.16),
                        Color.black.opacity(0.96)
                    ],
                    center: .center,
                    startRadius: 8,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.80
                )
                .ignoresSafeArea()

                if let currentWordIndex {
                    Text(words[currentWordIndex])
                        .font(VelvetTypography.brand(size: currentWordIndex == 3 ? 84 : 72))
                        .tracking(2.4)
                        .foregroundStyle(VelvetColor.ivory)
                        .shadow(color: VelvetColor.champagneGold.opacity(0.30), radius: 30)
                        .opacity(wordOpacity)
                        .blur(radius: wordOpacity < 0.20 ? 14 : 0)
                        .scaleEffect(0.94 + wordOpacity * 0.06)
                        .accessibilityHidden(true)
                }

                ZStack {
                    fog(size: proxy.size.width * 0.96)
                        .offset(x: -proxy.size.width * 0.30, y: -proxy.size.height * 0.18)
                    fog(size: proxy.size.width * 0.90)
                        .offset(x: proxy.size.width * 0.31, y: -proxy.size.height * 0.10)
                    fog(size: proxy.size.width * 1.02)
                        .offset(x: -proxy.size.width * 0.18, y: proxy.size.height * 0.29)
                    fog(size: proxy.size.width * 0.92)
                        .offset(x: proxy.size.width * 0.27, y: proxy.size.height * 0.31)
                }
                .opacity(fogOpacity)
                .scaleEffect(fogScale)
                .allowsHitTesting(false)

                Image("ZwitOfficialLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: min(proxy.size.width * 0.92, 720))
                    .padding(.horizontal, 18)
                    .opacity(logoOpacity)
                    .blur(radius: logoBlur)
                    .scaleEffect(logoScale)
                    .shadow(color: .black.opacity(0.82), radius: 50, y: 22)
                    .accessibilityHidden(true)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .ignoresSafeArea()
        }
        .task { await runSequence() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Zwit. Chut. Une expérience discrète et confidentielle.")
    }

    private func fog(size: CGFloat) -> some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        VelvetColor.ivory.opacity(0.54),
                        VelvetColor.champagneGold.opacity(0.18),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: size * 0.5
                )
            )
            .frame(width: size, height: size)
            .blur(radius: 44)
    }

    @MainActor
    private func runSequence() async {
        if reduceMotion {
            currentWordIndex = 0
            wordOpacity = 1
            try? await Task.sleep(for: .milliseconds(850))
            withAnimation(.easeInOut(duration: 0.65)) {
                wordOpacity = 0
                fogOpacity = 0.76
                fogScale = 1.10
            }
            try? await Task.sleep(for: .milliseconds(600))
            revealLogo()
            try? await Task.sleep(for: .milliseconds(11_500))
            onFinished()
            return
        }

        for index in words.indices {
            currentWordIndex = index
            withAnimation(.easeInOut(duration: 0.78)) {
                wordOpacity = 1
            }
            try? await Task.sleep(for: .milliseconds(1_250))
            withAnimation(.easeInOut(duration: 0.82)) {
                wordOpacity = 0
            }
            try? await Task.sleep(for: .milliseconds(620))
        }

        currentWordIndex = nil
        withAnimation(.easeInOut(duration: 1.35)) {
            fogOpacity = 0.84
            fogScale = 1.18
        }
        try? await Task.sleep(for: .milliseconds(1_050))

        revealLogo()
        try? await Task.sleep(for: .milliseconds(4_300))
        onFinished()
    }

    @MainActor
    private func revealLogo() {
        withAnimation(.easeInOut(duration: 1.55)) {
            logoOpacity = 1
            logoBlur = 0
            logoScale = 1
            fogOpacity = 0.46
            fogScale = 1.30
        }
    }
}
