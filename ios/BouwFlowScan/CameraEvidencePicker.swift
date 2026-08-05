import SwiftUI
import UIKit

struct CameraEvidencePicker: UIViewControllerRepresentable {
    let onCapture: (LocalScanArtifact) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(owner: self) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let owner: CameraEvidencePicker
        init(owner: CameraEvidencePicker) { self.owner = owner }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { owner.dismiss() }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            guard let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.88) else { owner.dismiss(); return }
            do {
                let url = FileManager.default.temporaryDirectory.appending(path: "BouwFlow-\(UUID().uuidString).jpg")
                try data.write(to: url, options: .atomic)
                owner.onCapture(.init(kind: .photo, url: url, capturedAt: .now))
            } catch {}
            owner.dismiss()
        }
    }
}
