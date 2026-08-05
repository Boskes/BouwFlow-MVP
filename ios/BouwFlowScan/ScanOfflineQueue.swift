import Foundation

actor ScanOfflineQueue {
    static let shared = ScanOfflineQueue()
    private let folder: URL
    private let index: URL

    init(fileManager: FileManager = .default) {
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        folder = support.appending(path: "BouwFlowScanQueue", directoryHint: .isDirectory)
        index = folder.appending(path: "queue.json")
        try? fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
    }

    func all() -> [QueuedMobileScan] { load() }

    func enqueue(contextKind: ScanContextKind, contextId: String, payload: ScanCreatePayload, artifacts: [LocalScanArtifact], remoteScanId: String?) throws {
        let id = UUID()
        let itemFolder = folder.appending(path: id.uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: itemFolder, withIntermediateDirectories: true)
        let durableArtifacts = try artifacts.map { artifact -> LocalScanArtifact in
            let target = itemFolder.appending(path: artifact.url.lastPathComponent)
            if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
            try FileManager.default.copyItem(at: artifact.url, to: target)
            return .init(kind: artifact.kind, url: target, capturedAt: artifact.capturedAt)
        }
        var items = load()
        items.append(.init(id: id, contextKind: contextKind, contextId: contextId, payload: payload, artifacts: durableArtifacts, remoteScanId: remoteScanId, queuedAt: .now))
        try save(items)
    }

    func update(_ item: QueuedMobileScan) throws {
        var items = load()
        items = items.map { $0.id == item.id ? item : $0 }
        try save(items)
    }

    func remove(id: UUID) throws {
        var items = load()
        items.removeAll { $0.id == id }
        try save(items)
        try? FileManager.default.removeItem(at: folder.appending(path: id.uuidString, directoryHint: .isDirectory))
    }

    private func load() -> [QueuedMobileScan] {
        guard let data = try? Data(contentsOf: index) else { return [] }
        return (try? JSONDecoder.bouwFlowQueue.decode([QueuedMobileScan].self, from: data)) ?? []
    }
    private func save(_ items: [QueuedMobileScan]) throws {
        try JSONEncoder.bouwFlowQueue.encode(items).write(to: index, options: .atomic)
    }
}

private extension JSONEncoder { static var bouwFlowQueue: JSONEncoder { let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601; return encoder } }
private extension JSONDecoder { static var bouwFlowQueue: JSONDecoder { let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601; return decoder } }
