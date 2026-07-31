import SwiftUI

struct PremiumProfileSection<Content: View>: View {
    let eyebrow: String
    let title: String
    private let content: Content

    init(eyebrow: String, title: String, @ViewBuilder content: () -> Content) {
        self.eyebrow = eyebrow
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 7) {
                Text(eyebrow.uppercased())
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.7)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(title)
                    .font(VelvetTypography.title(size: 26))
                    .foregroundStyle(VelvetColor.ivory)
            }
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            LinearGradient(
                colors: [VelvetColor.ivory.opacity(0.05), VelvetColor.ivory.opacity(0.014)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .background(VelvetColor.anthracite.opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: VelvetRadius.large).stroke(VelvetColor.borderSubtle) }
    }
}

struct PremiumProfileText: View {
    let value: String?
    let fallback: String
    var quote = false

    var body: some View {
        Text(value?.isEmpty == false ? value! : fallback)
            .font(quote ? VelvetTypography.brand(size: 19) : VelvetTypography.body(size: 14))
            .foregroundStyle(quote ? VelvetColor.ivory : VelvetColor.textSecondary)
            .lineSpacing(5)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct PremiumProfileTags: View {
    let values: [String]
    let emptyText: String

    var body: some View {
        if values.isEmpty {
            Text(emptyText)
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
        } else {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 106), spacing: 8)],
                alignment: .leading,
                spacing: 8
            ) {
                ForEach(values, id: \.self) { value in
                    Text(value)
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .padding(.horizontal, 12)
                        .frame(minHeight: 34)
                        .frame(maxWidth: .infinity)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Capsule())
                        .overlay { Capsule().stroke(VelvetColor.champagneGold.opacity(0.20)) }
                }
            }
        }
    }
}

struct PremiumProfilePersonRow: View {
    let person: IndividualProfile

    var body: some View {
        HStack(spacing: 13) {
            Text(person.premiumInitials)
                .font(VelvetTypography.title(size: 18))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.velvetBurgundy.opacity(0.22))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(person.firstName ?? "Fiche personnelle")
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(person.biography ?? "Découvrir cette personne")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(13)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
    }
}

struct PremiumProfileFacts: View {
    let person: IndividualProfile

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 128), spacing: 9)],
            spacing: 9
        ) {
            ForEach(person.premiumFacts, id: \.0) { label, value in
                VStack(alignment: .leading, spacing: 4) {
                    Text(label.uppercased())
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(0.9)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text(value)
                        .font(VelvetTypography.body(size: 13, weight: .medium))
                        .foregroundStyle(VelvetColor.ivory)
                }
                .frame(maxWidth: .infinity, minHeight: 62, alignment: .leading)
                .padding(12)
                .background(VelvetColor.ivory.opacity(0.035))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }
}

struct PremiumProfileActionRow: View {
    let title: String
    let detail: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 42, height: 42)
                .background(color.opacity(0.08))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(detail)
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: VelvetRadius.large).stroke(VelvetColor.borderSubtle) }
    }
}

struct PremiumProfileSegment: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Text(title)
                    .font(VelvetTypography.body(size: 13, weight: selected ? .semibold : .medium))
                    .foregroundStyle(selected ? VelvetColor.ivory : VelvetColor.textSecondary)
                Capsule()
                    .fill(selected ? VelvetColor.champagneGold : Color.clear)
                    .frame(height: 2)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
        }
        .buttonStyle(.plain)
    }
}

struct PremiumStatusPill: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        Label(title, systemImage: icon)
            .font(VelvetTypography.caption(size: 9, weight: .semibold))
            .tracking(0.8)
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(color.opacity(0.09))
            .clipShape(Capsule())
            .overlay { Capsule().stroke(color.opacity(0.22)) }
    }
}

extension IndividualProfile {
    var premiumInitials: String {
        guard let first = firstName?.first else { return "V" }
        return String(first).uppercased()
    }

    var premiumFacts: [(String, String)] {
        let currentYear = Calendar.current.component(.year, from: Date())
        var values: [(String, String?)] = [
            ("Identité", genderIdentity),
            ("Âge", birthYear.map { "\(currentYear - $0) ans" }),
            ("Taille", heightCm.map { "\($0) cm" }),
            ("Morphologie", morphology ?? bodyType),
            ("Cheveux", hairColor),
            ("Yeux", eyeColor),
            ("Orientation", orientation),
            ("Rythme", frequency)
        ]
        if professionPrivate != true { values.append(("Profession", profession)) }
        return values.compactMap { label, value in
            guard let value, !value.isEmpty, value != "Information privée" else { return nil }
            return (label, value)
        }
    }
}
