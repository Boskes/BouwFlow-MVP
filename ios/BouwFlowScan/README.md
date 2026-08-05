# BouwFlow Scan voor iPhone

Native capturecomponent voor de vier LiDAR-fases van BouwFlow. De webapp en deze iOS-client gebruiken dezelfde API en Entra-aanmelding.

## Vereisten

- Xcode 16 of nieuwer, iOS 17 als deployment target.
- iPhone Pro of iPad Pro met LiDAR voor RoomPlan en `sceneReconstruction`.
- Camera- en netwerktoestemming.
- Een Entra-appregistratie met de BouwFlow API-scope. Refresh tokens worden uitsluitend in de iOS Keychain opgeslagen; nooit in broncode of `UserDefaults`.

## Integratie in Xcode

1. Maak een iOS App target `BouwFlowScan` met SwiftUI lifecycle.
2. Voeg alle `.swift`-bestanden in deze map aan het target toe.
3. Voeg `NSCameraUsageDescription` toe: `BouwFlow gebruikt de camera en LiDAR voor werfmetingen en BIM-bewijs.`
4. Voeg bij **URL Types** het schema `bouwflowscan` toe. Daarmee opent de QR-code uit de webapp de juiste calculatie of het juiste project.
5. Voeg ook het redirect-schema `msauth.be.bosis.BouwFlowScan` toe. Registreer in Entra bij de app `BouwFlow Web` onder **Authentication > Mobile and desktop applications** exact `msauth.be.bosis.BouwFlowScan://auth` als redirect URI.
6. Voeg de nieuwe bestanden `MicrosoftEntraTokenProvider.swift`, `RoomPlanSurveyMapper.swift`, `CameraEvidencePicker.swift` en `ScanOfflineQueue.swift` toe aan het app target.
7. Test op een fysiek LiDAR-toestel; de simulator ondersteunt geen RoomPlan- of meshopname.

## Volledige flow

1. Meld aan met Microsoft 365 en kies `Calculatie-opname`, `Nulmeting`, `Vorderingsopname` of `As-built`.
2. Selecteer de BouwFlow-calculatie of het project, scan de ruimte met RoomPlan en neem aanvullende foto's.
3. Benoem de gemeten elementen. Voeg niet-herkenbare technieken zoals stopcontacten, lichtpunten, leidingen en toestellen manueel toe.
4. Koppel uit te voeren werken uit de centrale BouwFlow-catalogus. Voor vorderingen kunnen ondertekende dagrapporten, manuele bevestiging en goedgekeurde keuringsdocumenten als aanvullend bewijs mee.
5. Verzend het opnamepakket. Bij wegvallend bereik bewaart BouwFlow Scan een duurzame kopie in Application Support en hervat de upload zonder tokens op schijf op te slaan.
6. Een calculatie-opname wordt in de webapp menselijk gecontroleerd, goedgekeurd en als posten toegepast. Na gunning wordt ze automatisch de projectnulmeting. Latere vorderingsopnames worden tegen die basislijn beoordeeld.

Grote meshes worden als afzonderlijke bewijsbestanden verstuurd. Voor productiescans boven de serverlimiet moet de uploadadapter multipart/chunked upload gebruiken; de scanmetadata blijft lokaal in de wachtrij tot elk bewijsbestand bevestigd is.
