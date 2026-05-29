import CoreGraphics

struct PetFormationLayout {
    let slotCount: Int
    let windowSize: CGSize
    let sideLength: CGFloat

    init(slotCount: Int, windowSize: CGSize, gap: CGFloat = 24) {
        self.slotCount = min(max(slotCount, 1), 3)
        self.windowSize = windowSize
        self.sideLength = max(windowSize.width, windowSize.height) + gap
    }

    func origin(for slotIndex: Int, around anchor: CGPoint, visibleFrame: CGRect) -> CGPoint {
        let offsets = formationOffsets
        let minOffsetX = offsets.map(\.x).min() ?? 0
        let maxOffsetX = offsets.map(\.x).max() ?? 0
        let minOffsetY = offsets.map(\.y).min() ?? 0
        let maxOffsetY = offsets.map(\.y).max() ?? 0

        let minAnchorX = visibleFrame.minX - minOffsetX
        let maxAnchorX = visibleFrame.maxX - windowSize.width - maxOffsetX
        let minAnchorY = visibleFrame.minY - minOffsetY
        let maxAnchorY = visibleFrame.maxY - windowSize.height - maxOffsetY

        var clampedAnchor = anchor
        if minAnchorX <= maxAnchorX {
            clampedAnchor.x = min(max(anchor.x, minAnchorX), maxAnchorX)
        }
        if minAnchorY <= maxAnchorY {
            clampedAnchor.y = min(max(anchor.y, minAnchorY), maxAnchorY)
        }

        let offset = self.offset(for: slotIndex)
        return PetWanderModel.clamped(
            origin: CGPoint(x: clampedAnchor.x + offset.x, y: clampedAnchor.y + offset.y),
            visibleFrame: visibleFrame,
            windowSize: windowSize
        )
    }

    func offset(for slotIndex: Int) -> CGPoint {
        let index = min(max(slotIndex, 0), formationOffsets.count - 1)
        return formationOffsets[index]
    }

    private var formationOffsets: [CGPoint] {
        [
            CGPoint(x: 0, y: triangleHeight * 2 / 3),
            CGPoint(x: -sideLength / 2, y: -triangleHeight / 3),
            CGPoint(x: sideLength / 2, y: -triangleHeight / 3),
        ]
    }

    private var triangleHeight: CGFloat {
        sideLength * CGFloat(3).squareRoot() / 2
    }
}
