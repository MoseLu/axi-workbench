import AppKit
import SceneKit

@MainActor
final class PetModelView: SCNView, PetDisplayView {
    var onLeftClick: ((CGPoint, CGPoint) -> Void)?
    var onDragBegan: (() -> Void)?
    var onDragMoved: ((CGPoint) -> Void)?
    var onDragEnded: (() -> Void)?
    var onRightClick: ((NSEvent) -> Void)?

    private let modelRoot = SCNNode()
    private let dragThreshold: CGFloat = 6
    private var loopState: PetAnimationState = .idle
    private var displayState: PetAnimationState = .idle
    private var returnStateAfterOneShot: PetAnimationState?
    private var animationTimer: Timer?
    private var animationElapsed: TimeInterval = 0
    private var dragOffset: CGPoint?
    private var mouseDownScreenPoint: CGPoint?
    private var didDrag = false
    private var movementFacingScaleX: CGFloat = 1

    override init(frame frameRect: NSRect, options: [String: Any]? = nil) {
        super.init(frame: frameRect, options: options)
        setupScene()
        setLoopingState(.idle)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupScene()
        setLoopingState(.idle)
    }

    override var acceptsFirstResponder: Bool {
        false
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    func loadModel(from url: URL) throws {
        let scene = try SCNScene(url: url, options: nil)
        modelRoot.childNodes.forEach { $0.removeFromParentNode() }

        let importedRoot = SCNNode()
        for node in scene.rootNode.childNodes {
            importedRoot.addChildNode(node.clone())
        }
        modelRoot.addChildNode(importedRoot)
        normalizeImportedModel(importedRoot)
    }

    func setLoopingState(_ state: PetAnimationState) {
        loopState = state
        guard returnStateAfterOneShot == nil else {
            return
        }
        if displayState != state {
            setDisplayState(state)
        }
    }

    func setMovementReferenceState(_ state: PetAnimationState) {
        let nextScaleX = movementFacingScaleX(for: state)
        guard movementFacingScaleX != nextScaleX else {
            return
        }
        movementFacingScaleX = nextScaleX
        updatePose()
    }

    func playOnce(_ state: PetAnimationState) {
        returnStateAfterOneShot = loopState
        setDisplayState(state)
    }

    override func mouseDown(with event: NSEvent) {
        guard let window else {
            onLeftClick?(.zero, NSEvent.mouseLocation)
            return
        }

        let mouse = NSEvent.mouseLocation
        dragOffset = CGPoint(x: mouse.x - window.frame.origin.x, y: mouse.y - window.frame.origin.y)
        mouseDownScreenPoint = mouse
        didDrag = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let dragOffset, let mouseDownScreenPoint else {
            return
        }

        let mouse = NSEvent.mouseLocation
        if !didDrag {
            let dragDistance = hypot(
                mouse.x - mouseDownScreenPoint.x,
                mouse.y - mouseDownScreenPoint.y
            )
            guard dragDistance >= dragThreshold else {
                return
            }
            didDrag = true
            onDragBegan?()
        }

        onDragMoved?(
            CGPoint(
                x: mouse.x - dragOffset.x,
                y: mouse.y - dragOffset.y
            )
        )
    }

    override func mouseUp(with event: NSEvent) {
        defer {
            dragOffset = nil
            mouseDownScreenPoint = nil
            didDrag = false
        }

        if didDrag {
            onDragEnded?()
        } else {
            onLeftClick?(convert(event.locationInWindow, from: nil), NSEvent.mouseLocation)
        }
    }

    override func rightMouseDown(with event: NSEvent) {
        onRightClick?(event)
    }

    private func setupScene() {
        let scene = SCNScene()
        scene.rootNode.addChildNode(modelRoot)
        self.scene = scene

        backgroundColor = .clear
        allowsCameraControl = false
        autoenablesDefaultLighting = false
        rendersContinuously = true

        let camera = SCNCamera()
        camera.usesOrthographicProjection = true
        camera.orthographicScale = 3.25
        let cameraNode = SCNNode()
        cameraNode.camera = camera
        cameraNode.position = SCNVector3(0, 0, 5)
        scene.rootNode.addChildNode(cameraNode)
        point(cameraNode, at: SCNVector3(0, 0, 1.35))
        pointOfView = cameraNode

        let key = SCNLight()
        key.type = .area
        key.intensity = 450
        let keyNode = SCNNode()
        keyNode.light = key
        keyNode.position = SCNVector3(-2.2, 3.0, 4.5)
        scene.rootNode.addChildNode(keyNode)

        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.intensity = 220
        let ambientNode = SCNNode()
        ambientNode.light = ambient
        scene.rootNode.addChildNode(ambientNode)
    }

    private func normalizeImportedModel(_ node: SCNNode) {
        let bounds = node.boundingBox
        let min = bounds.min
        let maxPoint = bounds.max
        let size = SCNVector3(maxPoint.x - min.x, maxPoint.y - min.y, maxPoint.z - min.z)
        let largest = max(size.x, max(size.y, size.z))
        if largest > 0 {
            let scale = CGFloat(2.35) / largest
            node.scale = SCNVector3(scale, scale, scale)
        }

        let center = SCNVector3(
            (min.x + maxPoint.x) / 2,
            (min.y + maxPoint.y) / 2,
            (min.z + maxPoint.z) / 2
        )
        node.position = SCNVector3(-center.x, -center.y, -center.z)
        modelRoot.position = SCNVector3(0, -0.05, 1.35)
        updatePose()
    }

    private func setDisplayState(_ state: PetAnimationState) {
        displayState = state
        animationElapsed = 0
        updatePose()
        restartAnimationTimer()
    }

    private func restartAnimationTimer() {
        animationTimer?.invalidate()
        let timer = Timer(timeInterval: 1 / 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.advanceAnimation()
            }
        }
        animationTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func advanceAnimation() {
        animationElapsed += 1 / 30
        let duration = animationDuration(for: displayState)
        if animationElapsed >= duration {
            if returnStateAfterOneShot != nil {
                let returnState = returnStateAfterOneShot ?? loopState
                returnStateAfterOneShot = nil
                setDisplayState(returnState)
                return
            }
            animationElapsed.formTruncatingRemainder(dividingBy: duration)
        }
        updatePose()
    }

    private func updatePose() {
        let duration = animationDuration(for: displayState)
        let progress = CGFloat(animationElapsed / max(duration, 0.001))
        let wave = sin(progress * .pi * 2)
        let runWave = sin(progress * .pi * 4)

        var scale = SCNVector3(movementFacingScaleX, 1, 1)
        var position = SCNVector3(0, -0.05, 1.35)
        var eulerAngles = SCNVector3Zero

        switch displayState {
        case .idle, .idleBlink, .idleLookAround, .idleHairSway, .idleStretch:
            position.y += max(0, wave) * 0.025
            scale.y = 1 + wave * 0.018
        case .runningRight, .runningUpRight, .runningDownRight:
            eulerAngles.z = wave * 0.055
            position.y += max(0, runWave) * 0.08
            scale.x = abs(scale.x)
        case .runningLeft, .runningUpLeft, .runningDownLeft:
            eulerAngles.z = wave * -0.055
            position.y += max(0, runWave) * 0.08
            scale.x = -abs(scale.x)
        case .runningVertical, .runningUp, .runningDown:
            position.y += max(0, runWave) * 0.08
            scale.x *= 1 + wave * 0.018
        case .catchingBreath:
            scale.x *= 1 + wave * 0.025
            scale.y = 1 - wave * 0.025
        case .arriveHandsOnHips, .arrivePeace, .waving:
            eulerAngles.z = wave * 0.06
            position.y += max(0, wave) * 0.04
        case .dragging:
            eulerAngles.z = wave * 0.12
            position.x += wave * 0.05
        case .jumping, .feetTap:
            position.y += max(0, sin(progress * .pi)) * 0.22
            scale.y = 1 - max(0, sin(progress * .pi)) * 0.035
        case .headPat, .bodyTap, .leftTailTap, .rightTailTap,
             .idleBlinkTap, .idleLookAroundTap, .idleHairSwayTap, .idleStretchTap:
            eulerAngles.z = sin(progress * .pi * 6) * 0.06
        }

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0
        modelRoot.position = position
        modelRoot.scale = scale
        modelRoot.eulerAngles = eulerAngles
        SCNTransaction.commit()
    }

    private func animationDuration(for state: PetAnimationState) -> TimeInterval {
        let spec = PetAnimationMap.spec(for: state)
        return max(0.35, TimeInterval(spec.frameCount) / spec.framesPerSecond)
    }

    private func movementFacingScaleX(for state: PetAnimationState) -> CGFloat {
        switch state {
        case .runningLeft, .runningUpLeft, .runningDownLeft:
            return -1
        case .runningRight, .runningUpRight, .runningDownRight, .runningVertical, .runningUp, .runningDown:
            return 1
        default:
            return movementFacingScaleX
        }
    }

    private func point(_ node: SCNNode, at target: SCNVector3) {
        let dx = target.x - node.position.x
        let dy = target.y - node.position.y
        let dz = target.z - node.position.z
        node.eulerAngles = SCNVector3(atan2(dy, sqrt(dx * dx + dz * dz)), atan2(dx, dz), 0)
    }
}
