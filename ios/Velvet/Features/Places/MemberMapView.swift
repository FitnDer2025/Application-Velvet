import MapKit
import SwiftUI

struct MemberMapView: View {
    @EnvironmentObject private var store: VelvetStore
    @StateObject private var location = LocationService()
    @State private var mapData: MemberMapResponse?
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 46.603354, longitude: 1.888334),
            span: MKCoordinateSpan(latitudeDelta: 10, longitudeDelta: 10)
        )
    )
    @State private var selectedLayers: Set<MapLayer> = Set(MapLayer.allCases)
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isSavingLocation = false

    private enum MapLayer: String, CaseIterable {
        case members
        case venues
        case events

        var title: String {
            switch self {
            case .members: "Membres"
            case .venues: "Lieux"
            case .events: "Sorties"
            }
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetPageHeader(
                        "Zones publiques et adresses d’établissements",
                        title: "Maps",
                        subtitle: "Les membres sont placés au centre approximatif de leur zone. Aucune position exacte n’est exposée."
                    )

                    layerPicker

                    if let mapData {
                        map(mapData)
                            .frame(height: 450)
                            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                                    .stroke(VelvetColor.borderSubtle, lineWidth: 1)
                            }
                            .shadow(color: .black.opacity(0.3), radius: 30, y: 16)

                        locationCard(mapData)
                    } else if isLoading {
                        VStack(spacing: 14) {
                            ProgressView()
                                .tint(VelvetColor.champagneGold)
                            Text("Chargement des zones publiques…")
                                .font(VelvetTypography.body(size: 13))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: 340)
                    } else {
                        VelvetEmptyState(
                            symbol: "map",
                            title: "Carte indisponible",
                            message: errorMessage ?? "Zwit ne peut pas charger Maps pour le moment."
                        )
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 28)
            }
            .refreshable { await loadMap() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await loadMap() }
        .onChange(of: location.lastLocation?.coordinate.latitude) { _, latitude in
            guard
                let latitude,
                let longitude = location.lastLocation?.coordinate.longitude
            else { return }
            Task { await saveLocation(latitude: latitude, longitude: longitude) }
        }
    }

    private var layerPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 9) {
                ForEach(MapLayer.allCases, id: \.rawValue) { layer in
                    VelvetChip(
                        title: layer.title,
                        selected: selectedLayers.contains(layer)
                    ) {
                        if selectedLayers.contains(layer) {
                            selectedLayers.remove(layer)
                        } else {
                            selectedLayers.insert(layer)
                        }
                    }
                }
            }
        }
    }

    private func map(_ data: MemberMapResponse) -> some View {
        Map(position: $position) {
            if selectedLayers.contains(.members) {
                ForEach(data.members) { marker in
                    Annotation(marker.name, coordinate: marker.coordinate) {
                        MapSymbol(icon: marker.profileType == "couple" ? "person.2.fill" : "person.fill")
                    }
                }
            }
            if selectedLayers.contains(.venues) {
                ForEach(data.venues) { marker in
                    Annotation(marker.name, coordinate: marker.coordinate) {
                        MapSymbol(icon: "building.2.fill", color: VelvetColor.champagneGold)
                    }
                }
            }
            if selectedLayers.contains(.events) {
                ForEach(data.events) { marker in
                    Annotation(marker.title, coordinate: marker.coordinate) {
                        MapSymbol(icon: "sparkles", color: VelvetColor.burgundyLight)
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic, emphasis: .muted))
    }

    private func locationCard(_ data: MemberMapResponse) -> some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: "location.circle")
                        .font(.system(size: 21))
                        .foregroundStyle(VelvetColor.champagneGold)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(
                            data.center.source == "private_approximate_location"
                                ? "Zone de proximité active"
                                : "Active ta zone de proximité"
                        )
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        Text("La position est arrondie avant d’être enregistrée.")
                            .font(VelvetTypography.body(size: 11))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                }

                if data.center.source != "private_approximate_location" {
                    Button {
                        location.requestOneShotLocation()
                    } label: {
                        HStack {
                            if isSavingLocation {
                                ProgressView().tint(VelvetColor.velvetBlack)
                            }
                            Text("Activer ma zone")
                                .font(VelvetTypography.caption(size: 12, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(VelvetColor.velvetBlack)
                        .background(VelvetColor.champagneGold)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isSavingLocation)
                }
            }
        }
    }

    @MainActor
    private func loadMap() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let data = try await store.service.memberMap()
            mapData = data
            errorMessage = nil
            position = .region(
                MKCoordinateRegion(
                    center: CLLocationCoordinate2D(
                        latitude: data.center.latitude,
                        longitude: data.center.longitude
                    ),
                    span: span(for: data.center.zoom ?? 6)
                )
            )
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func saveLocation(latitude: Double, longitude: Double) async {
        guard !isSavingLocation else { return }
        isSavingLocation = true
        defer { isSavingLocation = false }
        do {
            _ = try await store.service.saveLocation(latitude: latitude, longitude: longitude)
            await loadMap()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    private func span(for zoom: Double) -> MKCoordinateSpan {
        let delta = 360 / pow(2, max(1, zoom - 1))
        return MKCoordinateSpan(latitudeDelta: delta, longitudeDelta: delta)
    }
}

private struct MapSymbol: View {
    let icon: String
    var color: Color = VelvetColor.velvetBurgundy

    var body: some View {
        Image(systemName: icon)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(VelvetColor.ivory)
            .frame(width: 34, height: 34)
            .background(color)
            .clipShape(Circle())
            .overlay(Circle().stroke(VelvetColor.ivory.opacity(0.72), lineWidth: 2))
            .shadow(color: .black.opacity(0.35), radius: 7, y: 4)
    }
}

private extension MemberMapMarker {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

private extension VenueMapMarker {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

private extension EventMapMarker {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
