import SwiftUI

struct ConversationsView: View {
    @EnvironmentObject private var store: VelvetStore

    var body: some View {
        ZStack {
            VelvetBackground()
            if store.directory?.locked == true {
                LockedDirectoryView()
            } else if store.directory?.conversations.isEmpty != false {
                ContentUnavailableView(
                    "Aucune conversation",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("Écris depuis un profil ou rejoins un Salon Velvet lié à un événement.")
                )
                .foregroundStyle(VelvetColor.textSecondary)
            } else {
                List(store.directory?.conversations ?? []) { conversation in
                    NavigationLink {
                        ConversationView(
                            conversationID: conversation.id,
                            title: conversation.title
                        )
                    } label: {
                        HStack(spacing: VelvetSpacing.md) {
                            Image(systemName: conversation.kind == "event" ? "person.3.fill" : "bubble.left.fill")
                                .foregroundStyle(VelvetColor.champagneGold)
                                .frame(width: 40, height: 40)
                                .background(VelvetColor.champagneGold.opacity(0.10))
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                Text(conversation.title)
                                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                                    .foregroundStyle(VelvetColor.ivory)
                                Text(conversation.kind == "event" ? "Salon Velvet" : "Échange privé")
                                    .font(VelvetTypography.caption())
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                        }
                    }
                    .listRowBackground(Color.white.opacity(0.035))
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Messages")
        .refreshable { await store.load() }
    }
}

struct ConversationView: View {
    @EnvironmentObject private var store: VelvetStore
    let conversationID: UUID
    let title: String

    @State private var draft = ""
    @State private var isSending = false

    var body: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: VelvetSpacing.sm) {
                            ForEach(store.messages[conversationID] ?? []) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding(VelvetSpacing.md)
                    }
                    .onChange(of: store.messages[conversationID]?.count) { _, _ in
                        if let id = store.messages[conversationID]?.last?.id {
                            withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                        }
                    }
                }

                HStack(alignment: .bottom, spacing: VelvetSpacing.sm) {
                    TextField("Un message respectueux…", text: $draft, axis: .vertical)
                        .lineLimit(1...5)
                        .padding(.horizontal, VelvetSpacing.md)
                        .padding(.vertical, 11)
                        .background(.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))

                    Button {
                        Task { await send() }
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 17, weight: .bold))
                            .frame(width: 44, height: 44)
                            .foregroundStyle(.white)
                            .background(VelvetColor.velvetBurgundy)
                            .clipShape(Circle())
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                }
                .padding(VelvetSpacing.md)
                .background(.ultraThinMaterial)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.refreshMessages(conversationID: conversationID) }
        .refreshable { await store.refreshMessages(conversationID: conversationID) }
    }

    @MainActor
    private func send() async {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        isSending = true
        if await store.send(message, conversationID: conversationID) {
            draft = ""
        }
        isSending = false
    }
}

private struct MessageBubble: View {
    let message: DirectoryMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let identity = message.senderIdentity {
                Text(identity)
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            if let body = message.body {
                Text(body)
                    .font(VelvetTypography.body(size: 15))
                    .foregroundStyle(VelvetColor.ivory)
            }
        }
        .padding(.horizontal, VelvetSpacing.md)
        .padding(.vertical, VelvetSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
    }
}
