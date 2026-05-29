import CoreGraphics
import Foundation
import ImageIO
import Testing
@testable import OllamaPetRunner

@Test
func petJSONParsesAndMissingFieldsAreDiagnosable() throws {
    let root = try makeTemporaryPetDirectory()
    defer { try? FileManager.default.removeItem(at: root) }

    try """
    {
      "id": "miku",
      "displayName": "Miku",
      "description": "test pet",
      "spritesheetPath": "spritesheet.webp"
    }
    """.write(to: root.appending(path: "pet.json"), atomically: true, encoding: .utf8)

    let data = try Data(contentsOf: root.appending(path: "pet.json"))
    let definition = try JSONDecoder().decode(PetDefinition.self, from: data)

    #expect(definition.id == "miku")
    #expect(definition.displayName == "Miku")
    #expect(definition.spritesheetPath == "spritesheet.webp")

    try """
    {
      "id": "miku",
      "displayName": "Miku",
      "description": "test pet"
    }
    """.write(to: root.appending(path: "pet.json"), atomically: true, encoding: .utf8)

    #expect(throws: PetAssetError.self) {
        try PetAssetLoader.loadPet(from: root)
    }
}

@Test
func petAssetLoaderDefaultsToAssistantApplicationSupport() {
    let legacyDotDirectory = ".co" + "dex"

    #expect(PetAssetLoader.petDirectoryEnvironmentKey == "OLLAMA_MENU_ASSISTANT_PET_DIRECTORY")
    #expect(PetAssetLoader.defaultPetDirectory.path.contains("Library/Application Support/OllamaMenuAssistant/Pets/miku"))
    #expect(!PetAssetLoader.defaultPetDirectory.path.contains(legacyDotDirectory))
}

@Test
func petAssetLoaderPrefersRedrawSpritesheetWhenPresent() throws {
    let root = try makeTemporaryPetDirectory()
    defer { try? FileManager.default.removeItem(at: root) }

    try """
    {
      "id": "miku",
      "displayName": "Miku",
      "description": "test pet",
      "spritesheetPath": "spritesheet.webp"
    }
    """.write(to: root.appending(path: "pet.json"), atomically: true, encoding: .utf8)

    try writeTestSpritesheet(
        at: root.appending(path: "spritesheet.webp"),
        dimensions: PetAtlasSpec.assistantDefault.expectedDimensions
    )
    try writeTestSpritesheet(
        at: root.appending(path: "spritesheet.redraw.webp"),
        dimensions: PetAtlasSpec.redraw.expectedDimensions
    )

    let asset = try PetAssetLoader.loadPet(from: root)

    #expect(asset.spritesheetURL?.lastPathComponent == "spritesheet.redraw.webp")
    #expect(asset.dimensions == PetAtlasSpec.redraw.expectedDimensions)
    #expect(asset.atlas?.supportsDirectionalRunning == true)
    #expect(asset.atlas?.supportsFullInteractions == true)
    #expect(asset.atlas?.supportsIdleVariants == true)
}

@Test
func petAssetLoaderAcceptsModelOnlyPetDefinitions() throws {
    let root = try makeTemporaryPetDirectory()
    defer { try? FileManager.default.removeItem(at: root) }

    try """
    {
      "id": "shiina-3d",
      "displayName": "Shiina 3D",
      "description": "test 3D pet",
      "modelPath": "model.dae"
    }
    """.write(to: root.appending(path: "pet.json"), atomically: true, encoding: .utf8)
    try Data("placeholder".utf8).write(to: root.appending(path: "model.dae"))

    let asset = try PetAssetLoader.loadPet(from: root)

    guard case let .model3D(modelURL) = asset.content else {
        Issue.record("expected 3D model asset")
        return
    }
    #expect(modelURL.lastPathComponent == "model.dae")
}

@Test
func atlasSizeValidationOnlyAcceptsAssistantSpritesheetDimensions() throws {
    let atlas = PetAtlasSpec.assistantDefault

    try atlas.validate(dimensions: PetImageDimensions(width: 1536, height: 1872))

    #expect(throws: PetAtlasError.invalidSpritesheetSize(
        actual: PetImageDimensions(width: 1536, height: 1800),
        expected: PetImageDimensions(width: 1536, height: 1872)
    )) {
        try atlas.validate(dimensions: PetImageDimensions(width: 1536, height: 1800))
    }
}

@Test
func animationStateMappingMatchesAssistantPetRowsAndFrameCounts() {
    #expect(PetAnimationMap.spec(for: .idle) == PetAnimationSpec(row: 0, frameCount: 6, framesPerSecond: 6, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningRight) == PetAnimationSpec(row: 1, frameCount: 8, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningLeft) == PetAnimationSpec(row: 2, frameCount: 8, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningVertical) == PetAnimationSpec(row: 7, frameCount: 6, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningUp, atlas: .directional) == PetAnimationSpec(row: 9, frameCount: 6, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningDown, atlas: .directional) == PetAnimationSpec(row: 10, frameCount: 6, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningUpRight, atlas: .directional) == PetAnimationSpec(row: 11, frameCount: 8, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .runningDownLeft, atlas: .directional) == PetAnimationSpec(row: 14, frameCount: 8, framesPerSecond: 10, repeats: true))
    #expect(PetAnimationMap.spec(for: .catchingBreath) == PetAnimationSpec(row: 6, frameCount: 6, framesPerSecond: 7, repeats: true))
    #expect(PetAnimationMap.spec(for: .catchingBreath, atlas: .fullInteraction) == PetAnimationSpec(row: 15, frameCount: 6, framesPerSecond: 7, repeats: true))
    #expect(PetAnimationMap.spec(for: .arriveHandsOnHips, atlas: .fullInteraction) == PetAnimationSpec(row: 16, frameCount: 6, framesPerSecond: 7, repeats: false))
    #expect(PetAnimationMap.spec(for: .arrivePeace, atlas: .fullInteraction) == PetAnimationSpec(row: 17, frameCount: 6, framesPerSecond: 7, repeats: false))
    #expect(PetAnimationMap.spec(for: .dragging, atlas: .fullInteraction) == PetAnimationSpec(row: 18, frameCount: 5, framesPerSecond: 8, repeats: true))
    #expect(PetAnimationMap.spec(for: .headPat, atlas: .fullInteraction) == PetAnimationSpec(row: 19, frameCount: 6, framesPerSecond: 7, repeats: false))
    #expect(PetAnimationMap.spec(for: .idleBlink, atlas: .redraw) == PetAnimationSpec(row: 24, frameCount: 6, framesPerSecond: 5, repeats: true))
    #expect(PetAnimationMap.spec(for: .idleLookAround, atlas: .redraw) == PetAnimationSpec(row: 25, frameCount: 6, framesPerSecond: 5, repeats: true))
    #expect(PetAnimationMap.spec(for: .idleHairSway, atlas: .redraw) == PetAnimationSpec(row: 26, frameCount: 6, framesPerSecond: 6, repeats: true))
    #expect(PetAnimationMap.spec(for: .idleStretch, atlas: .redraw) == PetAnimationSpec(row: 27, frameCount: 8, framesPerSecond: 6, repeats: true))
    #expect(PetAnimationMap.spec(for: .idleBlinkTap, atlas: .redraw) == PetAnimationSpec(row: 28, frameCount: 5, framesPerSecond: 8, repeats: false))
    #expect(PetAnimationMap.spec(for: .idleLookAroundTap, atlas: .redraw) == PetAnimationSpec(row: 29, frameCount: 6, framesPerSecond: 7, repeats: false))
    #expect(PetAnimationMap.spec(for: .idleHairSwayTap, atlas: .redraw) == PetAnimationSpec(row: 30, frameCount: 6, framesPerSecond: 7, repeats: false))
    #expect(PetAnimationMap.spec(for: .idleStretchTap, atlas: .redraw) == PetAnimationSpec(row: 31, frameCount: 6, framesPerSecond: 7, repeats: false))
    #expect(PetAnimationMap.spec(for: .waving) == PetAnimationSpec(row: 3, frameCount: 4, framesPerSecond: 8, repeats: false))
    #expect(PetAnimationMap.spec(for: .jumping) == PetAnimationSpec(row: 4, frameCount: 5, framesPerSecond: 8, repeats: false))
}

@Test
func directionalStatesFallbackToBaseAtlasRowsWhenExtendedAtlasIsMissing() {
    #expect(PetAnimationMap.spec(for: .runningUp) == PetAnimationMap.spec(for: .runningVertical))
    #expect(PetAnimationMap.spec(for: .runningDown) == PetAnimationMap.spec(for: .runningVertical))
    #expect(PetAnimationMap.spec(for: .runningUpRight) == PetAnimationMap.spec(for: .runningRight))
    #expect(PetAnimationMap.spec(for: .runningDownLeft) == PetAnimationMap.spec(for: .runningLeft))
    #expect(PetAnimationMap.spec(for: .arrivePeace) == PetAnimationMap.spec(for: .waving))
    #expect(PetAnimationMap.spec(for: .dragging) == PetAnimationMap.spec(for: .jumping))
    #expect(PetAnimationMap.spec(for: .idleBlink, atlas: .fullInteraction) == PetAnimationMap.spec(for: .idle, atlas: .fullInteraction))
    #expect(PetAnimationMap.spec(for: .idleStretchTap, atlas: .fullInteraction) == PetAnimationMap.spec(for: .bodyTap, atlas: .fullInteraction))
}

@Test
func directionalRunningCanBeForcedToCommonBaseRowsForMixedPetGroups() {
    #expect(
        PetAnimationMap.spec(for: .runningUp, atlas: .redraw, allowsDirectionalRunning: false) ==
            PetAnimationMap.spec(for: .runningVertical, atlas: .redraw)
    )
    #expect(
        PetAnimationMap.spec(for: .runningDownRight, atlas: .redraw, allowsDirectionalRunning: false) ==
            PetAnimationMap.spec(for: .runningRight, atlas: .redraw)
    )
    #expect(
        PetAnimationMap.spec(for: .runningUpLeft, atlas: .redraw, allowsDirectionalRunning: false) ==
            PetAnimationMap.spec(for: .runningLeft, atlas: .redraw)
    )
    #expect(PetAnimationMap.spec(for: .runningUpRight, atlas: .redraw).row == 11)
}

@Test
func redrawAtlasDetectsIdleVariantRows() throws {
    let atlas = try PetAtlasSpec.detect(dimensions: PetAtlasSpec.redraw.expectedDimensions)

    #expect(atlas.rows == 32)
    #expect(atlas.supportsDirectionalRunning)
    #expect(atlas.supportsFullInteractions)
    #expect(atlas.supportsIdleVariants)
    #expect(try atlas.frameRect(row: 31, column: 7) == CGRect(x: 1344, y: 6448, width: 192, height: 208))
}

@Test
func wanderTargetAlwaysFallsInsideVisibleFrame() {
    let visibleFrame = CGRect(x: 100, y: 80, width: 900, height: 700)
    let windowSize = CGSize(width: 128, height: 139)

    let lower = PetWanderModel.randomTarget(
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        randomUnit: { 0 }
    )
    let upper = PetWanderModel.randomTarget(
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        randomUnit: { 1 }
    )

    #expect(lower == CGPoint(x: 100, y: 80))
    #expect(upper == CGPoint(x: 872, y: 641))
    #expect(lower.x >= visibleFrame.minX)
    #expect(lower.y >= visibleFrame.minY)
    #expect(lower.x + windowSize.width <= visibleFrame.maxX)
    #expect(lower.y + windowSize.height <= visibleFrame.maxY)
    #expect(upper.x >= visibleFrame.minX)
    #expect(upper.y >= visibleFrame.minY)
    #expect(upper.x + windowSize.width <= visibleFrame.maxX)
    #expect(upper.y + windowSize.height <= visibleFrame.maxY)
}

@Test
func clickTargetPlacesPetFeetNearClickedPointAndClampsToVisibleFrame() {
    let visibleFrame = CGRect(x: 100, y: 80, width: 900, height: 700)
    let windowSize = CGSize(width: 128, height: 139)

    let target = PetWanderModel.clickTargetOrigin(
        for: CGPoint(x: 400, y: 360),
        visibleFrame: visibleFrame,
        windowSize: windowSize
    )
    let edgeTarget = PetWanderModel.clickTargetOrigin(
        for: CGPoint(x: 10, y: 10),
        visibleFrame: visibleFrame,
        windowSize: windowSize
    )

    #expect(target == CGPoint(x: 336, y: 344))
    #expect(edgeTarget == CGPoint(x: 100, y: 80))
}

@Test
func threePetFormationUsesEquilateralTriangle() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 1200, height: 900)
    let windowSize = CGSize(width: 128, height: 139)
    let layout = PetFormationLayout(slotCount: 3, windowSize: windowSize)
    let anchor = CGPoint(x: 500, y: 360)

    let centers = (0..<3)
        .map { layout.origin(for: $0, around: anchor, visibleFrame: visibleFrame) }
        .map { CGPoint(x: $0.x + windowSize.width / 2, y: $0.y + windowSize.height / 2) }

    let expectedSide = max(windowSize.width, windowSize.height) + 24
    #expect(abs(distance(centers[0], centers[1]) - expectedSide) < 0.001)
    #expect(abs(distance(centers[1], centers[2]) - expectedSide) < 0.001)
    #expect(abs(distance(centers[2], centers[0]) - expectedSide) < 0.001)
    #expect(centers[0].y > centers[1].y)
    #expect(abs(centers[1].y - centers[2].y) < 0.001)
}

@Test
func twoPetFormationUsesStableTriangleSlots() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 1200, height: 900)
    let windowSize = CGSize(width: 128, height: 139)
    let layout = PetFormationLayout(slotCount: 2, windowSize: windowSize)
    let anchor = CGPoint(x: 500, y: 360)

    let first = layout.origin(for: 0, around: anchor, visibleFrame: visibleFrame)
    let second = layout.origin(for: 1, around: anchor, visibleFrame: visibleFrame)

    #expect(first.x > second.x)
    #expect(first.y > second.y)
    #expect(abs(distance(first, second) - layout.sideLength) < 0.001)
}

@Test
func singlePetFormationStillReservesTriangleSlots() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 1200, height: 900)
    let windowSize = CGSize(width: 128, height: 139)
    let singleLayout = PetFormationLayout(slotCount: 1, windowSize: windowSize)
    let triangleLayout = PetFormationLayout(slotCount: 3, windowSize: windowSize)
    let anchor = CGPoint(x: 500, y: 360)

    #expect(
        singleLayout.origin(for: 0, around: anchor, visibleFrame: visibleFrame) ==
            triangleLayout.origin(for: 0, around: anchor, visibleFrame: visibleFrame)
    )
}

@Test
func petFormationClampsWholeGroupInsideVisibleFrame() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 360, height: 360)
    let windowSize = CGSize(width: 128, height: 139)
    let layout = PetFormationLayout(slotCount: 3, windowSize: windowSize)
    let anchorNearEdge = CGPoint(x: 340, y: 340)

    for slotIndex in 0..<3 {
        let origin = layout.origin(
            for: slotIndex,
            around: anchorNearEdge,
            visibleFrame: visibleFrame
        )

        #expect(origin.x >= visibleFrame.minX)
        #expect(origin.y >= visibleFrame.minY)
        #expect(origin.x + windowSize.width <= visibleFrame.maxX)
        #expect(origin.y + windowSize.height <= visibleFrame.maxY)
    }
}

@Test
func petDoesNotMoveWithoutClickTarget() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 500, height: 500)
    let windowSize = CGSize(width: 128, height: 139)
    let origin = CGPoint(x: 120, y: 140)
    var model = PetWanderModel()

    let tick = model.tick(
        currentOrigin: origin,
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1,
        randomUnit: { 1 }
    )

    #expect(tick.origin == origin)
    #expect(tick.animationState == .idle)
    #expect(model.target == nil)
}

@Test
func idleAnimationRotatesThroughStillVariants() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 500, height: 500)
    let windowSize = CGSize(width: 128, height: 139)
    let origin = CGPoint(x: 120, y: 140)
    var model = PetWanderModel()
    model.idleRotationRange = 4...4
    model.idleRotationRemaining = 0.1

    let first = model.tick(
        currentOrigin: origin,
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.2,
        randomUnit: { 0 }
    )
    let second = model.tick(
        currentOrigin: origin,
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 4.1,
        randomUnit: { 0 }
    )

    #expect(first.animationState == .idleBlink)
    #expect(model.currentIdleVariant == .lookAround)
    #expect(second.animationState == .idleLookAround)
}

@Test
func idleVariantsMapToMatchingBodyInteractions() {
    #expect(PetIdleVariant.calm.bodyInteractionState == .bodyTap)
    #expect(PetIdleVariant.blink.bodyInteractionState == .idleBlinkTap)
    #expect(PetIdleVariant.lookAround.bodyInteractionState == .idleLookAroundTap)
    #expect(PetIdleVariant.hairSway.bodyInteractionState == .idleHairSwayTap)
    #expect(PetIdleVariant.stretch.bodyInteractionState == .idleStretchTap)
}

@Test
func directedRunUsesLeftAndRightRunningFrames() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 600, height: 500)
    let windowSize = CGSize(width: 128, height: 139)

    var right = PetWanderModel()
    right.runToward(CGPoint(x: 420, y: 140))
    let rightTick = right.tick(
        currentOrigin: CGPoint(x: 120, y: 140),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    var left = PetWanderModel()
    left.runToward(CGPoint(x: 120, y: 140))
    let leftTick = left.tick(
        currentOrigin: CGPoint(x: 420, y: 140),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    #expect(rightTick.animationState == .runningRight)
    #expect(leftTick.animationState == .runningLeft)
}

@Test
func verticalDirectedRunUsesFrontRunningFrames() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 600, height: 500)
    let windowSize = CGSize(width: 128, height: 139)

    var model = PetWanderModel()
    model.runToward(CGPoint(x: 220, y: 380))
    let tick = model.tick(
        currentOrigin: CGPoint(x: 220, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    #expect(tick.animationState == .runningUp)
}

@Test
func diagonalDirectedRunUsesDiagonalRunningFrames() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 700, height: 600)
    let windowSize = CGSize(width: 128, height: 139)

    var upRight = PetWanderModel()
    upRight.runToward(CGPoint(x: 420, y: 420))
    let upRightTick = upRight.tick(
        currentOrigin: CGPoint(x: 120, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    var downLeft = PetWanderModel()
    downLeft.runToward(CGPoint(x: 120, y: 120))
    let downLeftTick = downLeft.tick(
        currentOrigin: CGPoint(x: 420, y: 420),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    #expect(upRightTick.animationState == .runningUpRight)
    #expect(downLeftTick.animationState == .runningDownLeft)
}

@Test
func mostlyVerticalDirectedRunUsesVerticalRunningFrames() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 700, height: 600)
    let windowSize = CGSize(width: 128, height: 139)

    var down = PetWanderModel()
    down.runToward(CGPoint(x: 232, y: 120))
    let downTick = down.tick(
        currentOrigin: CGPoint(x: 220, y: 420),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    var up = PetWanderModel()
    up.runToward(CGPoint(x: 232, y: 420))
    let upTick = up.tick(
        currentOrigin: CGPoint(x: 220, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    #expect(downTick.animationState == .runningDown)
    #expect(upTick.animationState == .runningUp)
}

@Test
func longRunCanPauseToCatchBreathBeforeContinuing() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 900, height: 700)
    let windowSize = CGSize(width: 128, height: 139)
    var model = PetWanderModel()
    model.runToward(CGPoint(x: 780, y: 120))

    let first = model.tick(
        currentOrigin: CGPoint(x: 120, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1.5
    )

    #expect(first.origin == CGPoint(x: 120, y: 120))
    #expect(first.animationState == .catchingBreath)
    #expect(model.target != nil)

    let second = model.tick(
        currentOrigin: first.origin,
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.1
    )

    #expect(second.animationState == .catchingBreath)
}

@Test
func longRunCatchingBreathRemembersDirectionBeforeFirstStep() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 900, height: 700)
    let windowSize = CGSize(width: 128, height: 139)
    var model = PetWanderModel()
    model.runToward(CGPoint(x: 120, y: 120))

    let tick = model.tick(
        currentOrigin: CGPoint(x: 780, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1.5
    )

    #expect(tick.animationState == .catchingBreath)
    #expect(model.lastRunningState == .runningLeft)
}

@Test
func arrivalPlaysCatchBreathInsteadOfImmediateIdle() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 600, height: 500)
    let windowSize = CGSize(width: 128, height: 139)
    var model = PetWanderModel()
    model.runToward(CGPoint(x: 140, y: 120))

    let tick = model.tick(
        currentOrigin: CGPoint(x: 120, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1
    )

    #expect(tick.origin == CGPoint(x: 140, y: 120))
    #expect(tick.animationState == .catchingBreath)
    #expect(model.target == nil)
}

@Test
func arrivalCatchBreathRemembersFinalRunDirection() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 600, height: 500)
    let windowSize = CGSize(width: 128, height: 139)
    var model = PetWanderModel()
    model.runToward(CGPoint(x: 120, y: 120))

    let tick = model.tick(
        currentOrigin: CGPoint(x: 140, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1
    )

    #expect(tick.animationState == .catchingBreath)
    #expect(model.lastRunningState == .runningLeft)
}

@Test
func arrivalSequenceContinuesThroughHandsOnHipsAndPeace() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 600, height: 500)
    let windowSize = CGSize(width: 128, height: 139)
    var model = PetWanderModel()
    model.runToward(CGPoint(x: 140, y: 120))

    _ = model.tick(
        currentOrigin: CGPoint(x: 120, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1
    )
    let hips = model.tick(
        currentOrigin: CGPoint(x: 140, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.9
    )
    let peace = model.tick(
        currentOrigin: CGPoint(x: 140, y: 120),
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 0.9
    )

    #expect(hips.animationState == .arriveHandsOnHips)
    #expect(peace.animationState == .arrivePeace)
}

@Test
func interactionInterruptsMovementTarget() {
    var model = PetWanderModel()
    model.runToward(CGPoint(x: 400, y: 120))

    model.interruptForInteraction()

    #expect(model.target == nil)
    #expect(model.pantRemaining == 0)
    #expect(model.waitRemaining == 0)
}

@Test
func desktopClickPolicyIgnoresApplicationWindowsAndAllowsDesktop() {
    let appWindow = DesktopWindowSnapshot(
        ownerName: "Safari",
        windowName: "Example",
        layer: 0,
        bounds: CGRect(x: 100, y: 100, width: 400, height: 300)
    )
    let finderDesktop = DesktopWindowSnapshot(
        ownerName: "Finder",
        windowName: "Desktop",
        layer: 0,
        bounds: CGRect(x: 0, y: 0, width: 1000, height: 800)
    )

    #expect(!DesktopClickPolicy.shouldHandleDesktopClick(
        at: CGPoint(x: 140, y: 140),
        windows: [finderDesktop, appWindow]
    ))
    #expect(DesktopClickPolicy.shouldHandleDesktopClick(
        at: CGPoint(x: 40, y: 40),
        windows: [finderDesktop, appWindow]
    ))
}

@Test
func desktopClickPolicyDoesNotTreatDockClicksAsDesktop() {
    let visibleFrame = CGRect(x: 0, y: 80, width: 1000, height: 720)
    let finderDesktop = DesktopWindowSnapshot(
        ownerName: "Finder",
        windowName: "Desktop",
        layer: 0,
        bounds: CGRect(x: 0, y: 0, width: 1000, height: 800)
    )
    let dock = DesktopWindowSnapshot(
        ownerName: "Dock",
        windowName: "Dock",
        layer: 0,
        bounds: CGRect(x: 0, y: 0, width: 1000, height: 80)
    )
    let elevatedDock = DesktopWindowSnapshot(
        ownerName: "Dock",
        windowName: "Dock",
        layer: 20,
        bounds: dock.bounds
    )

    #expect(!DesktopClickPolicy.shouldHandleDesktopClick(
        at: CGPoint(x: 500, y: 40),
        visibleFrame: visibleFrame,
        windows: [finderDesktop]
    ))
    #expect(!DesktopClickPolicy.shouldHandleDesktopClick(
        at: CGPoint(x: 500, y: 40),
        visibleFrame: visibleFrame,
        windows: [finderDesktop, dock]
    ))
    #expect(!DesktopClickPolicy.shouldHandleDesktopClick(
        at: CGPoint(x: 500, y: 40),
        visibleFrame: visibleFrame,
        windows: [finderDesktop, elevatedDock]
    ))
    #expect(DesktopClickPolicy.shouldHandleDesktopClick(
        at: CGPoint(x: 500, y: 120),
        visibleFrame: visibleFrame,
        windows: [finderDesktop]
    ))
}

@Test
func pauseAndDragPreventAutomaticMovement() {
    let visibleFrame = CGRect(x: 0, y: 0, width: 500, height: 500)
    let windowSize = CGSize(width: 128, height: 139)
    let origin = CGPoint(x: 120, y: 140)

    var paused = PetWanderModel(target: CGPoint(x: 400, y: 400), isPaused: true)
    let pausedTick = paused.tick(
        currentOrigin: origin,
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1,
        randomUnit: { 1 }
    )

    #expect(pausedTick.origin == origin)
    #expect(pausedTick.animationState == .idle)

    var dragging = PetWanderModel(target: CGPoint(x: 400, y: 400), isDragging: true)
    let draggingTick = dragging.tick(
        currentOrigin: origin,
        visibleFrame: visibleFrame,
        windowSize: windowSize,
        deltaTime: 1,
        randomUnit: { 1 }
    )

    #expect(draggingTick.origin == origin)
    #expect(draggingTick.animationState == .dragging)
}

private func makeTemporaryPetDirectory() throws -> URL {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaPetRunnerTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
}

private enum TestSpritesheetError: Error {
    case contextCreationFailed
    case imageCreationFailed
    case destinationCreationFailed
    case writeFailed
}

private func writeTestSpritesheet(at url: URL, dimensions: PetImageDimensions) throws {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: nil,
        width: dimensions.width,
        height: dimensions.height,
        bitsPerComponent: 8,
        bytesPerRow: dimensions.width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        throw TestSpritesheetError.contextCreationFailed
    }

    context.clear(CGRect(x: 0, y: 0, width: dimensions.width, height: dimensions.height))
    context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: 1, height: 1))

    guard let image = context.makeImage() else {
        throw TestSpritesheetError.imageCreationFailed
    }
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        throw TestSpritesheetError.destinationCreationFailed
    }

    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw TestSpritesheetError.writeFailed
    }
}

private func distance(_ first: CGPoint, _ second: CGPoint) -> CGFloat {
    hypot(first.x - second.x, first.y - second.y)
}
