import CoreGraphics
import Testing
@testable import OllamaMenuAssistant

@Test
func preservesRelativePositionInsideVisibleMessageAfterReflow() {
    let target = AppScrollPositionPreserver.targetOffsetPreservingRelativeAnchor(
        previousOffset: 680,
        previousFrame: CGRect(x: 0, y: 620, width: 700, height: 200),
        newFrame: CGRect(x: 0, y: 700, width: 560, height: 300)
    )

    #expect(target == 790)
}

@Test
func preservesVisibleAnchorWhenViewportStartsInsideMessage() {
    let target = AppScrollPositionPreserver.targetOffsetPreservingVisibleAnchor(
        previousOffset: 680,
        previousFrame: CGRect(x: 0, y: 620, width: 700, height: 200),
        newFrame: CGRect(x: 0, y: 700, width: 560, height: 300)
    )

    #expect(target == 760)
}

@Test
func preservesVisibleAnchorWhenMessageStartsBelowViewport() {
    let target = AppScrollPositionPreserver.targetOffsetPreservingVisibleAnchor(
        previousOffset: 680,
        previousFrame: CGRect(x: 0, y: 760, width: 700, height: 300),
        newFrame: CGRect(x: 0, y: 820, width: 560, height: 420)
    )

    #expect(target == 740)
}

@Test
func preservesAbsoluteVisibleAnchorInsteadOfScalingIntoTallerContent() {
    let target = AppScrollPositionPreserver.targetOffsetPreservingVisibleAnchor(
        previousOffset: 1_200,
        previousFrame: CGRect(x: 0, y: 800, width: 700, height: 600),
        newFrame: CGRect(x: 0, y: 820, width: 420, height: 1_200)
    )

    #expect(target == 1_220)
}

@Test
func clampsVisibleAnchorWhenContentShrinksPastPreviousDistance() {
    let target = AppScrollPositionPreserver.targetOffsetPreservingVisibleAnchor(
        previousOffset: 1_380,
        previousFrame: CGRect(x: 0, y: 800, width: 420, height: 1_200),
        newFrame: CGRect(x: 0, y: 760, width: 700, height: 300)
    )

    #expect(target == 1_059)
}

@Test
func preservesBottomDistanceWhenPreviousOffsetWasNearBottom() {
    let previous = AppScrollMetrics(offset: 900, viewportHeight: 500, contentHeight: 1_400)

    let target = AppScrollPositionPreserver.targetOffsetPreservingBottomDistance(
        previous: previous,
        newContentHeight: 1_700,
        newViewportHeight: 500,
        threshold: 96
    )

    #expect(target == 1_200)
}

@Test
func preservesSmallBottomDistanceAfterResize() {
    let previous = AppScrollMetrics(offset: 860, viewportHeight: 500, contentHeight: 1_400)

    let target = AppScrollPositionPreserver.targetOffsetPreservingBottomDistance(
        previous: previous,
        newContentHeight: 1_700,
        newViewportHeight: 500,
        threshold: 96
    )

    #expect(target == 1_160)
}

@Test
func keepsResizePinnedWhenNewMetricsAlreadyAppearAwayFromBottom() {
    let previous = AppScrollMetrics(offset: 900, viewportHeight: 500, contentHeight: 1_400)
    let current = AppScrollMetrics(offset: 900, viewportHeight: 500, contentHeight: 1_900)

    let bottomDistance = AppScrollPositionPreserver.bottomDistanceToPreserveDuringResize(
        previous: previous,
        current: current,
        threshold: 96
    )

    #expect(bottomDistance == 0)
}

@Test
func doesNotOverrideScrollWhenUserIsAwayFromBottom() {
    let previous = AppScrollMetrics(offset: 500, viewportHeight: 500, contentHeight: 1_400)

    let target = AppScrollPositionPreserver.targetOffsetPreservingBottomDistance(
        previous: previous,
        newContentHeight: 1_700,
        newViewportHeight: 500,
        threshold: 96
    )

    #expect(target == nil)
}
