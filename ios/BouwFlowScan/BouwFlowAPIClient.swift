import Foundation

enum BouwFlowAPIError: LocalizedError {
    case invalidResponse
    case rejected(Int, String)
    var errorDescription: String? {
        switch self { case .invalidResponse: return "Ongeldig antwoord van BouwFlow"; case let .rejected(code, body): return "BouwFlow weigerde de aanvraag (\(code)): \(body)" }
    }
}
struct BouwFlowAPIClient {
    let baseURL: URL
    let accessToken: () async throws -> String

    static let productionPlaceholder = BouwFlowAPIClient(baseURL: URL(string: "https://aifestival.be")!) {
        throw BouwFlowAPIError.rejected(401, "Koppel hier de bestaande MSAL access-tokenprovider.")
    }

    static func production(accessToken: @escaping () async throws -> String) -> BouwFlowAPIClient {
        BouwFlowAPIClient(baseURL: URL(string: "https://aifestival.be")!, accessToken: accessToken)
    }

    private func request(path: String, method: String = "POST") async throws -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        return request
    }

    func createScan(projectId: String, payload: ScanCreatePayload) async throws -> ScanSessionResponse {
        var request = try await request(path: "api/projects/\(projectId)/lidar-scans")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.bouwFlow.encode(payload)
        return try await send(request)
    }

    func createCalculationScan(calculationId: String, payload: ScanCreatePayload) async throws -> ScanSessionResponse {
        var request = try await request(path: "api/calculations/\(calculationId)/lidar-scans")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.bouwFlow.encode(payload)
        return try await send(request)
    }

    func bootstrap() async throws -> MobileBootstrap {
        try await send(request(path: "api/bootstrap", method: "GET"))
    }

    func workCatalog() async throws -> [MobileLidarWork] {
        try await send(request(path: "api/lidar/work-catalog", method: "GET"))
    }

    func buildCalculationProposal(scanId: String, elements: [SurveyElementPayload], assignments: [WorkAssignmentPayload]) async throws -> ScanSessionResponse {
        struct Body: Encodable { let elements: [SurveyElementPayload]; let assignments: [WorkAssignmentPayload] }
        var request = try await request(path: "api/lidar-scans/\(scanId)/calculation-proposal")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.bouwFlow.encode(Body(elements: elements, assignments: assignments))
        return try await send(request)
    }

    func register(scanId: String, points: [ControlPointPayload], registeredBy: String) async throws -> ScanSessionResponse {
        struct Body: Encodable { let controlPoints: [ControlPointPayload]; let registeredBy: String }
        var request = try await request(path: "api/lidar-scans/\(scanId)/register")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.bouwFlow.encode(Body(controlPoints: points, registeredBy: registeredBy))
        return try await send(request)
    }

    func upload(scanId: String, artifact: LocalScanArtifact) async throws -> ScanSessionResponse {
        let boundary = "BouwFlow-\(UUID().uuidString)"
        var request = try await request(path: "api/lidar-scans/\(scanId)/artifacts")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        let fileData = try Data(contentsOf: artifact.url, options: .mappedIfSafe)
        var body = Data()
        body.appendMultipart(name: "kind", value: artifact.kind.rawValue, boundary: boundary)
        body.appendMultipart(name: "capturedAt", value: ISO8601DateFormatter().string(from: artifact.capturedAt), boundary: boundary)
        body.appendMultipart(name: "file", filename: artifact.url.lastPathComponent, contentType: artifact.kind == .usdz ? "model/vnd.usdz+zip" : "application/octet-stream", data: fileData, boundary: boundary)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body
        return try await send(request)
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw BouwFlowAPIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw BouwFlowAPIError.rejected(http.statusCode, String(data: data, encoding: .utf8) ?? "") }
        return try JSONDecoder.bouwFlow.decode(T.self, from: data)
    }
}

private extension JSONEncoder { static var bouwFlow: JSONEncoder { let value = JSONEncoder(); value.dateEncodingStrategy = .iso8601; return value } }
private extension JSONDecoder { static var bouwFlow: JSONDecoder { let value = JSONDecoder(); value.dateDecodingStrategy = .iso8601; return value } }
private extension Data {
    mutating func appendMultipart(name: String, value: String, boundary: String) { append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!) }
    mutating func appendMultipart(name: String, filename: String, contentType: String, data: Data, boundary: String) { append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(contentType)\r\n\r\n".data(using: .utf8)!); append(data); append("\r\n".data(using: .utf8)!) }
}
