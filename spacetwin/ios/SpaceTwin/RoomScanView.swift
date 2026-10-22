import ARKit
import RoomPlan
import SwiftUI
import UIKit

/// Apple RoomPlan scan of one room (LiDAR iPhones and iPads). The user walks
/// the room pointing the phone at the walls; RoomPlan measures walls, doors and
/// windows. When they tap Done the result is uploaded as rooms.
struct RoomScanView: View {
    let api: APIClient
    let spaceID: String
    @ObservedObject var shared: SharedSession
    var onFinished: (Space) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var roomName = "Room"
    @State private var stage: Stage = .naming
    @State private var stopRequested = false

    enum Stage: Equatable {
        case naming, scanning, uploading
        case failed(String)
    }

    var body: some View {
        switch stage {
        case .naming:
            Form {
                Section("Room name") { TextField("Room", text: $roomName) }
                Section {
                    Label("Turn on the lights. Walk slowly around the room, pointing the phone at each wall, door and window.", systemImage: "lightbulb")
                    Label("Stay in this app afterwards and capture your 360° spots: they’ll line up with this scan automatically.", systemImage: "scope")
                }
                Button("Start scanning") { stage = .scanning }
            }
            .navigationTitle("Scan a room")
        case .scanning:
            RoomCaptureRepresentable(session: shared, stopRequested: $stopRequested) { result in
                switch result {
                case .success(let room): upload(room)
                case .failure(let error): stage = .failed(error.localizedDescription)
                }
            }
            .ignoresSafeArea()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { stopRequested = true } }
            }
            .navigationBarBackButtonHidden(true)
        case .uploading:
            ProgressView("Uploading room…")
        case .failed(let message):
            VStack(spacing: 16) {
                Text("Scan failed").font(.headline)
                Text(message).multilineTextAlignment(.center)
                Button("Try again") { stage = .naming }
            }
            .padding()
        }
    }

    private func upload(_ room: CapturedRoom) {
        stage = .uploading
        shared.setFloor(from: room)
        Task {
            do {
                let space = try await api.uploadRoomPlan(spaceID: spaceID, room: room, name: roomName)
                onFinished(space)
                dismiss()
            } catch {
                stage = .failed(error.localizedDescription)
            }
        }
    }
}

/// Hosts RoomCaptureView on the shared ARSession (iOS 17), so the session keeps
/// running for spot capture after the scan.
private struct RoomCaptureRepresentable: UIViewControllerRepresentable {
    let session: SharedSession
    @Binding var stopRequested: Bool
    let onResult: (Result<CapturedRoom, Error>) -> Void

    func makeUIViewController(context: Context) -> RoomCaptureController {
        RoomCaptureController(session: session, onResult: onResult)
    }

    func updateUIViewController(_ controller: RoomCaptureController, context: Context) {
        if stopRequested { controller.stop() }
    }
}

/// RoomCaptureViewDelegate requires NSCoding, which a view controller already provides.
final class RoomCaptureController: UIViewController, RoomCaptureViewDelegate {
    private let shared: SharedSession
    private let onResult: (Result<CapturedRoom, Error>) -> Void
    private var captureView: RoomCaptureView!
    private var stopped = false

    init(session: SharedSession, onResult: @escaping (Result<CapturedRoom, Error>) -> Void) {
        self.shared = session
        self.onResult = onResult
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("not used from storyboards")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        captureView = RoomCaptureView(frame: view.bounds, arSession: shared.session)
        captureView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        captureView.delegate = self
        view.addSubview(captureView)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        shared.roomScanStarted()
        captureView.captureSession.run(configuration: RoomCaptureSession.Configuration())
    }

    func stop() {
        guard !stopped else { return }
        stopped = true
        // keep ARKit running: spot capture continues in the same coordinate system
        captureView.captureSession.stop(pauseARSession: false)
    }

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        if let error {
            onResult(.failure(error))
        } else {
            onResult(.success(processedResult))
        }
    }
}
