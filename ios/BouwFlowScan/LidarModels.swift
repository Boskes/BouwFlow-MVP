import Foundation
import simd

enum ScanPurpose: String, Codable, CaseIterable, Identifiable {
    case calculation = "Calculatie-opname"
    case baseline = "Nulmeting"
    case progress = "Vorderingsopname"
    case asBuilt = "As-built"
    var id: String { rawValue }
}

struct MobileOpportunity: Codable, Identifiable { let id: String; let title: String }
struct MobileCalculation: Codable, Identifiable { let id: String; let number: String; let opportunityId: String }
struct MobileProject: Codable, Identifiable { let id: String; let number: String; let name: String; let sourceCalculationId: String }
struct MobileDailyReport: Codable, Identifiable {
    let id: String
    let projectId: String
    let date: String
    let status: String
}
struct MobileProjectDocument: Codable, Identifiable {
    let id: String
    let projectId: String
    let title: String
    let category: String
    let status: String
}
struct MobileBootstrap: Codable {
    let opportunities: [MobileOpportunity]
    let calculations: [MobileCalculation]
    let projects: [MobileProject]
    let dailyReports: [MobileDailyReport]
    let documents: [MobileProjectDocument]
}

struct MobileLidarWork: Codable, Identifiable {
    let code: String
    let name: String
    let discipline: String
    let elementKinds: [String]
    let unit: String
    let quantityBasis: String
    let evidence: [String]
    let description: String
    var id: String { code }
}

struct SurveyElementPayload: Codable, Identifiable {
    let id: String
    let roomId: String
    var roomName: String
    let kind: String
    var label: String
    let sourceElementId: String?
    var areaM2: Double?
    var netAreaM2: Double?
    var lengthM: Double?
    var volumeM3: Double?
    var count: Double?
    var confidencePct: Double
    var photoArtifactIds: [String]
}

struct WorkAssignmentPayload: Codable, Identifiable {
    let id: String
    let catalogCode: String
    let elementIds: [String]
    let description: String?
    let quantityOverride: Double?
    let wastePct: Double?
    let notes: String?
    let photoArtifactIds: [String]
    let dailyReportIds: [String]
    let inspectionDocumentIds: [String]
    let manuallyConfirmed: Bool
}

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
    let dailyReportIds: [String]
    let inspectionDocumentIds: [String]
    let manuallyConfirmed: Bool
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
    let purpose: String
    let controlPoints: [ControlPointPayload]
    let observations: [ObservationPayload]
    let surveyElements: [SurveyElementPayload]
    let workAssignments: [WorkAssignmentPayload]
}

struct ScanSessionResponse: Codable, Identifiable {
    let id: String
    let projectId: String?
    let status: String
    let modelName: String
    let calculationId: String?
    let artifacts: [MobileScanArtifact]
}

struct MobileScanArtifact: Codable, Identifiable {
    let id: String
    let kind: String
    let fileName: String
}

struct LocalScanArtifact: Identifiable, Codable {
    enum Kind: String, Codable { case roomPlanJSON = "RoomPlan JSON"; case usdz = "USDZ"; case mesh = "Mesh"; case photo = "Foto" }
    let id = UUID()
    let kind: Kind
    let url: URL
    let capturedAt: Date
}

enum ScanContextKind: String, Codable { case calculation, project }

struct QueuedMobileScan: Identifiable, Codable {
    let id: UUID
    let contextKind: ScanContextKind
    let contextId: String
    let payload: ScanCreatePayload
    let artifacts: [LocalScanArtifact]
    var remoteScanId: String?
    let queuedAt: Date
}

extension SIMD3 where Scalar == Float {
    var payload: Vector3Payload { .init(x: Double(x), y: Double(y), z: Double(z)) }
}
