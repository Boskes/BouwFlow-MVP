import SwiftUI

@main
struct BouwFlowScanApp: App {
    var body: some Scene {
        WindowGroup {
            BouwFlowScanRoot()
        }
    }
}

@MainActor
private struct BouwFlowScanRoot: View {
    @StateObject private var authentication: MicrosoftEntraTokenProvider

    init() {
        let configuration = try! EntraNativeConfiguration.fromBundle()
        _authentication = StateObject(wrappedValue: MicrosoftEntraTokenProvider(configuration: configuration))
    }

    var body: some View {
        ScanFlowView(api: .production { try await authentication.accessToken() }, authentication: authentication)
    }
}
