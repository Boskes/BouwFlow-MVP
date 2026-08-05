import SwiftUI
import RoomPlan

@available(iOS 16.0, *)
struct RoomPlanCaptureView: UIViewRepresentable {
    @Binding var running: Bool
    let onArtifacts: ([LocalScanArtifact]) -> Void
    let onError: (Error) -> Void

    func makeCoordinator() -> RoomPlanCaptureCoordinator { RoomPlanCaptureCoordinator(onArtifacts: onArtifacts, onError: onError) }
    func makeUIView(context: Context) -> RoomCaptureView { let view = RoomCaptureView(frame: .zero); view.delegate = context.coordinator; context.coordinator.view = view; return view }
    func updateUIView(_ view: RoomCaptureView, context: Context) { if running && !context.coordinator.running { context.coordinator.running = true; view.captureSession.run(configuration: .init()) } else if !running && context.coordinator.running { view.captureSession.stop() } }
    static func dismantleUIView(_ view: RoomCaptureView, coordinator: RoomPlanCaptureCoordinator) {
        if coordinator.running { view.captureSession.stop() }
        coordinator.running = false
        view.delegate = nil
    }

}

@available(iOS 16.0, *)
@objc(BouwFlowRoomPlanCaptureCoordinator)
final class RoomPlanCaptureCoordinator: NSObject, RoomCaptureViewDelegate {
    weak var view: RoomCaptureView?
    var running = false
    let onArtifacts: ([LocalScanArtifact]) -> Void
    let onError: (Error) -> Void

    init(onArtifacts: @escaping ([LocalScanArtifact]) -> Void, onError: @escaping (Error) -> Void) {
        self.onArtifacts = onArtifacts
        self.onError = onError
        super.init()
    }

    required init?(coder: NSCoder) { nil }
    func encode(with coder: NSCoder) {}

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool { if let error { onError(error); return false }; return true }
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        running = false
        if let error { onError(error); return }
        do {
            let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let usdz = folder.appending(path: "BouwFlow-RoomPlan.usdz")
            let json = folder.appending(path: "BouwFlow-RoomPlan.json")
            try processedResult.export(to: usdz, exportOptions: .model)
            try JSONEncoder().encode(processedResult).write(to: json, options: .atomic)
            onArtifacts([.init(kind: .usdz, url: usdz, capturedAt: .now), .init(kind: .roomPlanJSON, url: json, capturedAt: .now)])
        } catch { onError(error) }
    }
}
