import SwiftUI

@MainActor
struct PrivateSpacesV15Overlay: View {
    @State private var presented = false

    var body: some View {
        VStack {
            HStack {
                Button {
                    presented = true
                } label: {
                    Label("Cercles", systemImage: "person.3.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.velvetGold)
                        .padding(.horizontal, 12)
                        .frame(height: 35)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay { Capsule().stroke(Color.velvetGold.opacity(0.18), lineWidth: 0.7) }
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.top, 7)
            Spacer()
        }
        .sheet(isPresented: $presented) {
            PrivateSpacesV15Sheet()
        }
    }
}

@MainActor
private struct PrivateSpacesV15Sheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var spaces: [PrivateSpaceV15] = []
    @State private var eventChats: [EventChatCandidateV15] = []
    @State private var loading = false
    @State private var error: String?
    @State private var createPresented = false
    @State private var selectedSpace: PrivateSpaceV15?

    private let session = SessionService()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    invitationsSection
                    eventChatsSection
                    spacesSection
                    privacyNote
                }
                .padding(18)
            }
            .background(Color.velvetBlack.ignoresSafeArea())
            .refreshable { await load() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fermer") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        createPresented = true
                    } label: {
                        Label("Créer", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $createPresented) {
                CreateCircleV15Sheet {
                    createPresented = false
                    await load()
                }
            }
            .sheet(item: $selectedSpace) { space in
                PrivateSpaceV15DetailView(space: space)
            }
            .task { await load() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("ESPACES PRIVÉS")
                .font(.system(size: 9, weight: .black))
                .tracking(1.3)
                .foregroundStyle(Color.velvetGold)
            Text("Cercles & chats")
                .font(.system(size: 31, weight: .medium, design: .serif))
                .foregroundStyle(.primary)
            Text("Des espaces choisis : petits cercles privés et chats liés aux soirées auxquelles vous participez réellement.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var invitationsSection: some View {
        let invitations = spaces.filter(\.isInvitation)
        if !invitations.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("Invitations", symbol: "envelope.open.fill")
                ForEach(invitations) { space in
                    HStack(spacing: 10) {
                        spaceIdentity(space)
                        Spacer()
                        Button("Accepter") { Task { await accept(space) } }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.velvetBurgundy)
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .padding(13)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }
        }
    }

    @ViewBuilder
    private var eventChatsSection: some View {
        if !eventChats.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("Chats de soirée", symbol: "sparkles")
                ForEach(eventChats) { event in
                    Button {
                        Task { await openEventChat(event) }
                    } label: {
                        HStack(spacing: 11) {
                            Image(systemName: "calendar.badge.clock")
                                .foregroundStyle(Color.velvetGold)
                                .frame(width: 38, height: 38)
                                .background(Color.velvetGold.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(event.title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.primary)
                                Text("Chat ouvert · réservé aux participants confirmés")
                                    .font(.system(size: 9))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.secondary)
                        }
                        .padding(13)
                        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var spacesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Mes cercles", symbol: "person.3.fill")
            let active = spaces.filter { !$0.isInvitation }
            if loading && active.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 28)
            } else if active.isEmpty {
                ContentUnavailableView(
                    "Aucun cercle pour le moment",
                    systemImage: "person.3",
                    description: Text(error ?? "Créez un cercle privé ou rejoignez le chat d’une prochaine soirée.")
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                ForEach(active) { space in
                    Button { selectedSpace = space } label: {
                        HStack(spacing: 11) {
                            Image(systemName: space.isEventChat ? "sparkles" : "person.3.fill")
                                .foregroundStyle(Color.velvetGold)
                                .frame(width: 40, height: 40)
                                .background(Color.velvetGold.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
                            spaceIdentity(space)
                            Spacer()
                            if space.unreadCount > 0 {
                                Text(space.unreadCount > 99 ? "99+" : String(space.unreadCount))
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 7)
                                    .frame(minHeight: 22)
                                    .background(Color.velvetBurgundy, in: Capsule())
                            }
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.secondary)
                        }
                        .padding(13)
                        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var privacyNote: some View {
        Label(
            "Les identifiants de compte ne sont jamais affichés. Un chat de soirée est revérifié à chaque lecture et chaque envoi.",
            systemImage: "lock.shield.fill"
        )
        .font(.system(size: 9))
        .foregroundStyle(.secondary)
        .padding(.top, 4)
    }

    private func sectionTitle(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Color.velvetGold)
    }

    private func spaceIdentity(_ space: PrivateSpaceV15) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(space.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            Text("\(space.memberCount) membre\(space.memberCount > 1 ? "s" : "") · \(space.isEventChat ? "soirée" : "cercle privé")")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
    }

    private func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let envelope = try await session.privateSpacesV15()
            spaces = envelope.spaces
            eventChats = envelope.eventChatCandidates ?? []
            error = nil
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }

    private func accept(_ space: PrivateSpaceV15) async {
        do {
            try await session.acceptSpaceInviteV15(spaceID: space.spaceId)
            await load()
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }

    private func openEventChat(_ event: EventChatCandidateV15) async {
        do {
            guard let id = try await session.eventChatV15(eventID: event.eventId) else { return }
            await load()
            selectedSpace = spaces.first(where: { $0.spaceId == id }) ?? PrivateSpaceV15(
                spaceId: id,
                kind: "event",
                title: event.title,
                description: nil,
                eventId: event.eventId,
                role: "member",
                status: "active",
                memberCount: 0,
                unreadCount: 0,
                lastMessageAt: nil,
                closesAt: nil
            )
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }
}

@MainActor
private struct CreateCircleV15Sheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var saving = false
    @State private var error: String?

    let completed: () async -> Void
    private let session = SessionService()

    var body: some View {
        NavigationStack {
            Form {
                Section("Cercle privé") {
                    TextField("Nom du cercle", text: $title)
                        .textInputAutocapitalization(.sentences)
                    TextField("Description facultative", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }
            }
            .navigationTitle("Nouveau cercle")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") { Task { await create() } }
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving)
                }
            }
        }
    }

    private func create() async {
        saving = true
        defer { saving = false }
        do {
            _ = try await session.createCircleV15(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description
            )
            await completed()
            dismiss()
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }
}

@MainActor
private struct PrivateSpaceV15DetailView: View {
    @Environment(\.dismiss) private var dismiss
    let space: PrivateSpaceV15

    @State private var messages: [PrivateSpaceMessageV15] = []
    @State private var members: [PrivateSpaceMemberV15] = []
    @State private var draft = ""
    @State private var loading = false
    @State private var sending = false
    @State private var error: String?
    @State private var showMembers = false

    private let session = SessionService()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(messages) { message in
                                messageBubble(message)
                                    .id(message.id)
                            }
                            if messages.isEmpty && !loading {
                                ContentUnavailableView(
                                    "Le cercle est prêt",
                                    systemImage: space.isEventChat ? "sparkles" : "bubble.left.and.bubble.right",
                                    description: Text("L’échange commence ici, dans cet espace privé.")
                                )
                                .padding(.top, 50)
                            }
                        }
                        .padding(14)
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let id = messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
                    }
                }
                composer
            }
            .background(Color.velvetBlack.ignoresSafeArea())
            .navigationTitle(space.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Fermer") { dismiss() } }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showMembers = true } label: { Image(systemName: "person.2") }
                    Menu {
                        Button("Quitter l’espace", role: .destructive) { Task { await leave() } }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showMembers) { membersSheet }
            .task { await poll() }
            .overlay(alignment: .top) {
                if let error {
                    Text(error)
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 12)
                        .frame(minHeight: 32)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.top, 8)
                }
            }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 13)
                .frame(minHeight: 40)
                .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 19, style: .continuous))
            Button { Task { await send() } } label: {
                Group {
                    if sending { ProgressView().tint(.white) }
                    else { Image(systemName: "arrow.up").font(.system(size: 15, weight: .bold)) }
                }
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(canSend ? Color.velvetBurgundy : Color.gray.opacity(0.3), in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSend || sending)
        }
        .padding(10)
        .background(.ultraThinMaterial)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func messageBubble(_ message: PrivateSpaceMessageV15) -> some View {
        HStack {
            if message.mine { Spacer(minLength: 50) }
            VStack(alignment: message.mine ? .trailing : .leading, spacing: 4) {
                if !message.mine {
                    Text(message.senderDisplayName ?? "Membre Zwit")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Color.velvetGold)
                }
                Text(message.body)
                    .font(.system(size: 14))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(
                        message.mine ? Color.velvetBurgundy.opacity(0.88) : Color.white.opacity(0.055),
                        in: RoundedRectangle(cornerRadius: 17, style: .continuous)
                    )
                    .contextMenu {
                        if !message.mine {
                            Button("Signaler", systemImage: "exclamationmark.bubble", role: .destructive) {
                                Task { await report(message) }
                            }
                        }
                    }
            }
            if !message.mine { Spacer(minLength: 50) }
        }
        .frame(maxWidth: .infinity)
    }

    private var membersSheet: some View {
        NavigationStack {
            List(members) { member in
                HStack {
                    Image(systemName: member.mine ? "person.crop.circle.fill.badge.checkmark" : "person.crop.circle")
                        .foregroundStyle(Color.velvetGold)
                    VStack(alignment: .leading) {
                        Text(member.mine ? "Vous" : (member.displayName ?? "Membre Zwit"))
                        Text(member.role)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Participants")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { showMembers = false } } }
        }
        .presentationDetents([.medium, .large])
    }

    private func load() async {
        do {
            let detail = try await session.privateSpaceV15(spaceID: space.spaceId)
            messages = detail.messages
            members = detail.members
            error = nil
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }

    private func poll() async {
        loading = true
        await load()
        loading = false
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(2.5))
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    private func send() async {
        let value = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        draft = ""
        sending = true
        defer { sending = false }
        do {
            _ = try await session.sendSpaceMessageV15(spaceID: space.spaceId, message: value)
            await load()
        } catch {
            draft = value
            self.error = ErrorMessage.text(for: error)
        }
    }

    private func report(_ message: PrivateSpaceMessageV15) async {
        do {
            try await session.reportSpaceMessageV15(
                spaceID: space.spaceId,
                messageID: message.messageId,
                reason: "Signalement depuis l’application iOS"
            )
            error = "Signalement transmis à l’équipe Zwit."
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }

    private func leave() async {
        do {
            try await session.leaveSpaceV15(spaceID: space.spaceId)
            dismiss()
        } catch {
            self.error = ErrorMessage.text(for: error)
        }
    }
}
