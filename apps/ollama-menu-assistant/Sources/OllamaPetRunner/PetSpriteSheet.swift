import AppKit
import Foundation

@MainActor
final class PetSpriteSheet {
    private struct FrameKey: Hashable {
        var row: Int
        var column: Int
    }

    private let image: CGImage
    private let atlas: PetAtlasSpec
    private var frameCache: [FrameKey: CGImage] = [:]

    init(image: CGImage, atlas: PetAtlasSpec = .assistantDefault) {
        self.image = image
        self.atlas = atlas
    }

    func frame(
        for state: PetAnimationState,
        index: Int,
        allowsDirectionalRunning: Bool = true
    ) -> CGImage? {
        let spec = PetAnimationMap.spec(
            for: state,
            atlas: atlas,
            allowsDirectionalRunning: allowsDirectionalRunning
        )
        let column = max(0, min(index, spec.frameCount - 1))
        return frame(row: spec.row, column: column)
    }

    func spec(for state: PetAnimationState, allowsDirectionalRunning: Bool = true) -> PetAnimationSpec {
        PetAnimationMap.spec(
            for: state,
            atlas: atlas,
            allowsDirectionalRunning: allowsDirectionalRunning
        )
    }

    private func frame(row: Int, column: Int) -> CGImage? {
        let key = FrameKey(row: row, column: column)
        if let cached = frameCache[key] {
            return cached
        }

        guard let rect = try? atlas.frameRect(row: row, column: column),
              let cropped = image.cropping(to: rect)
        else {
            return nil
        }

        frameCache[key] = cropped
        return cropped
    }
}
