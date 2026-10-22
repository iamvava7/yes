import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var spaces: [SpaceSummary] = []
    @State private var error: String?
    @State private var loading = false
    @State private var newName = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("http://192.168.1.10:3000", text: $settings.serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit { Task { await load() } }
                } header: {
                    Text("SpaceTwin server")
                } footer: {
                    Text("Run `npm start` on a computer on the same Wi-Fi and enter its address with port 3000.")
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }

                Section("Spaces") {
                    ForEach(spaces) { space in
                        NavigationLink(value: space) {
                            VStack(alignment: .leading) {
                                Text(space.name).font(.headline)
                                Text("\(space.stats.scanCount) spots · \(space.stats.roomCount) rooms · \(space.stats.totalArea, specifier: "%.1f") m²")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                    }
                    HStack {
                        TextField("New space name", text: $newName)
                        Button("Create") { Task { await create() } }
                            .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .navigationTitle("SpaceTwin")
            .navigationDestination(for: SpaceSummary.self) { summary in
                if let api = settings.api {
                    SpaceView(api: api, spaceID: summary.id, title: summary.name)
                }
            }
            .refreshable { await load() }
            .overlay { if loading && spaces.isEmpty { ProgressView() } }
            .task { await load() }
        }
    }

    private func load() async {
        guard let api = settings.api else {
            error = "That server address isn’t a valid URL."
            return
        }
        loading = true
        defer { loading = false }
        do {
            spaces = try await api.listSpaces()
            error = nil
        } catch {
            self.error = "Couldn’t reach the server: \(error.localizedDescription)"
        }
    }

    private func create() async {
        guard let api = settings.api else { return }
        do {
            _ = try await api.createSpace(name: newName.trimmingCharacters(in: .whitespaces))
            newName = ""
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// One space: scan rooms, capture spots, open the tour. Owns the ARKit session
/// for this visit so everything captured here shares one coordinate system.
struct SpaceView: View {
    let api: APIClient
    let spaceID: String
    let title: String

    @StateObject private var shared = SharedSession()
    @State private var space: Space?
    @State private var message: String?

    var body: some View {
        List {
            Section {
                NavigationLink {
                    RoomScanView(api: api, spaceID: spaceID, shared: shared) { updated in
                        space = updated
                        message = "Room saved."
                    }
                } label: {
                    Label("Scan a room", systemImage: "cube.transparent")
                }
                .disabled(!SharedSession.supportsRoomScan)

                NavigationLink {
                    SpotCaptureView(api: api, spaceID: spaceID, defaultName: "Spot \((space?.scans.count ?? 0) + 1)", shared: shared) { updated in
                        space = updated
                        message = "Spot saved and placed on the plan."
                    }
                } label: {
                    Label("Capture a 360° spot", systemImage: "camera.viewfinder")
                }
            } footer: {
                Text(SharedSession.supportsRoomScan
                     ? "Scan each room first, then capture spots without leaving this screen: they line up automatically."
                     : "This iPhone has no LiDAR, so room scanning isn’t available. Capture spots here, then trace rooms in the web editor.")
            }

            if let message {
                Section { Text(message).foregroundStyle(.green) }
            }

            if let space {
                Section("In this space") {
                    LabeledContent("Spots", value: "\(space.scans.count)")
                    LabeledContent("Rooms", value: "\(space.rooms.count)")
                }
            }

            Section {
                Link(destination: api.editorURL(spaceID: spaceID)) {
                    Label("Open tour and editor", systemImage: "safari")
                }
            }
        }
        .navigationTitle(title)
        .task { space = try? await api.getSpace(id: spaceID) }
    }
}
