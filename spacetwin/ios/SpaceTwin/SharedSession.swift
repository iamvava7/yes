import ARKit
import RoomPlan

/// One ARKit session for a whole visit. RoomPlan's room scan and the 360°
/// spot captures both run on it, so rooms and spots share one coordinate
/// system and the spots land in the right place on the plan without any
/// manual alignment. Restarting the app starts a new coordinate system, so
/// scan the rooms and capture the spots of a space in one visit.
@MainActor
final class SharedSession: ObservableObject {
    let session = ARSession()
    /// Height of the floor in ARKit world space (y = 0 is where the phone was when the session started).
    @Published private(set) var floorY: Float?
    private var running = false

    static var supportsRoomScan: Bool { RoomCaptureSession.isSupported }

    /// Make sure world tracking is running, without resetting the coordinate system.
    func ensureTracking() {
        guard !running else { return }
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal]
        session.run(config)
        running = true
    }

    /// RoomPlan is running on this session (it configures tracking itself).
    func roomScanStarted() {
        running = true
    }

    func setFloor(from room: CapturedRoom) {
        if let floor = room.floors.first {
            floorY = floor.transform.columns.3.y
        } else if let lowest = room.walls.map({ $0.transform.columns.3.y - $0.dimensions.y / 2 }).min() {
            floorY = lowest
        }
    }

    /// Without a room scan, use the floor plane ARKit found below the camera.
    func updateFloorFromPlanes(cameraY: Float) {
        guard floorY == nil, let frame = session.currentFrame else { return }
        let planes = frame.anchors.compactMap { $0 as? ARPlaneAnchor }.filter { $0.alignment == .horizontal }
        let floors = planes.filter { ARPlaneAnchor.isClassificationSupported ? $0.classification == .floor : true }
        let candidates = floors.map { $0.transform.columns.3.y }.filter { cameraY - $0 > 0.5 }
        if let y = candidates.min() { floorY = y }
    }
}
