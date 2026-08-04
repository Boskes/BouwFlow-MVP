import ARKit
import Combine
import Foundation

@MainActor
final class ARMeshCaptureManager: NSObject, ObservableObject, ARSessionDelegate {
    @Published private(set) var faceCount = 0
    @Published private(set) var supported = ARWorldTrackingConfiguration.supportsSceneReconstruction(.meshWithClassification)
    let session = ARSession()
    private var anchors: [UUID: ARMeshAnchor] = [:]

    override init() { super.init(); session.delegate = self }
    func start() throws {
        guard supported else { throw BouwFlowAPIError.rejected(409, "Dit toestel ondersteunt geen ARKit LiDAR-mesh.") }
        let configuration = ARWorldTrackingConfiguration(); configuration.sceneReconstruction = .meshWithClassification; configuration.environmentTexturing = .automatic
        session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }
    func stopAndExport() throws -> LocalScanArtifact {
        session.pause()
        struct AnchorSummary: Codable { let id: UUID; let transform: [Float]; let vertices: Int; let faces: Int }
        let summaries = anchors.values.map { anchor in AnchorSummary(id: anchor.identifier, transform: (0..<4).flatMap { column in (0..<4).map { row in anchor.transform[column][row] } }, vertices: anchor.geometry.vertices.count, faces: anchor.geometry.faces.count) }
        let url = FileManager.default.temporaryDirectory.appending(path: "BouwFlow-ARMesh-\(UUID().uuidString).json")
        try JSONEncoder().encode(summaries).write(to: url, options: .atomic)
        return .init(kind: .mesh, url: url, capturedAt: .now)
    }
    nonisolated func session(_ session: ARSession, didAdd anchors: [ARAnchor]) { Task { @MainActor in ingest(anchors) } }
    nonisolated func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) { Task { @MainActor in ingest(anchors) } }
    private func ingest(_ values: [ARAnchor]) { for case let mesh as ARMeshAnchor in values { anchors[mesh.identifier] = mesh }; faceCount = anchors.values.reduce(0) { $0 + $1.geometry.faces.count } }
}
