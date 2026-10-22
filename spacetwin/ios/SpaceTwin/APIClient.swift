import Foundation
import RoomPlan
import simd

struct SpaceSummary: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let stats: Stats

    struct Stats: Decodable, Hashable {
        let scanCount: Int
        let roomCount: Int
        let totalArea: Double
    }
}

struct Space: Decodable {
    let id: String
    let name: String
    let scans: [Scan]
    let rooms: [Room]

    struct Scan: Decodable, Identifiable {
        let id: String
        let name: String
    }

    struct Room: Decodable, Identifiable {
        let id: String
        let name: String
    }
}

/// One photo for server-side stitching: the JPEG plus the ARKit pose it was taken with.
struct PosedPhoto {
    let jpeg: Data
    /// Camera → world, column-major (ARCamera.transform).
    let transform: simd_float4x4
    /// Pinhole intrinsics for this JPEG's resolution (ARCamera.intrinsics).
    let intrinsics: simd_float3x3
}

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Talks to the SpaceTwin server (see server/app.js for the endpoints).
struct APIClient {
    let baseURL: URL

    func listSpaces() async throws -> [SpaceSummary] {
        try await send(request("GET", "api/spaces"))
    }

    func getSpace(id: String) async throws -> Space {
        try await send(request("GET", "api/spaces/\(id)"))
    }

    func createSpace(name: String) async throws -> Space {
        var req = request("POST", "api/spaces")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["name": name])
        return try await send(req)
    }

    /// Rooms measured by RoomPlan. CapturedRoom is Codable; the server converts it.
    func uploadRoomPlan(spaceID: String, room: CapturedRoom, name: String) async throws -> Space {
        var req = request("POST", "api/spaces/\(spaceID)/roomplan")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let roomJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(room))
        req.httpBody = try JSONSerialization.data(withJSONObject: ["capturedRoom": roomJSON, "name": name])
        return try await send(req)
    }

    /// Photos of one spot; the server stitches them and places the scan at the camera position.
    func uploadCapture(spaceID: String, name: String, photos: [PosedPhoto], floorY: Float?) async throws -> Space {
        var form = MultipartForm()
        var frames: [[String: Any]] = []
        for (i, photo) in photos.enumerated() {
            form.addFile(name: "frames", filename: "frame-\(i).jpg", mimeType: "image/jpeg", data: photo.jpeg)
            frames.append(["transform": photo.transform.flatColumns, "intrinsics": photo.intrinsics.flatColumns])
        }
        var meta: [String: Any] = ["name": name, "frames": frames]
        if let floorY { meta["floorY"] = floorY }
        form.addField(name: "meta", value: String(data: try JSONSerialization.data(withJSONObject: meta), encoding: .utf8)!)

        var req = request("POST", "api/spaces/\(spaceID)/captures")
        req.setValue("multipart/form-data; boundary=\(form.boundary)", forHTTPHeaderField: "Content-Type")
        req.httpBody = form.finish()
        req.timeoutInterval = 180 // the server stitches before it answers
        return try await send(req)
    }

    /// Link to the space in the web editor.
    func editorURL(spaceID: String) -> URL {
        var c = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        c.fragment = "/space/\(spaceID)"
        return c.url!
    }

    // MARK: - plumbing

    private func request(_ method: String, _ path: String) -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.timeoutInterval = 30
        return req
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError(message: "No response from server") }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError(message: message ?? "Server error \(http.statusCode)")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

struct MultipartForm {
    let boundary = "spacetwin-\(UUID().uuidString)"
    private var body = Data()

    mutating func addField(name: String, value: String) {
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n")
    }

    mutating func addFile(name: String, filename: String, mimeType: String, data: Data) {
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        body.append("\r\n")
    }

    func finish() -> Data {
        var out = body
        out.append("--\(boundary)--\r\n")
        return out
    }
}

private extension Data {
    mutating func append(_ string: String) {
        append(string.data(using: .utf8)!)
    }
}

extension simd_float4x4 {
    /// 16 numbers, column by column (what the server expects).
    var flatColumns: [Float] {
        [columns.0, columns.1, columns.2, columns.3].flatMap { [$0.x, $0.y, $0.z, $0.w] }
    }
}

extension simd_float3x3 {
    var flatColumns: [Float] {
        [columns.0, columns.1, columns.2].flatMap { [$0.x, $0.y, $0.z] }
    }
}
