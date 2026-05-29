import AppKit
import QuartzCore

@MainActor
protocol PetDisplayView: AnyObject {
    var onLeftClick: ((CGPoint, CGPoint) -> Void)? { get set }
    var onDragBegan: (() -> Void)? { get set }
    var onDragMoved: ((CGPoint) -> Void)? { get set }
    var onDragEnded: (() -> Void)? { get set }
    var onRightClick: ((NSEvent) -> Void)? { get set }

    func setLoopingState(_ state: PetAnimationState)
    func setMovementReferenceState(_ state: PetAnimationState)
    func playOnce(_ state: PetAnimationState)
}

@MainActor
final class PetSpriteView: NSView, PetDisplayView {
    var spriteSheet: PetSpriteSheet? {
        didSet {
            frameIndex = 0
            updateDisplayedFrame()
        }
    }
    var allowsDirectionalRunning = true {
        didSet {
            guard allowsDirectionalRunning != oldValue else {
                return
            }
            frameIndex = 0
            updateDisplayedFrame()
        }
    }

    var onLeftClick: ((CGPoint, CGPoint) -> Void)?
    var onDragBegan: (() -> Void)?
    var onDragMoved: ((CGPoint) -> Void)?
    var onDragEnded: (() -> Void)?
    var onRightClick: ((NSEvent) -> Void)?

    private let imageLayer = CALayer()
    private let dragThreshold: CGFloat = 6
    private var loopState: PetAnimationState = .idle
    private var displayState: PetAnimationState = .idle
    private var returnStateAfterOneShot: PetAnimationState?
    private var frameIndex = 0
    private var animationTimer: Timer?
    private var dragOffset: CGPoint?
    private var mouseDownScreenPoint: CGPoint?
    private var didDrag = false
    private var movementFacingScaleX: CGFloat = 1

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupLayer()
        setLoopingState(.idle)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLayer()
        setLoopingState(.idle)
    }

    override var acceptsFirstResponder: Bool {
        false
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
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
        if usesMovementFacingTransform(displayState) {
            updateDisplayedFrame()
        }
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

    private func setupLayer() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        layer?.masksToBounds = false

        imageLayer.contentsGravity = .resizeAspect
        imageLayer.contentsScale = NSScreen.main?.backingScaleFactor ?? 2
        imageLayer.magnificationFilter = .nearest
        imageLayer.minificationFilter = .nearest
        imageLayer.anchorPoint = CGPoint(x: 0.5, y: 0.18)
        layer?.addSublayer(imageLayer)
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.bounds = bounds
        imageLayer.position = CGPoint(
            x: bounds.midX,
            y: bounds.minY + bounds.height * imageLayer.anchorPoint.y
        )
        CATransaction.commit()
    }

    private func setDisplayState(_ state: PetAnimationState) {
        displayState = state
        frameIndex = 0
        updateDisplayedFrame()
        restartAnimationTimer()
    }

    private func restartAnimationTimer() {
        animationTimer?.invalidate()
        let spec = animationSpec(for: displayState)
        let timer = Timer(timeInterval: 1 / spec.framesPerSecond, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.advanceAnimationFrame()
            }
        }
        animationTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func advanceAnimationFrame() {
        let spec = animationSpec(for: displayState)
        let nextFrame = frameIndex + 1

        if nextFrame >= spec.frameCount {
            if spec.repeats {
                frameIndex = 0
            } else {
                let returnState = returnStateAfterOneShot ?? loopState
                returnStateAfterOneShot = nil
                setDisplayState(returnState)
                return
            }
        } else {
            frameIndex = nextFrame
        }

        updateDisplayedFrame()
    }

    private func updateDisplayedFrame() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.contents = spriteSheet?.frame(
            for: displayState,
            index: frameIndex,
            allowsDirectionalRunning: allowsDirectionalRunning
        )
        imageLayer.transform = poseTransform()
        CATransaction.commit()
    }

    private func poseTransform() -> CATransform3D {
        let spec = animationSpec(for: displayState)
        let progress = CGFloat(frameIndex) / CGFloat(max(spec.frameCount, 1))
        let wave = sin(progress * .pi * 2)

        switch displayState {
        case .idle:
            let scaleY = 1 + wave * 0.012
            return CATransform3DScale(CATransform3DIdentity, 1, scaleY, 1)
        case .idleBlink:
            let scaleY = 1 + wave * 0.008
            let settle = max(0, -wave) * 0.6
            var transform = CATransform3DMakeTranslation(0, settle, 0)
            transform = CATransform3DScale(transform, 1, scaleY, 1)
            return transform
        case .idleLookAround:
            let glance = sin(progress * .pi * 2) * 1.6
            return CATransform3DMakeTranslation(glance, 0, 0)
        case .idleHairSway:
            let sway = sin(progress * .pi * 2)
            var transform = CATransform3DMakeTranslation(sway * 1.2, 0, 0)
            transform = CATransform3DRotate(transform, sway * 0.018, 0, 0, 1)
            return transform
        case .idleStretch:
            let stretch = max(0, sin(progress * .pi * 2))
            var transform = CATransform3DMakeTranslation(0, stretch * 2, 0)
            transform = CATransform3DScale(transform, 1 - stretch * 0.018, 1 + stretch * 0.035, 1)
            return transform
        case .runningRight, .runningLeft, .runningUpRight, .runningUpLeft, .runningDownRight, .runningDownLeft:
            let direction: CGFloat = switch displayState {
            case .runningLeft, .runningUpLeft, .runningDownLeft:
                -1
            default:
                1
            }
            let lift = max(0, sin(progress * .pi * 4)) * 3
            let tilt = direction * sin(progress * .pi * 2) * 0.045
            var transform = CATransform3DMakeTranslation(0, lift, 0)
            transform = CATransform3DRotate(transform, tilt, 0, 0, 1)
            return transform
        case .runningVertical, .runningUp, .runningDown:
            let lift = max(0, sin(progress * .pi * 4)) * 3
            let scaleX = 1 + sin(progress * .pi * 2) * 0.012
            let scaleY = 1 - sin(progress * .pi * 2) * 0.012
            var transform = CATransform3DMakeTranslation(0, lift, 0)
            transform = CATransform3DScale(transform, scaleX, scaleY, 1)
            return transform
        case .catchingBreath:
            let breath = sin(progress * .pi * 2)
            var transform = CATransform3DMakeTranslation(0, -1 + max(0, breath) * 2, 0)
            transform = CATransform3DScale(transform, 1 + breath * 0.018, 1 - breath * 0.018, 1)
            transform = CATransform3DRotate(transform, -0.025 + breath * 0.018, 0, 0, 1)
            return movementFacingTransform(transform)
        case .arriveHandsOnHips:
            let settle = sin(progress * .pi * 2) * 0.012
            var transform = CATransform3DMakeTranslation(0, -1, 0)
            transform = CATransform3DScale(transform, 1 + settle, 1 - settle, 1)
            return movementFacingTransform(transform)
        case .arrivePeace:
            let bounce = max(0, sin(progress * .pi * 2)) * 3
            let tilt = sin(progress * .pi * 2) * 0.035
            var transform = CATransform3DMakeTranslation(0, bounce, 0)
            transform = CATransform3DRotate(transform, tilt, 0, 0, 1)
            return movementFacingTransform(transform)
        case .dragging:
            let swing = sin(progress * .pi * 2)
            var transform = CATransform3DMakeTranslation(swing * 1.5, max(0, swing) * 2, 0)
            transform = CATransform3DRotate(transform, swing * 0.06, 0, 0, 1)
            return transform
        case .headPat, .bodyTap, .leftTailTap, .rightTailTap:
            let wiggle = sin(progress * .pi * 4)
            return CATransform3DRotate(CATransform3DIdentity, wiggle * 0.025, 0, 0, 1)
        case .feetTap:
            let lift = max(0, sin(progress * .pi * 2)) * 7
            return CATransform3DMakeTranslation(0, lift, 0)
        case .idleBlinkTap:
            let pop = max(0, sin(progress * .pi)) * 0.045
            var transform = CATransform3DMakeTranslation(0, pop * 24, 0)
            transform = CATransform3DScale(transform, 1 + pop, 1 + pop, 1)
            return transform
        case .idleLookAroundTap:
            let shake = sin(progress * .pi * 6) * 2.5
            return CATransform3DMakeTranslation(shake, 0, 0)
        case .idleHairSwayTap:
            let swing = sin(progress * .pi * 4)
            var transform = CATransform3DMakeTranslation(swing * 2, 0, 0)
            transform = CATransform3DRotate(transform, swing * 0.04, 0, 0, 1)
            return transform
        case .idleStretchTap:
            let compress = max(0, sin(progress * .pi)) * 0.055
            var transform = CATransform3DMakeTranslation(0, -compress * 20, 0)
            transform = CATransform3DScale(transform, 1 + compress, 1 - compress, 1)
            return transform
        case .waving:
            let tilt = sin(progress * .pi * 2) * 0.035
            return CATransform3DRotate(CATransform3DIdentity, tilt, 0, 0, 1)
        case .jumping:
            let lift = sin(progress * .pi) * 9
            let scaleY = 1 - sin(progress * .pi) * 0.035
            var transform = CATransform3DMakeTranslation(0, lift, 0)
            transform = CATransform3DScale(transform, 1.025, scaleY, 1)
            return transform
        }
    }

    private func animationSpec(for state: PetAnimationState) -> PetAnimationSpec {
        spriteSheet?.spec(for: state, allowsDirectionalRunning: allowsDirectionalRunning)
            ?? PetAnimationMap.spec(for: state, allowsDirectionalRunning: allowsDirectionalRunning)
    }

    private func movementFacingTransform(_ transform: CATransform3D) -> CATransform3D {
        guard movementFacingScaleX < 0 else {
            return transform
        }

        return CATransform3DScale(transform, movementFacingScaleX, 1, 1)
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

    private func usesMovementFacingTransform(_ state: PetAnimationState) -> Bool {
        switch state {
        case .catchingBreath, .arriveHandsOnHips, .arrivePeace:
            return true
        default:
            return false
        }
    }
}
