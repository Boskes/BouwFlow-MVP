# BouwFlow Scan voor iPhone

Native capturecomponent voor de vier LiDAR-fases van BouwFlow. De webapp en deze iOS-client gebruiken dezelfde API en Entra-aanmelding.

## Vereisten

- Xcode 16 of nieuwer, iOS 17 als deployment target.
- iPhone Pro of iPad Pro met LiDAR voor RoomPlan en `sceneReconstruction`.
- Camera- en netwerktoestemming.
- Een geldige BouwFlow access token-provider. Tokens worden niet in broncode of `UserDefaults` opgeslagen.

## Integratie in Xcode

1. Maak een iOS App target `BouwFlowScan` met SwiftUI lifecycle.
2. Voeg alle `.swift`-bestanden in deze map aan het target toe.
3. Voeg `NSCameraUsageDescription` toe: `BouwFlow gebruikt de camera en LiDAR voor werfmetingen en BIM-bewijs.`
4. Configureer `BouwFlowAPIClient` met `https://aifestival.be` en de MSAL token-provider van de BouwFlow Entra-app.
5. Test op een fysiek LiDAR-toestel; de simulator ondersteunt geen RoomPlan- of meshopname.

Grote meshes worden als afzonderlijke bewijsbestanden verstuurd. Voor productiescans boven de serverlimiet moet de uploadadapter multipart/chunked upload gebruiken; de scanmetadata blijft lokaal in de wachtrij tot elk bewijsbestand bevestigd is.
