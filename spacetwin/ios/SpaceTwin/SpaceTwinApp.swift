import SwiftUI

@main
struct SpaceTwinApp: App {
    @StateObject private var settings = AppSettings()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(settings)
        }
    }
}

/// Where the SpaceTwin server lives, remembered between launches.
final class AppSettings: ObservableObject {
    @Published var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") }
    }

    init() {
        serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? "http://192.168.1.10:3000"
    }

    var api: APIClient? {
        URL(string: serverURL.trimmingCharacters(in: .whitespaces)).map(APIClient.init(baseURL:))
    }
}
