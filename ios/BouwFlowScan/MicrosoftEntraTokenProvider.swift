import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import Security
import UIKit

enum EntraAuthenticationError: LocalizedError {
    case missingConfiguration(String)
    case invalidCallback
    case stateMismatch
    case tokenResponse(String)
    var errorDescription: String? {
        switch self {
        case let .missingConfiguration(key): return "Voeg \(key) toe aan Info.plist."
        case .invalidCallback: return "Microsoft heeft geen geldige aanmeldcode teruggegeven."
        case .stateMismatch: return "De Microsoft-aanmelding kon niet veilig worden geverifieerd."
        case let .tokenResponse(message): return "Microsoft-aanmelding mislukt: \(message)"
        }
    }
}

struct EntraNativeConfiguration {
    let tenantId: String
    let clientId: String
    let apiScope: String
    let redirectUri: String
    var callbackScheme: String { URL(string: redirectUri)?.scheme ?? "msauth.be.bosis.BouwFlowScan" }

    static func fromBundle(_ bundle: Bundle = .main) throws -> EntraNativeConfiguration {
        let defaults = [
            "BFEntraTenantId":"07ef58e4-80e9-412d-9eae-1402bd8688f9",
            "BFEntraClientId":"098454c9-7fdc-4c84-8f21-01d545dc2b45",
            "BFEntraApiScope":"api://1de63b38-1c20-40ff-8c9c-56801b6d73c2/access_as_user",
            "BFEntraRedirectUri":"msauth.be.bosis.BouwFlowScan://auth",
        ]
        func value(_ key: String) throws -> String {
            let value = (bundle.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let resolved = value?.isEmpty == false ? value : defaults[key] else { throw EntraAuthenticationError.missingConfiguration(key) }
            return resolved
        }
        return try .init(tenantId: value("BFEntraTenantId"), clientId: value("BFEntraClientId"), apiScope: value("BFEntraApiScope"), redirectUri: value("BFEntraRedirectUri"))
    }
}

@MainActor
final class MicrosoftEntraTokenProvider: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published private(set) var signedIn = false
    @Published private(set) var accountLabel = "Niet aangemeld"
    @Published private(set) var errorMessage: String?
    private let configuration: EntraNativeConfiguration
    private var accessTokenValue: String?
    private var accessTokenExpiry: Date = .distantPast
    private var webSession: ASWebAuthenticationSession?
    private let refreshTokenKey = "be.bosis.BouwFlowScan.entra.refresh-token"

    init(configuration: EntraNativeConfiguration) { self.configuration = configuration; super.init() }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? UIWindow(frame: UIScreen.main.bounds)
    }

    func accessToken() async throws -> String {
        if let token = accessTokenValue, accessTokenExpiry.timeIntervalSinceNow > 120 { return token }
        if let refreshToken = KeychainTokenStore.read(key: refreshTokenKey) {
            do { return try await refresh(refreshToken: refreshToken) }
            catch { KeychainTokenStore.delete(key: refreshTokenKey) }
        }
        return try await signIn()
    }

    func signIn() async throws -> String {
        errorMessage = nil
        let verifier = Self.randomBase64Url(byteCount: 48)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64UrlEncoded
        let state = Self.randomBase64Url(byteCount: 24)
        var parts = URLComponents(string: "https://login.microsoftonline.com/\(configuration.tenantId)/oauth2/v2.0/authorize")!
        parts.queryItems = [
            .init(name: "client_id", value: configuration.clientId), .init(name: "response_type", value: "code"), .init(name: "redirect_uri", value: configuration.redirectUri), .init(name: "response_mode", value: "query"),
            .init(name: "scope", value: "openid profile offline_access \(configuration.apiScope)"), .init(name: "state", value: state), .init(name: "code_challenge", value: challenge), .init(name: "code_challenge_method", value: "S256"), .init(name: "domain_hint", value: "bosis.be"),
        ]
        let callback = try await authenticate(url: parts.url!)
        guard let callbackParts = URLComponents(url: callback, resolvingAgainstBaseURL: false), callbackParts.queryItems?.first(where: { $0.name == "state" })?.value == state else { throw EntraAuthenticationError.stateMismatch }
        if let message = callbackParts.queryItems?.first(where: { $0.name == "error_description" })?.value { throw EntraAuthenticationError.tokenResponse(message) }
        guard let code = callbackParts.queryItems?.first(where: { $0.name == "code" })?.value else { throw EntraAuthenticationError.invalidCallback }
        return try await exchange(parameters: ["client_id":configuration.clientId,"grant_type":"authorization_code","code":code,"redirect_uri":configuration.redirectUri,"scope":"openid profile offline_access \(configuration.apiScope)","code_verifier":verifier])
    }

    func signOut() {
        accessTokenValue = nil; accessTokenExpiry = .distantPast; signedIn = false; accountLabel = "Niet aangemeld"; KeychainTokenStore.delete(key: refreshTokenKey)
    }

    private func refresh(refreshToken: String) async throws -> String {
        try await exchange(parameters: ["client_id":configuration.clientId,"grant_type":"refresh_token","refresh_token":refreshToken,"scope":"openid profile offline_access \(configuration.apiScope)"])
    }

    private func exchange(parameters: [String:String]) async throws -> String {
        var request = URLRequest(url: URL(string: "https://login.microsoftonline.com/\(configuration.tenantId)/oauth2/v2.0/token")!)
        request.httpMethod = "POST"; request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = parameters.sorted(by: { $0.key < $1.key }).map { "\($0.key.urlEncoded)=\($0.value.urlEncoded)" }.joined(separator: "&").data(using: .utf8)
        let (data,response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw EntraAuthenticationError.tokenResponse("ongeldig antwoord") }
        let result = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard (200..<300).contains(http.statusCode), let token = result.accessToken else { throw EntraAuthenticationError.tokenResponse(result.errorDescription ?? "HTTP \(http.statusCode)") }
        accessTokenValue = token; accessTokenExpiry = Date().addingTimeInterval(TimeInterval(result.expiresIn ?? 3600)); signedIn = true; accountLabel = "Microsoft 365 · bosis.be"
        if let refreshToken = result.refreshToken { KeychainTokenStore.write(key: refreshTokenKey, value: refreshToken) }
        return token
    }

    private func authenticate(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: configuration.callbackScheme) { callback,error in
                if let error { continuation.resume(throwing: error) }
                else if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: EntraAuthenticationError.invalidCallback) }
            }
            session.presentationContextProvider = self; session.prefersEphemeralWebBrowserSession = false; self.webSession = session
            if !session.start() { continuation.resume(throwing: EntraAuthenticationError.invalidCallback) }
        }
    }

    private static func randomBase64Url(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount); _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes); return Data(bytes).base64UrlEncoded
    }
}

private struct TokenResponse: Decodable {
    let accessToken: String?; let refreshToken: String?; let expiresIn: Int?; let errorDescription: String?
    enum CodingKeys: String, CodingKey { case accessToken = "access_token"; case refreshToken = "refresh_token"; case expiresIn = "expires_in"; case errorDescription = "error_description" }
}

private enum KeychainTokenStore {
    static func write(key:String,value:String){delete(key:key);let data=Data(value.utf8);SecItemAdd([kSecClass:kSecClassGenericPassword,kSecAttrService:key,kSecValueData:data,kSecAttrAccessible:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly] as CFDictionary,nil)}
    static func read(key:String)->String?{var item:CFTypeRef?;let status=SecItemCopyMatching([kSecClass:kSecClassGenericPassword,kSecAttrService:key,kSecReturnData:true,kSecMatchLimit:kSecMatchLimitOne] as CFDictionary,&item);guard status==errSecSuccess,let data=item as? Data else{return nil};return String(data:data,encoding:.utf8)}
    static func delete(key:String){SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:key] as CFDictionary)}
}

private extension Data { var base64UrlEncoded:String{base64EncodedString().replacingOccurrences(of:"+",with:"-").replacingOccurrences(of:"/",with:"_").replacingOccurrences(of:"=",with:"")} }
private extension String { var urlEncoded:String{addingPercentEncoding(withAllowedCharacters:.alphanumerics) ?? self} }
