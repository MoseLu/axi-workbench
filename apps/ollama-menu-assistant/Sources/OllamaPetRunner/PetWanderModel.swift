import CoreGraphics
import Foundation

struct PetWanderTick: Equatable {
    var origin: CGPoint
    var animationState: PetAnimationState
}

struct PetWanderModel: Equatable {
    var speed: CGFloat = 90
    var pauseRange: ClosedRange<TimeInterval> = 1.5...5
    var currentSpeed: CGFloat = 90
    var target: CGPoint?
    var waitRemaining: TimeInterval = 0
    var hopRemaining: TimeInterval = 0
    var hopCooldown: TimeInterval = 0
    var pantRemaining: TimeInterval = 0
    var pantCooldown: TimeInterval = 0
    var arrivalRemaining: TimeInterval = 0
    var isPaused = false
    var isDragging = false
    var lastRunningState: PetAnimationState = .runningRight
    var idleVariantIndex = 0
    var idleRotationRange: ClosedRange<TimeInterval> = 4...9
    var idleRotationRemaining: TimeInterval = 3

    var currentIdleVariant: PetIdleVariant {
        let variants = Array(PetIdleVariant.allCases)
        return variants[idleVariantIndex % variants.count]
    }

    mutating func tick(
        currentOrigin: CGPoint,
        visibleFrame: CGRect,
        windowSize: CGSize,
        deltaTime: TimeInterval,
        randomUnit: () -> CGFloat = { CGFloat.random(in: 0...1) }
    ) -> PetWanderTick {
        let currentOrigin = Self.clamped(
            origin: currentOrigin,
            visibleFrame: visibleFrame,
            windowSize: windowSize
        )

        if isDragging {
            return PetWanderTick(origin: currentOrigin, animationState: .dragging)
        }

        if isPaused {
            return PetWanderTick(
                origin: currentOrigin,
                animationState: nextIdleAnimationState(deltaTime: deltaTime, randomUnit: randomUnit)
            )
        }

        if waitRemaining > 0 {
            waitRemaining = max(0, waitRemaining - deltaTime)
            return PetWanderTick(
                origin: currentOrigin,
                animationState: nextIdleAnimationState(deltaTime: deltaTime, randomUnit: randomUnit)
            )
        }

        if arrivalRemaining > 0 {
            arrivalRemaining = max(0, arrivalRemaining - deltaTime)
            if arrivalRemaining > 1.6 {
                return PetWanderTick(origin: currentOrigin, animationState: .catchingBreath)
            }
            if arrivalRemaining > 0.8 {
                return PetWanderTick(origin: currentOrigin, animationState: .arriveHandsOnHips)
            }
            return PetWanderTick(origin: currentOrigin, animationState: .arrivePeace)
        }

        if pantRemaining > 0 {
            pantRemaining = max(0, pantRemaining - deltaTime)
            return PetWanderTick(origin: currentOrigin, animationState: .catchingBreath)
        }

        guard let target else {
            return PetWanderTick(
                origin: currentOrigin,
                animationState: nextIdleAnimationState(deltaTime: deltaTime, randomUnit: randomUnit)
            )
        }

        let deltaX = target.x - currentOrigin.x
        let deltaY = target.y - currentOrigin.y
        let distance = hypot(deltaX, deltaY)
        let maxStep = max(0, CGFloat(deltaTime) * currentSpeed)

        guard distance > 0.5, maxStep > 0 else {
            self.target = nil
            waitRemaining = 0
            return PetWanderTick(
                origin: currentOrigin,
                animationState: nextIdleAnimationState(deltaTime: deltaTime, randomUnit: randomUnit)
            )
        }

        let movementState = nextMovementAnimationState(deltaX: deltaX, deltaY: deltaY)

        if distance <= maxStep {
            self.target = nil
            waitRemaining = 0
            arrivalRemaining = 2.4
            pantRemaining = 0
            pantCooldown = 0
            return PetWanderTick(origin: target, animationState: .catchingBreath)
        }

        pantCooldown = max(0, pantCooldown - deltaTime)
        if pantCooldown <= 0, distance > 180 {
            pantRemaining = 0.42
            pantCooldown = 2.4
            return PetWanderTick(origin: currentOrigin, animationState: .catchingBreath)
        }

        let fraction = maxStep / distance
        let nextOrigin = CGPoint(
            x: currentOrigin.x + deltaX * fraction,
            y: currentOrigin.y + deltaY * fraction
        )

        return PetWanderTick(
            origin: Self.clamped(origin: nextOrigin, visibleFrame: visibleFrame, windowSize: windowSize),
            animationState: movementState
        )
    }

    mutating func setPaused(_ paused: Bool) {
        isPaused = paused
        if paused {
            target = nil
        }
    }

    mutating func runToward(_ origin: CGPoint, speed: CGFloat = 150) {
        target = origin
        currentSpeed = speed
        waitRemaining = 0
        hopRemaining = 0
        hopCooldown = 0.15
        pantRemaining = 0
        pantCooldown = 1.4
        arrivalRemaining = 0
    }

    mutating func interruptForInteraction() {
        target = nil
        waitRemaining = 0
        hopRemaining = 0
        hopCooldown = 0
        pantRemaining = 0
        pantCooldown = 0
        arrivalRemaining = 0
    }

    mutating func beginDragging() {
        isDragging = true
        target = nil
        waitRemaining = 0
        hopRemaining = 0
        hopCooldown = 0
        pantRemaining = 0
        pantCooldown = 0
        arrivalRemaining = 0
    }

    mutating func endDragging(resumeDelay: TimeInterval = 1) {
        isDragging = false
        waitRemaining = max(0, resumeDelay)
    }

    static func randomTarget(
        visibleFrame: CGRect,
        windowSize: CGSize,
        randomUnit: () -> CGFloat = { CGFloat.random(in: 0...1) }
    ) -> CGPoint {
        let minX = visibleFrame.minX
        let maxX = max(minX, visibleFrame.maxX - windowSize.width)
        let minY = visibleFrame.minY
        let maxY = max(minY, visibleFrame.maxY - windowSize.height)

        return CGPoint(
            x: minX + (maxX - minX) * clampUnit(randomUnit()),
            y: minY + (maxY - minY) * clampUnit(randomUnit())
        )
    }

    static func clamped(origin: CGPoint, visibleFrame: CGRect, windowSize: CGSize) -> CGPoint {
        let minX = visibleFrame.minX
        let maxX = max(minX, visibleFrame.maxX - windowSize.width)
        let minY = visibleFrame.minY
        let maxY = max(minY, visibleFrame.maxY - windowSize.height)

        return CGPoint(
            x: min(max(origin.x, minX), maxX),
            y: min(max(origin.y, minY), maxY)
        )
    }

    static func comeHereOrigin(visibleFrame: CGRect, windowSize: CGSize, margin: CGFloat = 32) -> CGPoint {
        clamped(
            origin: CGPoint(
                x: visibleFrame.maxX - windowSize.width - margin,
                y: visibleFrame.minY + margin
            ),
            visibleFrame: visibleFrame,
            windowSize: windowSize
        )
    }

    static func comeHereOrigin(
        near point: CGPoint,
        visibleFrame: CGRect,
        windowSize: CGSize,
        margin: CGFloat = 72
    ) -> CGPoint {
        let safeFrame = insetFrameForPet(visibleFrame, margin: margin, windowSize: windowSize)
        let preferred = CGPoint(
            x: point.x - windowSize.width / 2,
            y: point.y - windowSize.height - 28
        )
        return clamped(origin: preferred, visibleFrame: safeFrame, windowSize: windowSize)
    }

    static func clickTargetOrigin(
        for point: CGPoint,
        visibleFrame: CGRect,
        windowSize: CGSize
    ) -> CGPoint {
        clamped(
            origin: CGPoint(
                x: point.x - windowSize.width / 2,
                y: point.y - 16
            ),
            visibleFrame: visibleFrame,
            windowSize: windowSize
        )
    }

    static func randomWaitDuration(
        in range: ClosedRange<TimeInterval>,
        randomUnit: () -> CGFloat = { CGFloat.random(in: 0...1) }
    ) -> TimeInterval {
        range.lowerBound + TimeInterval(clampUnit(randomUnit())) * (range.upperBound - range.lowerBound)
    }

    static func randomSpeed(
        in range: ClosedRange<CGFloat>,
        fallback: CGFloat,
        randomUnit: () -> CGFloat = { CGFloat.random(in: 0...1) }
    ) -> CGFloat {
        guard range.lowerBound <= range.upperBound else {
            return fallback
        }
        return range.lowerBound + (range.upperBound - range.lowerBound) * clampUnit(randomUnit())
    }

    private mutating func nextMovementAnimationState(deltaX: CGFloat, deltaY: CGFloat) -> PetAnimationState {
        let absX = abs(deltaX)
        let absY = abs(deltaY)
        let horizontalThreshold: CGFloat = 12
        let verticalThreshold: CGFloat = 18
        let axisDominanceRatio: CGFloat = 2

        if absY >= verticalThreshold,
           absX < horizontalThreshold || absY >= absX * axisDominanceRatio
        {
            lastRunningState = deltaY >= 0 ? .runningUp : .runningDown
            return lastRunningState
        }

        if absX >= horizontalThreshold,
           absY < verticalThreshold || absX >= absY * axisDominanceRatio
        {
            lastRunningState = deltaX >= 0 ? .runningRight : .runningLeft
            return lastRunningState
        }

        if absY < verticalThreshold {
            if deltaX > 3 {
                lastRunningState = .runningRight
            } else if deltaX < -3 {
                lastRunningState = .runningLeft
            }
            return lastRunningState
        }

        switch (deltaX >= 0, deltaY >= 0) {
        case (true, true):
            lastRunningState = .runningUpRight
            return .runningUpRight
        case (false, true):
            lastRunningState = .runningUpLeft
            return .runningUpLeft
        case (true, false):
            lastRunningState = .runningDownRight
            return .runningDownRight
        case (false, false):
            lastRunningState = .runningDownLeft
            return .runningDownLeft
        }
    }

    private mutating func nextIdleAnimationState(
        deltaTime: TimeInterval,
        randomUnit: () -> CGFloat
    ) -> PetAnimationState {
        let variants = Array(PetIdleVariant.allCases)
        idleRotationRemaining -= max(0, deltaTime)

        if idleRotationRemaining <= 0 {
            idleVariantIndex = (idleVariantIndex + 1) % variants.count
            idleRotationRemaining = Self.randomWaitDuration(
                in: idleRotationRange,
                randomUnit: randomUnit
            )
        }

        return variants[idleVariantIndex % variants.count].loopState
    }

    private static func insetFrameForPet(_ frame: CGRect, margin: CGFloat, windowSize: CGSize) -> CGRect {
        let inset = frame.insetBy(dx: margin, dy: margin)
        guard inset.width >= windowSize.width, inset.height >= windowSize.height else {
            return frame
        }
        return inset
    }

    private static func clampUnit(_ value: CGFloat) -> CGFloat {
        min(max(value, 0), 1)
    }
}
