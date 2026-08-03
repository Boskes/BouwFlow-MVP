import SwiftUI

@main
struct BouwFlowScanApp: App {
    var body: some Scene {
        WindowGroup {
            ScanFlowView(api: .productionPlaceholder)
        }
    }
}
