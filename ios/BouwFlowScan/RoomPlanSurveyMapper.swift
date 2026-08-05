import Foundation
import RoomPlan

enum RoomPlanSurveyMapper {
    static func elements(from room: CapturedRoom, roomName: String = "Gescande ruimte") -> [SurveyElementPayload] {
        let roomId = "room-\(UUID().uuidString)"
        var values: [SurveyElementPayload] = []
        let floorArea = room.floors.reduce(0.0) { $0 + Double($1.dimensions.x * $1.dimensions.y) }
        values.append(.init(id: roomId, roomId: roomId, roomName: roomName, kind: "Ruimte", label: roomName, sourceElementId: nil, areaM2: floorArea > 0 ? floorArea : nil, netAreaM2: nil, lengthM: nil, volumeM3: nil, count: 1, confidencePct: 98, photoArtifactIds: []))
        values += room.walls.enumerated().map { index, surface in surfaceElement(surface, roomId: roomId, roomName: roomName, kind: "Wand", label: "Wand \(index + 1)") }
        values += room.floors.enumerated().map { index, surface in surfaceElement(surface, roomId: roomId, roomName: roomName, kind: "Vloer", label: "Vloer \(index + 1)") }
        values += room.doors.enumerated().map { index, surface in countElement(surface, roomId: roomId, roomName: roomName, kind: "Deur", label: "Deur \(index + 1)") }
        values += room.windows.enumerated().map { index, surface in countElement(surface, roomId: roomId, roomName: roomName, kind: "Raam", label: "Raam \(index + 1)") }
        values += room.objects.enumerated().map { index, object in
            SurveyElementPayload(id: object.identifier.uuidString, roomId: roomId, roomName: roomName, kind: "Vrij element", label: "\(String(describing: object.category).capitalized) \(index + 1)", sourceElementId: object.identifier.uuidString, areaM2: Double(object.dimensions.x * object.dimensions.z), netAreaM2: nil, lengthM: Double(object.dimensions.x), volumeM3: Double(object.dimensions.x * object.dimensions.y * object.dimensions.z), count: 1, confidencePct: 82, photoArtifactIds: [])
        }
        return values
    }

    private static func surfaceElement(_ surface: CapturedRoom.Surface, roomId: String, roomName: String, kind: String, label: String) -> SurveyElementPayload {
        .init(id: surface.identifier.uuidString, roomId: roomId, roomName: roomName, kind: kind, label: label, sourceElementId: surface.identifier.uuidString, areaM2: Double(surface.dimensions.x * surface.dimensions.y), netAreaM2: Double(surface.dimensions.x * surface.dimensions.y), lengthM: Double(surface.dimensions.x), volumeM3: nil, count: nil, confidencePct: 96, photoArtifactIds: [])
    }

    private static func countElement(_ surface: CapturedRoom.Surface, roomId: String, roomName: String, kind: String, label: String) -> SurveyElementPayload {
        .init(id: surface.identifier.uuidString, roomId: roomId, roomName: roomName, kind: kind, label: label, sourceElementId: surface.identifier.uuidString, areaM2: Double(surface.dimensions.x * surface.dimensions.y), netAreaM2: nil, lengthM: nil, volumeM3: nil, count: 1, confidencePct: 95, photoArtifactIds: [])
    }
}
