import SwiftUI
import RoomPlan

struct ScanFlowView: View {
    let api: BouwFlowAPIClient
    @ObservedObject var authentication: MicrosoftEntraTokenProvider
    @State private var purpose: ScanPurpose = .calculation
    @State private var selectedContextId = ""
    @State private var bootstrap: MobileBootstrap?
    @State private var catalog: [MobileLidarWork] = []
    @State private var modelId = "mobile-roomplan"
    @State private var modelName = "BouwFlow RoomPlan-opname"
    @State private var modelVersion = "OPNAME-01"
    @State private var zone = "Gelijkvloers"
    @State private var operatorName = ""
    @State private var running = false
    @State private var artifacts: [LocalScanArtifact] = []
    @State private var surveyElements: [SurveyElementPayload] = []
    @State private var assignments: [WorkAssignmentPayload] = []
    @State private var selectedCatalogCode = ""
    @State private var selectedElementIds: Set<String> = []
    @State private var selectedDailyReportIds: Set<String> = []
    @State private var selectedInspectionDocumentIds: Set<String> = []
    @State private var manuallyConfirmed = false
    @State private var status = "Meld aan om projecten en calculaties op te halen."
    @State private var sessionId: String?
    @State private var showCamera = false
    @State private var pendingCount = 0

    private let technicalKinds = ["Stopcontact", "Schakelaar", "Lichtpunt", "Elektrisch bord", "Datapunt", "Detector", "Leiding", "Afvoer", "Ventilatiekanaal", "Sanitair toestel", "Verwarmingstoestel", "Technische installatie"]

    var body: some View {
        NavigationStack {
            Form {
                authenticationSection
                if authentication.signedIn {
                    contextSection
                    captureSection
                    elementSection
                    workSection
                    evidenceSection
                    synchronizationSection
                }
            }
            .navigationTitle("BouwFlow Scan")
            .task { await refreshPendingCount() }
            .sheet(isPresented: $showCamera) {
                CameraEvidencePicker { artifact in
                    artifacts.append(artifact)
                    status = "Foto toegevoegd als controlebewijs."
                }.ignoresSafeArea()
            }
            .onChange(of: purpose) { _, _ in resetContextSelection() }
            .onOpenURL { openDeepLink($0) }
        }
    }

    private var authenticationSection: some View {
        Section("Microsoft 365") {
            HStack {
                Label(authentication.accountLabel, systemImage: authentication.signedIn ? "checkmark.shield.fill" : "person.crop.circle.badge.exclamationmark")
                Spacer()
                if authentication.signedIn { Button("Afmelden", role: .destructive) { authentication.signOut(); bootstrap = nil } }
            }
            if !authentication.signedIn {
                Button("Aanmelden bij BouwFlow") { Task { await signInAndLoad() } }.buttonStyle(.borderedProminent)
            }
            if let message = authentication.errorMessage { Text(message).foregroundStyle(.red).font(.footnote) }
        }
    }

    private var contextSection: some View {
        Section("1 · Opnameopdracht") {
            Picker("Doel", selection: $purpose) { ForEach(ScanPurpose.allCases) { Text($0.rawValue).tag($0) } }
            Picker(purpose == .calculation ? "Calculatie" : "Project", selection: $selectedContextId) {
                Text("Selecteer…").tag("")
                if purpose == .calculation {
                    ForEach(bootstrap?.calculations ?? []) { calculation in Text(calculationLabel(calculation)).tag(calculation.id) }
                } else {
                    ForEach(bootstrap?.projects ?? []) { project in Text("\(project.number) · \(project.name)").tag(project.id) }
                }
            }
            TextField("Zone of verdieping", text: $zone)
            TextField("Opnemer", text: $operatorName)
            DisclosureGroup("BIM-bron") {
                TextField("Model-ID", text: $modelId)
                TextField("Modelnaam", text: $modelName)
                TextField("Revisie", text: $modelVersion)
            }
        }
    }

    private var captureSection: some View {
        Section("2 · LiDAR, RoomPlan en foto's") {
            if RoomCaptureSession.isSupported {
                RoomPlanCaptureView(running: $running, onArtifacts: { newArtifacts in
                    artifacts.append(contentsOf: newArtifacts)
                    status = "Opname klaar: \(surveyElements.count) elementen en \(artifacts.count) bewijsbestanden."
                }, onElements: { elements in
                    surveyElements.append(contentsOf: elements.map { element in
                        var renamed = element
                        renamed.roomName = zone
                        return renamed
                    })
                }, onError: { status = $0.localizedDescription })
                .frame(minHeight: 300).clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                ContentUnavailableView("LiDAR niet beschikbaar", systemImage: "iphone.slash", description: Text("Gebruik een ondersteunde iPhone Pro of iPad Pro."))
            }
            HStack {
                Button(running ? "Opname stoppen" : "RoomPlan starten") { running.toggle() }.buttonStyle(.borderedProminent)
                Button("Foto") { showCamera = true }.buttonStyle(.bordered)
            }
            ForEach(artifacts) { artifact in Label(artifact.url.lastPathComponent, systemImage: artifact.kind == .photo ? "photo" : "cube.transparent") }
        }
    }

    private var elementSection: some View {
        Section("3 · Gemeten en manuele elementen") {
            if surveyElements.isEmpty { Text("Scan een ruimte of voeg technieken manueel toe.").foregroundStyle(.secondary) }
            ForEach($surveyElements) { $element in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(element.kind).font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text(elementMeasurement(element)).font(.caption.monospacedDigit())
                    }
                    TextField("Benaming", text: $element.label)
                    TextField("Ruimte", text: $element.roomName)
                    if element.count != nil { TextField("Aantal", value: Binding(get: { element.count ?? 1 }, set: { element.count = $0 }), format: .number) }
                    if element.lengthM != nil { TextField("Lengte (m)", value: Binding(get: { element.lengthM ?? 0 }, set: { element.lengthM = $0 }), format: .number) }
                }
            }
            Menu("Techniek of ander element toevoegen") {
                ForEach(technicalKinds, id: \.self) { kind in Button(kind) { addTechnicalElement(kind) } }
            }
        }
    }

    private var workSection: some View {
        Section("4 · Uit te voeren werken") {
            Picker("Werk", selection: $selectedCatalogCode) {
                Text("Selecteer uit catalogus…").tag("")
                ForEach(catalog) { item in Text("\(item.code) · \(item.name)").tag(item.code) }
            }
            if let work = selectedWork {
                Text("\(work.discipline) · \(work.unit) · \(work.description)").font(.footnote).foregroundStyle(.secondary)
                ForEach(compatibleElements(for: work)) { element in
                    Toggle("\(element.roomName) · \(element.label)", isOn: Binding(get: { selectedElementIds.contains(element.id) }, set: { selected in
                        if selected { selectedElementIds.insert(element.id) } else { selectedElementIds.remove(element.id) }
                    }))
                }
                Button("Werk aan selectie koppelen") { addAssignment(work) }.disabled(selectedElementIds.isEmpty)
            }
            ForEach(assignments) { assignment in
                HStack {
                    VStack(alignment: .leading) {
                        Text(catalog.first(where: { $0.code == assignment.catalogCode })?.name ?? assignment.catalogCode)
                        Text("\(assignment.elementIds.count) element(en) · hybride bewijs").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button(role: .destructive) { assignments.removeAll { $0.id == assignment.id } } label: { Image(systemName: "trash") }
                }
            }
        }
    }

    private var evidenceSection: some View {
        Section("5 · Aanvullend controlebewijs") {
            Toggle("Manueel gecontroleerd ter plaatse", isOn: $manuallyConfirmed)
            if purpose != .calculation {
                DisclosureGroup("Goedgekeurde dagrapporten") {
                    ForEach(projectDailyReports) { report in evidenceToggle("Dagrapport \(report.date) · \(report.status)", id: report.id, selection: $selectedDailyReportIds) }
                }
                DisclosureGroup("Keuringen en documenten") {
                    ForEach(projectInspectionDocuments) { document in evidenceToggle("\(document.title) · \(document.status)", id: document.id, selection: $selectedInspectionDocumentIds) }
                }
            }
            Text("BouwFlow combineert de geometrie met foto's, goedgekeurde dagrapporten, manuele bevestiging en keuringsdocumenten. Onzeker of technisch werk blijft altijd ter controle.")
                .font(.footnote).foregroundStyle(.secondary)
        }
    }

    private var synchronizationSection: some View {
        Section("6 · Naar BouwFlow") {
            Button("Opnamepakket verzenden") { Task { await synchronize() } }
                .buttonStyle(.borderedProminent)
                .disabled(!canSynchronize)
            if pendingCount > 0 { Button("\(pendingCount) offline opname(s) opnieuw proberen") { Task { await retryQueue() } } }
            Text(status).font(.footnote).foregroundStyle(.secondary)
            if let sessionId { Text("Scansessie: \(sessionId)").font(.caption2).textSelection(.enabled) }
        }
    }

    private var selectedWork: MobileLidarWork? { catalog.first { $0.code == selectedCatalogCode } }
    private var canSynchronize: Bool { !selectedContextId.isEmpty && operatorName.trimmingCharacters(in: .whitespaces).count >= 2 && !artifacts.isEmpty && !surveyElements.isEmpty }
    private var projectDailyReports: [MobileDailyReport] { (bootstrap?.dailyReports ?? []).filter { $0.projectId == selectedContextId && $0.status == "Ondertekend" } }
    private var projectInspectionDocuments: [MobileProjectDocument] { (bootstrap?.documents ?? []).filter { $0.projectId == selectedContextId && ($0.category.lowercased().contains("keur") || $0.category.lowercased().contains("attest") || $0.status == "Goedgekeurd") } }

    @ViewBuilder private func evidenceToggle(_ title: String, id: String, selection: Binding<Set<String>>) -> some View {
        Toggle(title, isOn: Binding(get: { selection.wrappedValue.contains(id) }, set: { enabled in
            var values = selection.wrappedValue
            if enabled { values.insert(id) } else { values.remove(id) }
            selection.wrappedValue = values
        }))
    }

    private func calculationLabel(_ calculation: MobileCalculation) -> String {
        let opportunity = bootstrap?.opportunities.first { $0.id == calculation.opportunityId }
        return "\(calculation.number) · \(opportunity?.title ?? "Calculatie")"
    }
    private func compatibleElements(for work: MobileLidarWork) -> [SurveyElementPayload] { surveyElements.filter { work.elementKinds.contains($0.kind) } }
    private func elementMeasurement(_ element: SurveyElementPayload) -> String {
        if let count = element.count { return "\(count.formatted()) st" }
        if let length = element.lengthM { return "\(length.formatted(.number.precision(.fractionLength(2)))) m" }
        if let area = element.netAreaM2 ?? element.areaM2 { return "\(area.formatted(.number.precision(.fractionLength(2)))) m²" }
        return "te controleren"
    }

    private func addTechnicalElement(_ kind: String) {
        let pointKinds = ["Stopcontact", "Schakelaar", "Lichtpunt", "Elektrisch bord", "Datapunt", "Detector", "Sanitair toestel", "Verwarmingstoestel", "Technische installatie"]
        let lineKinds = ["Leiding", "Afvoer", "Ventilatiekanaal"]
        let id = "manual-\(UUID().uuidString)"
        surveyElements.append(.init(id: id, roomId: "manual-\(zone)", roomName: zone, kind: kind, label: "\(kind) \(surveyElements.filter { $0.kind == kind }.count + 1)", sourceElementId: nil, areaM2: nil, netAreaM2: nil, lengthM: lineKinds.contains(kind) ? 1 : nil, volumeM3: nil, count: pointKinds.contains(kind) ? 1 : nil, confidencePct: 75, photoArtifactIds: []))
        status = "\(kind) toegevoegd. Pas de benaming aan en bevestig de hoeveelheid in BouwFlow."
    }

    private func addAssignment(_ work: MobileLidarWork) {
        let photoIds = artifacts.filter { $0.kind == .photo }.map { $0.id.uuidString }
        assignments.append(.init(id: UUID().uuidString, catalogCode: work.code, elementIds: Array(selectedElementIds), description: work.name, quantityOverride: nil, wastePct: nil, notes: "Toegevoegd op iPhone", photoArtifactIds: photoIds, dailyReportIds: Array(selectedDailyReportIds), inspectionDocumentIds: Array(selectedInspectionDocumentIds), manuallyConfirmed: manuallyConfirmed))
        selectedCatalogCode = ""; selectedElementIds.removeAll()
    }

    private func resetContextSelection() { selectedContextId = ""; selectedDailyReportIds.removeAll(); selectedInspectionDocumentIds.removeAll() }

    private func openDeepLink(_ url: URL) {
        guard url.scheme == "bouwflowscan", let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let parameters = Dictionary(uniqueKeysWithValues: (parts.queryItems ?? []).compactMap { item in item.value.map { (item.name, $0) } })
        if let calculation = parameters["calculation"] { purpose = .calculation; selectedContextId = calculation }
        if let project = parameters["project"] { purpose = parameters["purpose"] == "progress" ? .progress : .baseline; selectedContextId = project }
        status = "Scanopdracht uit BouwFlow geopend."
    }

    @MainActor private func signInAndLoad() async {
        do {
            status = "Microsoft-aanmelding openen…"
            _ = try await authentication.signIn()
            status = "Projecten en werkencatalogus ophalen…"
            async let stateRequest = api.bootstrap()
            async let worksRequest = api.workCatalog()
            let (state, works) = try await (stateRequest, worksRequest)
            bootstrap = state
            catalog = works
            selectedCatalogCode = catalog.first?.code ?? ""
            status = "Klaar voor een nieuwe opname."
        } catch { status = error.localizedDescription }
    }

    private func payload(assignments resolvedAssignments: [WorkAssignmentPayload]) -> ScanCreatePayload {
        let enrichedAssignments = resolvedAssignments.map { assignment in
            WorkAssignmentPayload(id: assignment.id, catalogCode: assignment.catalogCode, elementIds: assignment.elementIds, description: assignment.description, quantityOverride: assignment.quantityOverride, wastePct: assignment.wastePct, notes: assignment.notes, photoArtifactIds: assignment.photoArtifactIds, dailyReportIds: Array(Set(assignment.dailyReportIds).union(selectedDailyReportIds)), inspectionDocumentIds: Array(Set(assignment.inspectionDocumentIds).union(selectedInspectionDocumentIds)), manuallyConfirmed: assignment.manuallyConfirmed || manuallyConfirmed)
        }
        return .init(modelId: modelId, modelName: modelName, modelVersion: modelVersion, zone: zone, storey: zone, deviceName: UIDevice.current.model, deviceSupportsLidar: RoomCaptureSession.isSupported, captureMode: "Gecombineerd", capturedBy: operatorName, capturedAt: ISO8601DateFormatter().string(from: .now), notes: "Opname via BouwFlow Scan voor iPhone; hybride bewijs en manuele controle actief", purpose: purpose.rawValue, controlPoints: [], observations: [], surveyElements: surveyElements, workAssignments: enrichedAssignments)
    }

    @MainActor private func synchronize() async {
        let initialPayload = payload(assignments: assignments)
        var remoteScanId: String?
        do {
            status = "Scansessie in BouwFlow aanmaken…"
            let contextKind: ScanContextKind = purpose == .calculation ? .calculation : .project
            var scan = try await createRemoteScan(contextKind: contextKind, contextId: selectedContextId, payload: initialPayload)
            remoteScanId = scan.id; sessionId = scan.id
            for (index, artifact) in artifacts.enumerated() {
                status = "Bewijsbestand \(index + 1)/\(artifacts.count) uploaden…"
                scan = try await api.upload(scanId: scan.id, artifact: artifact)
            }
            let remotePhotoIds = scan.artifacts.filter { $0.kind == LocalScanArtifact.Kind.photo.rawValue }.map(\.id)
            let resolvedAssignments = initialPayload.workAssignments.map { assignment in
                .init(id: assignment.id, catalogCode: assignment.catalogCode, elementIds: assignment.elementIds, description: assignment.description, quantityOverride: assignment.quantityOverride, wastePct: assignment.wastePct, notes: assignment.notes, photoArtifactIds: remotePhotoIds, dailyReportIds: assignment.dailyReportIds, inspectionDocumentIds: assignment.inspectionDocumentIds, manuallyConfirmed: assignment.manuallyConfirmed)
            }
            if purpose == .calculation && !resolvedAssignments.isEmpty {
                status = "Calculatievoorstel opbouwen…"
                _ = try await api.buildCalculationProposal(scanId: scan.id, elements: surveyElements, assignments: resolvedAssignments)
                status = "Gesynchroniseerd. Controleer en keur het LiDAR-calculatievoorstel goed in BouwFlow."
            } else {
                status = "Gesynchroniseerd. Open de opname in BouwFlow voor BIM-koppeling en vorderingscontrole."
            }
        } catch {
            do {
                let kind: ScanContextKind = purpose == .calculation ? .calculation : .project
                try await ScanOfflineQueue.shared.enqueue(contextKind: kind, contextId: selectedContextId, payload: initialPayload, artifacts: artifacts, remoteScanId: remoteScanId)
                await refreshPendingCount()
                status = "Geen volledige verbinding. De opname is veilig lokaal bewaard en kan opnieuw worden verzonden."
            } catch { status = "Synchronisatie en lokale bewaring mislukt: \(error.localizedDescription)" }
        }
    }

    private func createRemoteScan(contextKind: ScanContextKind, contextId: String, payload: ScanCreatePayload) async throws -> ScanSessionResponse {
        if contextKind == .calculation { return try await api.createCalculationScan(calculationId: contextId, payload: payload) }
        return try await api.createScan(projectId: contextId, payload: payload)
    }

    @MainActor private func retryQueue() async {
        let queued = await ScanOfflineQueue.shared.all()
        for var item in queued {
            do {
                var scan: ScanSessionResponse
                if let id = item.remoteScanId {
                    scan = .init(id: id, projectId: item.contextKind == .project ? item.contextId : nil, status: "Opname", modelName: item.payload.modelName, calculationId: item.contextKind == .calculation ? item.contextId : nil, artifacts: [])
                } else {
                    scan = try await createRemoteScan(contextKind: item.contextKind, contextId: item.contextId, payload: item.payload)
                    item.remoteScanId = scan.id
                    try await ScanOfflineQueue.shared.update(item)
                }
                for artifact in item.artifacts { scan = try await api.upload(scanId: scan.id, artifact: artifact) }
                if item.contextKind == .calculation && !item.payload.workAssignments.isEmpty {
                    let photoIds = scan.artifacts.filter { $0.kind == LocalScanArtifact.Kind.photo.rawValue }.map(\.id)
                    let resolved = item.payload.workAssignments.map { assignment in
                        WorkAssignmentPayload(id: assignment.id, catalogCode: assignment.catalogCode, elementIds: assignment.elementIds, description: assignment.description, quantityOverride: assignment.quantityOverride, wastePct: assignment.wastePct, notes: assignment.notes, photoArtifactIds: photoIds, dailyReportIds: assignment.dailyReportIds, inspectionDocumentIds: assignment.inspectionDocumentIds, manuallyConfirmed: assignment.manuallyConfirmed)
                    }
                    _ = try await api.buildCalculationProposal(scanId: scan.id, elements: item.payload.surveyElements, assignments: resolved)
                }
                try await ScanOfflineQueue.shared.remove(id: item.id)
            } catch { status = "Offline opname nog niet verzonden: \(error.localizedDescription)" }
        }
        await refreshPendingCount()
        if pendingCount == 0 { status = "Alle offline opnames zijn gesynchroniseerd." }
    }

    @MainActor private func refreshPendingCount() async { pendingCount = await ScanOfflineQueue.shared.all().count }
}
