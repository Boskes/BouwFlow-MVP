import SwiftUI
import RoomPlan

struct ScanFlowView: View {
    let api: BouwFlowAPIClient
    @State private var projectId = ""
    @State private var modelId = ""
    @State private var modelName = "Building-Architecture.ifc"
    @State private var modelVersion = "AFC-01"
    @State private var zone = "Gelijkvloers"
    @State private var operatorName = ""
    @State private var running = false
    @State private var showingCapture = false
    @State private var artifacts: [LocalScanArtifact] = []
    @State private var status = "Klaar voor opname"
    @State private var sessionId: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Project en BIM") { TextField("Project-ID", text: $projectId); TextField("Model-ID", text: $modelId); TextField("Modelnaam", text: $modelName); TextField("Revisie", text: $modelVersion); TextField("Zone", text: $zone); TextField("Opnemer", text: $operatorName) }
                Section("Fase 1 · LiDAR-opname") {
                    if !RoomCaptureSession.isSupported { ContentUnavailableView("LiDAR niet beschikbaar", systemImage: "iphone.slash", description: Text("Gebruik een ondersteunde iPhone Pro of iPad Pro.")) }
                    Button("RoomPlan starten") { running = true; showingCapture = true }.buttonStyle(.borderedProminent).disabled(!RoomCaptureSession.isSupported)
                    ForEach(artifacts) { artifact in Label(artifact.url.lastPathComponent, systemImage: artifact.kind == .photo ? "photo" : "cube.transparent") }
                }
                Section("Synchronisatie") { Button("Naar BouwFlow verzenden") { Task { await synchronize() } }.disabled(projectId.isEmpty || modelId.isEmpty || operatorName.isEmpty || artifacts.isEmpty); Text(status).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("BouwFlow Scan")
            .fullScreenCover(isPresented: $showingCapture, onDismiss: { running = false }) {
                ZStack(alignment: .bottom) {
                    RoomPlanCaptureView(
                        running: $running,
                        onArtifacts: { newArtifacts in
                            artifacts.append(contentsOf: newArtifacts)
                            status = "Opname klaar: \(artifacts.count) bewijsbestanden"
                            running = false
                            showingCapture = false
                        },
                        onError: { error in
                            status = error.localizedDescription
                            running = false
                            showingCapture = false
                        }
                    )
                    .ignoresSafeArea()

                    Button("Opname stoppen") { running = false }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                        .padding(.bottom, 28)
                }
            }
        }
    }

    private func synchronize() async {
        do {
            status = "Scansessie aanmaken…"
            let payload = ScanCreatePayload(modelId: modelId, modelName: modelName, modelVersion: modelVersion, zone: zone, storey: zone, deviceName: UIDevice.current.model, deviceSupportsLidar: RoomCaptureSession.isSupported, captureMode: "Gecombineerd", capturedBy: operatorName, capturedAt: ISO8601DateFormatter().string(from: .now), notes: "Opname via BouwFlow Scan voor iPhone", controlPoints: [], observations: [])
            let scan = try await api.createScan(projectId: projectId, payload: payload); sessionId = scan.id
            for (index, artifact) in artifacts.enumerated() { status = "Bewijsbestand \(index + 1)/\(artifacts.count) uploaden…"; _ = try await api.upload(scanId: scan.id, artifact: artifact) }
            status = "Gesynchroniseerd. Open fase 2 in BouwFlow voor controlepunten en IFC-koppeling."
        } catch { status = error.localizedDescription }
    }
}
