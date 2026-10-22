import ARKit
import CoreImage
import ImageIO
import SceneKit
import SwiftUI

/// Matterport-style 360° capture at one spot: aim the ring at each dot and
/// hold still; it shoots automatically. Every photo carries its exact ARKit
/// pose, so the server can stitch it and place the spot on the plan by itself.
struct SpotCaptureView: View {
    let api: APIClient
    let spaceID: String
    let defaultName: String
    @ObservedObject var shared: SharedSession
    var onFinished: (Space) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var capture = SpotCaptureController()
    @State private var name = ""
    @State private var started = false

    var body: some View {
        Group {
            if !started {
                Form {
                    Section("Spot name") { TextField(defaultName, text: $name) }
                    Section("For seamless 360s") {
                        Label("Keep the lens in one place: use a tripod, or hold the phone at chest height and step around it.", systemImage: "camera.metering.center.weighted")
                        Label("Turn on every light; don’t aim at bright lamps.", systemImage: "lightbulb")
                        Label("Put spots 1.5–3 m apart, closer in hallways and doorways.", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                    }
                    Button("Start capture") {
                        shared.ensureTracking()
                        capture.start(session: shared)
                        started = true
                    }
                }
                .navigationTitle("Capture a spot")
            } else {
                live
            }
        }
        .onDisappear { capture.stop() }
    }

    private var live: some View {
        GeometryReader { geo in
            ZStack {
                ARCameraView(session: shared.session).ignoresSafeArea()
                Canvas { ctx, _ in
                    for dot in capture.dots {
                        let r: CGFloat = dot.done ? 6 : (dot.active ? 16 : 10)
                        let rect = CGRect(x: dot.point.x - r, y: dot.point.y - r, width: r * 2, height: r * 2)
                        let color: Color = dot.done ? .green : .white.opacity(dot.active ? 0.95 : 0.35)
                        ctx.fill(Path(ellipseIn: rect), with: .color(color))
                    }
                    let c = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                    let ring = Path(ellipseIn: CGRect(x: c.x - 26, y: c.y - 26, width: 52, height: 52))
                    ctx.stroke(ring, with: .color(capture.onTarget ? .green : .white), lineWidth: 3)
                    if capture.onTarget {
                        var arc = Path()
                        arc.addArc(center: c, radius: 26, startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * capture.hold), clockwise: false)
                        ctx.stroke(arc, with: .color(.green), lineWidth: 6)
                    }
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
                VStack {
                    HStack {
                        Button("Cancel") { dismiss() }.buttonStyle(.bordered).tint(.white)
                        Spacer()
                        Text("\(capture.doneCount) / \(capture.total)").font(.headline.monospacedDigit()).foregroundStyle(.white)
                        Spacer()
                        Button("Finish") { finish() }.buttonStyle(.bordered).tint(.white).disabled(capture.doneCount < 12)
                    }
                    .padding()
                    Spacer()
                    Text(capture.status)
                        .font(.headline)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                        .padding(.bottom, 30)
                }
            }
            .onAppear { capture.viewport = geo.size }
            .onChange(of: geo.size) { _, size in capture.viewport = size }
            .onChange(of: capture.complete) { _, done in if done { finish() } }
        }
        .navigationBarBackButtonHidden(true)
    }

    private func finish() {
        guard !capture.uploading else { return }
        capture.uploading = true
        capture.status = "Uploading and stitching…"
        capture.stop()
        let photos = capture.photos
        let spotName = name.trimmingCharacters(in: .whitespaces).isEmpty ? defaultName : name
        Task {
            do {
                let space = try await api.uploadCapture(spaceID: spaceID, name: spotName, photos: photos, floorY: shared.floorY)
                onFinished(space)
                dismiss()
            } catch {
                capture.status = "Upload failed: \(error.localizedDescription)"
                capture.uploading = false
            }
        }
    }
}

/// Drives the capture: reads ARKit frames ~30 times a second, decides when the
/// phone is steady on a target, and grabs posed photos.
@MainActor
final class SpotCaptureController: ObservableObject {
    struct Dot { let point: CGPoint; let done: Bool; let active: Bool }

    @Published var dots: [Dot] = []
    @Published var status = "Hold the phone upright and aim at the first dot"
    @Published var onTarget = false
    @Published var hold: Double = 0
    @Published var doneCount = 0
    @Published var complete = false
    var uploading = false
    var viewport: CGSize = .zero
    private(set) var photos: [PosedPhoto] = []
    var total: Int { targets.count }

    private let aimTolerance: Float = 3.5 * .pi / 180
    private let steadyTime: TimeInterval = 0.35
    private let steadyMax: Float = 0.7 * .pi / 180
    private var targets: [CaptureTarget] = []
    private var history: [(t: TimeInterval, f: SIMD3<Float>)] = []
    private var timer: Timer?
    private var busy = false
    private weak var shared: SharedSession?
    private let ciContext = CIContext()

    func start(session: SharedSession) {
        shared = session
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard let shared, let frame = shared.session.currentFrame, !uploading else { return }
        let camera = frame.camera
        guard case .normal = camera.trackingState else {
            status = "Move the phone slowly so it can find its bearings"
            return
        }
        let pose = camera.transform
        let fwd = pose.forward
        if targets.isEmpty { targets = CaptureTarget.sphere(startingYaw: yawOf(fwd)) }
        shared.updateFloorFromPlanes(cameraY: pose.position.y)

        let now = frame.timestamp
        history.append((now, fwd))
        history.removeAll { now - $0.t > steadyTime }
        let steady = (history.last.map { last in
            (history.first.map { last.t - $0.t } ?? 0) > steadyTime * 0.8 && history.allSatisfy { angleBetween($0.f, last.f) < steadyMax }
        }) ?? false

        let remaining = targets.filter { !$0.done }
        guard let first = remaining.first else {
            complete = true
            return
        }
        let active = remaining.first { angleBetween($0.direction, fwd) < aimTolerance } ?? first
        let off = angleBetween(active.direction, fwd)
        onTarget = off < aimTolerance
        hold = onTarget ? min(1, (history.last!.t - history.first!.t) / steadyTime) * (steady ? 1 : 0.4) : 0

        // Draw each dot where its direction appears on screen (1 m out from the lens).
        let eye = pose.position
        dots = targets.compactMap { t in
            guard simd_dot(t.direction, fwd) > 0.2 else { return nil }
            let p = camera.projectPoint(eye + t.direction, orientation: .portrait, viewportSize: viewport)
            return Dot(point: p, done: t.done, active: t.id == active.id)
        }

        if onTarget {
            status = steady ? "Hold still…" : "Steady…"
        } else if abs(active.pitch) > 80 * .pi / 180 {
            status = active.pitch > 0 ? "Point the phone straight up" : "Point the phone straight down"
        } else {
            var dyaw = active.yaw - yawOf(fwd)
            while dyaw > .pi { dyaw -= 2 * .pi }
            while dyaw < -.pi { dyaw += 2 * .pi }
            let dpitch = active.pitch - asin(max(-1, min(1, fwd.y)))
            if abs(dpitch) > 10 * .pi / 180 && abs(dyaw) < 25 * .pi / 180 {
                status = dpitch > 0 ? "Tilt up" : "Tilt down"
            } else {
                status = dyaw < 0 ? "Turn right" : "Turn left"
            }
        }

        if onTarget && steady && !busy {
            shoot(frame: frame, targetID: active.id)
        }
    }

    private func shoot(frame: ARFrame, targetID: Int) {
        busy = true
        let transform = frame.camera.transform
        let intrinsics = frame.camera.intrinsics // for capturedImage's full resolution
        // The image stays in the camera sensor's orientation; the transform and
        // intrinsics describe exactly that image, so no rotation is needed.
        let image = CIImage(cvPixelBuffer: frame.capturedImage)
        let context = ciContext
        Task.detached(priority: .userInitiated) {
            let jpeg = context.jpegRepresentation(
                of: image,
                colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                options: [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): 0.9]
            )
            await MainActor.run {
                if let jpeg {
                    self.photos.append(PosedPhoto(jpeg: jpeg, transform: transform, intrinsics: intrinsics))
                    if let i = self.targets.firstIndex(where: { $0.id == targetID }) { self.targets[i].done = true }
                    self.doneCount = self.photos.count
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
                self.busy = false
            }
        }
    }
}

/// Live camera feed from the shared ARKit session.
private struct ARCameraView: UIViewRepresentable {
    let session: ARSession

    func makeUIView(context: Context) -> ARSCNView {
        let view = ARSCNView(frame: .zero)
        view.session = session
        view.automaticallyUpdatesLighting = false
        return view
    }

    func updateUIView(_ view: ARSCNView, context: Context) {}
}
