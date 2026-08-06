from pathlib import Path

root = Path('.')

# iOS — launch experience.
root_view = root / 'ios/Velvet/App/RootView.swift'
text = root_view.read_text()
text = text.replace('Le propriétaire de la photo a été prévenu par Velvet.', 'Le propriétaire de la photo a été prévenu par Zwit.')
text = text.replace('Text("V")\n            .font(VelvetTypography.brand(size: 24))', 'Text("Z")\n            .font(VelvetTypography.brand(size: 24))')
launch = '''private struct LaunchView: View {
    @Environment(\\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        VStack(spacing: VelvetSpacing.lg) {
            VelvetMark(size: 92)
                .scaleEffect(appeared ? 1 : 0.9)
                .opacity(appeared ? 1 : 0)

            VStack(spacing: VelvetSpacing.xs) {
                Text("ZWIT")
                    .font(VelvetTypography.brand(size: 27))
                    .tracking(8)
                    .foregroundStyle(VelvetColor.champagneGold)

                Text("Là où les plus belles rencontres commencent.")
                    .font(VelvetTypography.body(size: 14))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.6)) {
                appeared = true
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Velvet. Là où les plus belles rencontres commencent.")
    }
}
'''
new_launch = '''private struct LaunchView: View {
    @Environment(\\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false
    @State private var orbit = false

    private let whispers = [
        "Chut", "Shh", "Ssst", "Silencio", "Silenzio", "Leise",
        "Tyst", "Cicho", "Тише", "静かに", "쉿", "هدوء"
    ]

    var body: some View {
        ZStack {
            ForEach(Array(whispers.enumerated()), id: \\.offset) { index, whisper in
                Text(whisper)
                    .font(VelvetTypography.caption(size: index.isMultiple(of: 3) ? 12 : 10, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(index.isMultiple(of: 4) ? VelvetColor.champagneGold.opacity(0.72) : VelvetColor.ivory.opacity(0.34))
                    .offset(x: 142)
                    .rotationEffect(.degrees(Double(index) * (360 / Double(whispers.count))))
                    .rotationEffect(.degrees(orbit ? 360 : 0))
            }

            Circle()
                .stroke(VelvetColor.champagneGold.opacity(0.16), lineWidth: 0.7)
                .frame(width: 250, height: 250)
                .scaleEffect(appeared ? 1 : 0.72)

            VStack(spacing: VelvetSpacing.md) {
                VelvetMark(size: 104)
                    .scaleEffect(appeared ? 1 : 0.82)
                    .opacity(appeared ? 1 : 0)

                Text("ZWIT")
                    .font(VelvetTypography.brand(size: 29))
                    .tracking(9)
                    .foregroundStyle(VelvetColor.champagneGold)

                Text("Un secret se partage. Jamais il ne s’impose.")
                    .font(VelvetTypography.body(size: 13))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .opacity(appeared ? 1 : 0)
        }
        .frame(width: 330, height: 330)
        .onAppear {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.72)) {
                appeared = true
            }
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 14).repeatForever(autoreverses: false)) {
                orbit = true
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Zwit. Chut. Une expérience discrète et confidentielle.")
    }
}
'''
if launch not in text:
    raise SystemExit('LaunchView source not found')
root_view.write_text(text.replace(launch, new_launch))

# iOS — dates and swipe in conversations.
msg_path = root / 'ios/Velvet/Features/Messaging/RealtimeAppleMessagingViews.swift'
text = msg_path.read_text()
old = '''            ForEach(messages) { message in
                messageBubble(for: message)
                    .id(message.id)
            }'''
new = '''            ForEach(Array(messages.enumerated()), id: \\.element.id) { index, message in
                if index == 0 || !Calendar.current.isDate(
                    RealtimeMessageDate.date(messages[index - 1].createdAt),
                    inSameDayAs: RealtimeMessageDate.date(message.createdAt)
                ) {
                    RealtimeMessageDaySeparator(date: RealtimeMessageDate.date(message.createdAt))
                }
                messageBubble(for: message)
                    .id(message.id)
            }'''
if old not in text:
    raise SystemExit('message ForEach not found')
text = text.replace(old, new, 1)
marker = 'private struct RealtimeAttachmentDraftChip: View {'
day_view = '''private struct RealtimeMessageDaySeparator: View {
    let date: Date

    private var label: String {
        if Calendar.current.isDateInToday(date) { return "Aujourd’hui" }
        if Calendar.current.isDateInYesterday(date) { return "Hier" }
        return date.formatted(.dateTime.weekday(.wide).day().month(.wide).year())
    }

    var body: some View {
        HStack(spacing: 10) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
            Text(label.capitalized)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
        }
        .padding(.vertical, 8)
        .accessibilityLabel("Messages du \\(label)")
    }
}

'''
if marker not in text:
    raise SystemExit('attachment marker not found')
text = text.replace(marker, day_view + marker, 1)
state_marker = '''    let currentUserID: UUID?
    let openImage: (URL) -> Void
'''
state_new = '''    let currentUserID: UUID?
    let openImage: (URL) -> Void
    @State private var dragOffset: CGFloat = 0
'''
if state_marker not in text:
    raise SystemExit('bubble state marker not found')
text = text.replace(state_marker, state_new, 1)
old_body = '''    var body: some View {
        HStack(alignment: .bottom, spacing: 7) {
            if isMine { Spacer(minLength: 48) }
            messageColumn
            if !isMine { Spacer(minLength: 48) }
        }
        .frame(maxWidth: .infinity)
    }
'''
new_body = '''    var body: some View {
        ZStack(alignment: isMine ? .trailing : .leading) {
            Text(messageDateLabel)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.82))
                .padding(.horizontal, 8)
                .opacity(abs(dragOffset) > 14 ? 1 : 0)

            HStack(alignment: .bottom, spacing: 7) {
                if isMine { Spacer(minLength: 48) }
                messageColumn
                if !isMine { Spacer(minLength: 48) }
            }
            .offset(x: dragOffset)
            .gesture(
                DragGesture(minimumDistance: 12)
                    .onChanged { value in
                        let allowed = isMine ? min(0, value.translation.width) : max(0, value.translation.width)
                        dragOffset = max(-118, min(118, allowed))
                    }
                    .onEnded { _ in
                        withAnimation(.spring(response: 0.30, dampingFraction: 0.82)) {
                            dragOffset = 0
                        }
                    }
            )
        }
        .frame(maxWidth: .infinity)
        .accessibilityHint("Glissez le message sur le côté pour afficher sa date complète.")
    }

    private var messageDateLabel: String {
        RealtimeMessageDate.date(message.createdAt).formatted(
            .dateTime.day().month(.abbreviated).year().hour().minute()
        )
    }
'''
if old_body not in text:
    raise SystemExit('bubble body not found')
msg_path.write_text(text.replace(old_body, new_body, 1))

# iOS — album request and direct grant from a profile.
profile_path = root / 'ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift'
text = profile_path.read_text()
text = text.replace('Label("Partager un album privé", systemImage: "lock.open")', 'Label("Ouvrir mes albums privés", systemImage: "lock.open")', 1)
share_block = '''            .buttonStyle(.plain)

            Button {
                showsSafety = true
            } label: {'''
request_block = '''            .buttonStyle(.plain)

            Button {
                Task { await requestAlbumAccess() }
            } label: {
                Label("Demander l’ouverture d’un album", systemImage: "lock.badge.clock")
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(VelvetColor.ivory.opacity(0.055))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(VelvetColor.borderSubtle, lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .disabled(isWorking)

            Button {
                showsSafety = true
            } label: {'''
if share_block not in text:
    raise SystemExit('profile share insertion not found')
text = text.replace(share_block, request_block, 1)
start_marker = '''    @MainActor
    private func startConversation() async {'''
request_method = '''    @MainActor
    private func requestAlbumAccess() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let id = try await store.service.startConversation(profileID: profile.id)
            _ = try await store.service.sendMessage(
                "🔐 Votre profil nous plaît. Accepteriez-vous de nous ouvrir l’un de vos albums privés ?",
                conversationID: id
            )
            activeConversation = .direct(
                id: id,
                title: profile.displayName,
                profileID: profile.id,
                photoURL: primaryMedia?.previewUrl
            )
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

'''
if start_marker not in text:
    raise SystemExit('start conversation marker missing')
profile_path.write_text(text.replace(start_marker, request_method + start_marker, 1))

for disposable in ['scripts/apply-zwit-ios.py', '.github/workflows/apply-zwit-ios.yml']:
    p = root / disposable
    if p.exists():
        p.unlink()
