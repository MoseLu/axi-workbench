import CoreGraphics
import Foundation

struct PetImageDimensions: Equatable, Sendable {
    var width: Int
    var height: Int
}

struct PetAtlasSpec: Equatable, Sendable {
    static let assistantDefault = PetAtlasSpec(columns: 8, rows: 9, frameWidth: 192, frameHeight: 208)
    static let directional = PetAtlasSpec(columns: 8, rows: 15, frameWidth: 192, frameHeight: 208)
    static let fullInteraction = PetAtlasSpec(columns: 8, rows: 24, frameWidth: 192, frameHeight: 208)
    static let redraw = PetAtlasSpec(columns: 8, rows: 32, frameWidth: 192, frameHeight: 208)

    var columns: Int
    var rows: Int
    var frameWidth: Int
    var frameHeight: Int

    var expectedDimensions: PetImageDimensions {
        PetImageDimensions(width: columns * frameWidth, height: rows * frameHeight)
    }

    var supportsDirectionalRunning: Bool {
        rows >= Self.directional.rows
    }

    var supportsFullInteractions: Bool {
        rows >= Self.fullInteraction.rows
    }

    var supportsIdleVariants: Bool {
        rows >= Self.redraw.rows
    }

    static func detect(dimensions: PetImageDimensions) throws -> PetAtlasSpec {
        guard dimensions.width == assistantDefault.expectedDimensions.width,
              dimensions.height % assistantDefault.frameHeight == 0
        else {
            throw PetAtlasError.invalidSpritesheetSize(
                actual: dimensions,
                expected: assistantDefault.expectedDimensions
            )
        }

        let detectedRows = dimensions.height / assistantDefault.frameHeight
        guard detectedRows >= assistantDefault.rows else {
            throw PetAtlasError.invalidSpritesheetSize(
                actual: dimensions,
                expected: assistantDefault.expectedDimensions
            )
        }

        return PetAtlasSpec(
            columns: assistantDefault.columns,
            rows: detectedRows,
            frameWidth: assistantDefault.frameWidth,
            frameHeight: assistantDefault.frameHeight
        )
    }

    func validate(dimensions: PetImageDimensions) throws {
        let expected = expectedDimensions
        guard dimensions == expected else {
            throw PetAtlasError.invalidSpritesheetSize(
                actual: dimensions,
                expected: expected
            )
        }
    }

    func frameRect(row: Int, column: Int) throws -> CGRect {
        guard (0..<rows).contains(row), (0..<columns).contains(column) else {
            throw PetAtlasError.frameOutOfBounds(row: row, column: column)
        }

        return CGRect(
            x: column * frameWidth,
            y: row * frameHeight,
            width: frameWidth,
            height: frameHeight
        )
    }
}

enum PetAtlasError: LocalizedError, Equatable {
    case invalidSpritesheetSize(actual: PetImageDimensions, expected: PetImageDimensions)
    case frameOutOfBounds(row: Int, column: Int)

    var errorDescription: String? {
        switch self {
        case let .invalidSpritesheetSize(actual, expected):
            "Invalid spritesheet size \(actual.width)x\(actual.height); expected \(expected.width)x\(expected.height)."
        case let .frameOutOfBounds(row, column):
            "Atlas frame is out of bounds at row \(row), column \(column)."
        }
    }
}

enum PetAnimationState: String, CaseIterable, Sendable {
    case idle
    case idleBlink = "idle-blink"
    case idleLookAround = "idle-look-around"
    case idleHairSway = "idle-hair-sway"
    case idleStretch = "idle-stretch"
    case runningRight = "running-right"
    case runningLeft = "running-left"
    case runningVertical = "running"
    case runningUp = "running-up"
    case runningDown = "running-down"
    case runningUpRight = "running-up-right"
    case runningUpLeft = "running-up-left"
    case runningDownRight = "running-down-right"
    case runningDownLeft = "running-down-left"
    case catchingBreath = "catching-breath"
    case arriveHandsOnHips = "arrive-hands-on-hips"
    case arrivePeace = "arrive-peace"
    case dragging
    case headPat = "head-pat"
    case bodyTap = "body-tap"
    case leftTailTap = "left-tail-tap"
    case rightTailTap = "right-tail-tap"
    case feetTap = "feet-tap"
    case idleBlinkTap = "idle-blink-tap"
    case idleLookAroundTap = "idle-look-around-tap"
    case idleHairSwayTap = "idle-hair-sway-tap"
    case idleStretchTap = "idle-stretch-tap"
    case waving
    case jumping
}

enum PetIdleVariant: Int, CaseIterable, Sendable {
    case calm
    case blink
    case lookAround
    case hairSway
    case stretch

    var loopState: PetAnimationState {
        switch self {
        case .calm:
            return .idle
        case .blink:
            return .idleBlink
        case .lookAround:
            return .idleLookAround
        case .hairSway:
            return .idleHairSway
        case .stretch:
            return .idleStretch
        }
    }

    var bodyInteractionState: PetAnimationState {
        switch self {
        case .calm:
            return .bodyTap
        case .blink:
            return .idleBlinkTap
        case .lookAround:
            return .idleLookAroundTap
        case .hairSway:
            return .idleHairSwayTap
        case .stretch:
            return .idleStretchTap
        }
    }
}

struct PetAnimationSpec: Equatable, Sendable {
    var row: Int
    var frameCount: Int
    var framesPerSecond: Double
    var repeats: Bool
}

enum PetAnimationMap {
    static let assistantDefault: [PetAnimationState: PetAnimationSpec] = [
        .idle: PetAnimationSpec(row: 0, frameCount: 6, framesPerSecond: 6, repeats: true),
        .runningRight: PetAnimationSpec(row: 1, frameCount: 8, framesPerSecond: 10, repeats: true),
        .runningLeft: PetAnimationSpec(row: 2, frameCount: 8, framesPerSecond: 10, repeats: true),
        .runningVertical: PetAnimationSpec(row: 7, frameCount: 6, framesPerSecond: 10, repeats: true),
        .runningUp: PetAnimationSpec(row: 9, frameCount: 6, framesPerSecond: 10, repeats: true),
        .runningDown: PetAnimationSpec(row: 10, frameCount: 6, framesPerSecond: 10, repeats: true),
        .runningUpRight: PetAnimationSpec(row: 11, frameCount: 8, framesPerSecond: 10, repeats: true),
        .runningUpLeft: PetAnimationSpec(row: 12, frameCount: 8, framesPerSecond: 10, repeats: true),
        .runningDownRight: PetAnimationSpec(row: 13, frameCount: 8, framesPerSecond: 10, repeats: true),
        .runningDownLeft: PetAnimationSpec(row: 14, frameCount: 8, framesPerSecond: 10, repeats: true),
        .catchingBreath: PetAnimationSpec(row: 15, frameCount: 6, framesPerSecond: 7, repeats: true),
        .arriveHandsOnHips: PetAnimationSpec(row: 16, frameCount: 6, framesPerSecond: 7, repeats: false),
        .arrivePeace: PetAnimationSpec(row: 17, frameCount: 6, framesPerSecond: 7, repeats: false),
        .dragging: PetAnimationSpec(row: 18, frameCount: 5, framesPerSecond: 8, repeats: true),
        .headPat: PetAnimationSpec(row: 19, frameCount: 6, framesPerSecond: 7, repeats: false),
        .bodyTap: PetAnimationSpec(row: 20, frameCount: 4, framesPerSecond: 8, repeats: false),
        .leftTailTap: PetAnimationSpec(row: 21, frameCount: 6, framesPerSecond: 7, repeats: false),
        .rightTailTap: PetAnimationSpec(row: 22, frameCount: 6, framesPerSecond: 7, repeats: false),
        .feetTap: PetAnimationSpec(row: 23, frameCount: 5, framesPerSecond: 8, repeats: false),
        .idleBlink: PetAnimationSpec(row: 24, frameCount: 6, framesPerSecond: 5, repeats: true),
        .idleLookAround: PetAnimationSpec(row: 25, frameCount: 6, framesPerSecond: 5, repeats: true),
        .idleHairSway: PetAnimationSpec(row: 26, frameCount: 6, framesPerSecond: 6, repeats: true),
        .idleStretch: PetAnimationSpec(row: 27, frameCount: 8, framesPerSecond: 6, repeats: true),
        .idleBlinkTap: PetAnimationSpec(row: 28, frameCount: 5, framesPerSecond: 8, repeats: false),
        .idleLookAroundTap: PetAnimationSpec(row: 29, frameCount: 6, framesPerSecond: 7, repeats: false),
        .idleHairSwayTap: PetAnimationSpec(row: 30, frameCount: 6, framesPerSecond: 7, repeats: false),
        .idleStretchTap: PetAnimationSpec(row: 31, frameCount: 6, framesPerSecond: 7, repeats: false),
        .waving: PetAnimationSpec(row: 3, frameCount: 4, framesPerSecond: 8, repeats: false),
        .jumping: PetAnimationSpec(row: 4, frameCount: 5, framesPerSecond: 8, repeats: false),
    ]

    static func spec(
        for state: PetAnimationState,
        atlas: PetAtlasSpec = .assistantDefault,
        allowsDirectionalRunning: Bool = true
    ) -> PetAnimationSpec {
        if !allowsDirectionalRunning || !atlas.supportsDirectionalRunning {
            switch state {
            case .runningUp, .runningDown:
                return spec(for: .runningVertical, atlas: atlas, allowsDirectionalRunning: true)
            case .runningUpRight, .runningDownRight:
                return spec(for: .runningRight, atlas: atlas, allowsDirectionalRunning: true)
            case .runningUpLeft, .runningDownLeft:
                return spec(for: .runningLeft, atlas: atlas, allowsDirectionalRunning: true)
            default:
                break
            }
        }

        if !atlas.supportsFullInteractions {
            switch state {
            case .catchingBreath:
                return PetAnimationSpec(row: 6, frameCount: 6, framesPerSecond: 7, repeats: true)
            case .arriveHandsOnHips, .headPat:
                return spec(for: .idle, atlas: atlas, allowsDirectionalRunning: allowsDirectionalRunning)
            case .arrivePeace, .bodyTap, .leftTailTap, .rightTailTap:
                return spec(for: .waving, atlas: atlas, allowsDirectionalRunning: allowsDirectionalRunning)
            case .dragging, .feetTap:
                return spec(for: .jumping, atlas: atlas, allowsDirectionalRunning: allowsDirectionalRunning)
            default:
                break
            }
        }

        if !atlas.supportsIdleVariants {
            switch state {
            case .idleBlink, .idleLookAround, .idleHairSway, .idleStretch:
                return spec(for: .idle, atlas: atlas, allowsDirectionalRunning: allowsDirectionalRunning)
            case .idleBlinkTap, .idleLookAroundTap, .idleHairSwayTap, .idleStretchTap:
                return spec(for: .bodyTap, atlas: atlas, allowsDirectionalRunning: allowsDirectionalRunning)
            default:
                break
            }
        }

        guard let spec = assistantDefault[state] else {
            preconditionFailure("Missing animation spec for \(state.rawValue)")
        }
        return spec
    }
}
