import simd

/// The 30 directions to photograph for a full sphere with the phone held
/// upright (portrait, roughly 50° × 65° field of view), matching the web
/// capture (web/src/capture/geometry.js): a horizon ring of 12, rings of 8 at
/// ±48°, then straight up and straight down. Neighbouring shots overlap by
/// about a third, which blending needs.
///
/// Directions are in ARKit world space (y up). Yaw 0 looks along -z and
/// positive yaw turns left, so the rings run to the right.
struct CaptureTarget: Identifiable {
    let id: Int
    let yaw: Float
    let pitch: Float
    var done = false

    var direction: SIMD3<Float> { CaptureTarget.direction(yaw: yaw, pitch: pitch) }

    static func direction(yaw: Float, pitch: Float) -> SIMD3<Float> {
        SIMD3(-sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch))
    }

    /// Targets starting from the direction the user faces when capture begins.
    static func sphere(startingYaw yaw0: Float) -> [CaptureTarget] {
        var out: [CaptureTarget] = []
        func ring(pitchDeg: Float, count: Int, offsetDeg: Float) {
            for i in 0..<count {
                let yawDeg = -(Float(i) * 360 / Float(count) + offsetDeg)
                out.append(CaptureTarget(id: out.count, yaw: yaw0 + yawDeg * .pi / 180, pitch: pitchDeg * .pi / 180))
            }
        }
        ring(pitchDeg: 0, count: 12, offsetDeg: 0)
        ring(pitchDeg: 48, count: 8, offsetDeg: 22.5)
        ring(pitchDeg: -48, count: 8, offsetDeg: 22.5)
        out.append(CaptureTarget(id: out.count, yaw: yaw0, pitch: 89.9 * .pi / 180))
        out.append(CaptureTarget(id: out.count, yaw: yaw0, pitch: -89.9 * .pi / 180))
        return out
    }
}

extension simd_float4x4 {
    /// Where the camera looks: ARKit cameras look down their local -z.
    var forward: SIMD3<Float> { -simd_normalize(SIMD3(columns.2.x, columns.2.y, columns.2.z)) }
    var position: SIMD3<Float> { SIMD3(columns.3.x, columns.3.y, columns.3.z) }
}

func yawOf(_ d: SIMD3<Float>) -> Float { atan2(-d.x, -d.z) }

func angleBetween(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> Float {
    acos(max(-1, min(1, simd_dot(simd_normalize(a), simd_normalize(b)))))
}
