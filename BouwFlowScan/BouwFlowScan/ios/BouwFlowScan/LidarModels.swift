import Foundation
import simd

struct Vector3Payload: Codable { let x: Double; let y: Double; let z: Double }

struct ControlPointPayload: Codable, Identifiable {
    let id: String
    let label: String
    let bim: Vector3Payload
    let scan: Vector3Payload
    var verified: Bool
}
struct ObservationPayload: Codable, Identifiable {
    let id: String
    let ifcGuid: String
    let label: String
    let category: String
    let workPackageId: String
    let plannedQuantity: Double
    let observedQuantity: Double
    let unit: String
    let measurementRule: String
    let surfaceCoveragePct: Double
    let visibilityPct: Double
    let confidencePct: Double
    let deviationMm: Double
    let photoEvidenceCount: Int
    let detected: Bool
}

struct ScanCreatePayload: Codable {
    let modelId: String
    let modelName: String
    let modelVersion: String
    let zone: String
    let storey: String
    let deviceName: String
    let deviceSupportsLidar: Bool
    let captureMode: String
    let capturedBy: String
    let capturedAt: String
    let notes: String
    let controlPoints: [ControlPointPayload]
    let observations: [ObservationPayload]
}

struct ScanSessionResponse: Codable, Identifiable {
    let id: String
    let projectId: String
    let status: String
    let modelName: String
}

struct LocalScanArtifact: Identifiable {
    enum Kind: String { case roomPlanJSON = "RoomPlan JSON"; case usdz = "USDZ"; case mesh = "Mesh"; case photo = "Foto" }
    let id = UUID()
    let kind: Kind
    let url: URL
    let capturedAt: Date
}

extension SIMD3 where Scalar == Float {
    var payload: Vector3Payload { .init(x: Double(x), y: Double(y), z: Double(z)) }
}
