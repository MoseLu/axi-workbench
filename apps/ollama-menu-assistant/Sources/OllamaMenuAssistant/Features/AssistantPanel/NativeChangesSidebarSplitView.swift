import AppKit
import SwiftUI

struct NativeChangesSidebarSplitView<Left: View, Right: View>: NSViewRepresentable {
    let availableWidth: CGFloat
    @Binding var rightWidthRatio: Double
    let leftMinimumWidth: CGFloat
    let rightMinimumWidth: CGFloat
    let rightDefaultWidth: CGFloat
    let rightMaximumWidthRatio: CGFloat
    let left: Left
    let right: Right

    init(
        availableWidth: CGFloat,
        rightWidthRatio: Binding<Double>,
        leftMinimumWidth: CGFloat,
        rightMinimumWidth: CGFloat,
        rightDefaultWidth: CGFloat,
        rightMaximumWidthRatio: CGFloat,
        @ViewBuilder left: () -> Left,
        @ViewBuilder right: () -> Right
    ) {
        self.availableWidth = availableWidth
        _rightWidthRatio = rightWidthRatio
        self.leftMinimumWidth = leftMinimumWidth
        self.rightMinimumWidth = rightMinimumWidth
        self.rightDefaultWidth = rightDefaultWidth
        self.rightMaximumWidthRatio = rightMaximumWidthRatio
        self.left = left()
        self.right = right()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(rightWidthRatio: $rightWidthRatio)
    }

    func makeNSView(context: Context) -> NativeChangesSidebarSplitNSView {
        let splitView = NativeChangesSidebarSplitNSView()
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.autoresizesSubviews = true
        splitView.delegate = context.coordinator
        splitView.translatesAutoresizingMaskIntoConstraints = true

        let leftHost = NSHostingView(rootView: left)
        let rightHost = NSHostingView(rootView: right)
        leftHost.translatesAutoresizingMaskIntoConstraints = false
        rightHost.translatesAutoresizingMaskIntoConstraints = false

        splitView.addArrangedSubview(leftHost)
        splitView.addArrangedSubview(rightHost)
        splitView.setHoldingPriority(.init(249), forSubviewAt: 0)
        splitView.setHoldingPriority(.init(251), forSubviewAt: 1)

        context.coordinator.leftHost = leftHost
        context.coordinator.rightHost = rightHost
        context.coordinator.configure(
            availableWidth: availableWidth,
            leftMinimumWidth: leftMinimumWidth,
            rightMinimumWidth: rightMinimumWidth,
            rightDefaultWidth: rightDefaultWidth,
            rightMaximumWidthRatio: rightMaximumWidthRatio
        )
        splitView.onDividerDragBegan = { [weak coordinator = context.coordinator] in
            coordinator?.beginDividerDrag()
        }
        splitView.onDividerDragEnded = { [weak coordinator = context.coordinator, weak splitView] in
            guard let splitView else {
                return
            }
            coordinator?.endDividerDrag(from: splitView)
        }

        return splitView
    }

    func updateNSView(_ splitView: NativeChangesSidebarSplitNSView, context: Context) {
        context.coordinator.leftHost?.rootView = left
        context.coordinator.rightHost?.rootView = right
        context.coordinator.configure(
            availableWidth: availableWidth,
            leftMinimumWidth: leftMinimumWidth,
            rightMinimumWidth: rightMinimumWidth,
            rightDefaultWidth: rightDefaultWidth,
            rightMaximumWidthRatio: rightMaximumWidthRatio
        )
        context.coordinator.applyPreferredRightWidth(to: splitView)
    }

    @MainActor
    final class Coordinator: NSObject, @preconcurrency NSSplitViewDelegate {
        var leftHost: NSHostingView<Left>?
        var rightHost: NSHostingView<Right>?
        private var rightWidthRatio: Binding<Double>
        private var availableWidth: CGFloat = 0
        private var leftMinimumWidth: CGFloat = 0
        private var rightMinimumWidth: CGFloat = 0
        private var rightDefaultWidth: CGFloat = 0
        private var rightMaximumWidthRatio: CGFloat = 1
        private var isDividerDragging = false
        private var isApplyingPreferredWidth = false
        private var hasAppliedPreferredWidth = false
        private var lastAppliedTotalWidth: CGFloat = 0
        private var liveRightWidthRatio: Double?

        init(rightWidthRatio: Binding<Double>) {
            self.rightWidthRatio = rightWidthRatio
        }

        func configure(
            availableWidth: CGFloat,
            leftMinimumWidth: CGFloat,
            rightMinimumWidth: CGFloat,
            rightDefaultWidth: CGFloat,
            rightMaximumWidthRatio: CGFloat
        ) {
            self.availableWidth = availableWidth
            self.leftMinimumWidth = leftMinimumWidth
            self.rightMinimumWidth = rightMinimumWidth
            self.rightDefaultWidth = rightDefaultWidth
            self.rightMaximumWidthRatio = rightMaximumWidthRatio
        }

        func beginDividerDrag() {
            isDividerDragging = true
        }

        func endDividerDrag(from splitView: NSSplitView) {
            commitCurrentRightWidth(from: splitView)
            isDividerDragging = false
        }

        func applyPreferredRightWidth(to splitView: NSSplitView) {
            guard !isDividerDragging,
                  splitView.arrangedSubviews.count == 2 else {
                return
            }

            let totalWidth = splitView.bounds.width > 0 ? splitView.bounds.width : availableWidth
            guard totalWidth > 0 else {
                return
            }

            let dividerWidth = splitView.dividerThickness
            let usableWidth = max(1, totalWidth - dividerWidth)
            let ratio = preferredRatio(in: usableWidth)
            let widthChanged = abs(lastAppliedTotalWidth - totalWidth) > 0.5

            guard !hasAppliedPreferredWidth || widthChanged else {
                return
            }

            let rightWidth = clampedRightWidth(usableWidth * ratio, usableWidth: usableWidth)
            let currentRightWidth = splitView.arrangedSubviews[1].frame.width
            guard !hasAppliedPreferredWidth || abs(currentRightWidth - rightWidth) > 0.5 else {
                liveRightWidthRatio = Double(ratio)
                lastAppliedTotalWidth = totalWidth
                return
            }

            let dividerPosition = max(0, totalWidth - dividerWidth - rightWidth)

            isApplyingPreferredWidth = true
            splitView.setPosition(dividerPosition, ofDividerAt: 0)
            isApplyingPreferredWidth = false
            hasAppliedPreferredWidth = true
            liveRightWidthRatio = Double(rightWidth / usableWidth)
            lastAppliedTotalWidth = totalWidth
        }

        func commitCurrentRightWidth(from splitView: NSSplitView) {
            guard let ratio = updateLiveRightWidth(from: splitView) else {
                return
            }
            if abs(rightWidthRatio.wrappedValue - ratio) > 0.0005 {
                rightWidthRatio.wrappedValue = ratio
            }
            hasAppliedPreferredWidth = true
        }

        func splitViewDidResizeSubviews(_ notification: Notification) {
            guard !isApplyingPreferredWidth,
                  hasAppliedPreferredWidth,
                  let splitView = notification.object as? NSSplitView else {
                return
            }
            _ = updateLiveRightWidth(from: splitView)
        }

        func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
            let totalWidth = splitView.bounds.width
            let dividerWidth = splitView.dividerThickness
            let usableWidth = max(1, totalWidth - dividerWidth)
            let maxRightWidth = rightMaximumWidth(in: usableWidth)
            return max(leftMinimumWidth, totalWidth - dividerWidth - maxRightWidth)
        }

        func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
            let totalWidth = splitView.bounds.width
            let dividerWidth = splitView.dividerThickness
            let usableWidth = max(1, totalWidth - dividerWidth)
            return totalWidth - dividerWidth - min(rightMinimumWidth, usableWidth)
        }

        func splitView(_ splitView: NSSplitView, shouldCollapseSubview subview: NSView, forDoubleClickOnDividerAt dividerIndex: Int) -> Bool {
            false
        }

        func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool {
            false
        }

        private func preferredRatio(in usableWidth: CGFloat) -> CGFloat {
            if let liveRightWidthRatio {
                return CGFloat(liveRightWidthRatio)
            }
            if rightWidthRatio.wrappedValue > 0 {
                return CGFloat(rightWidthRatio.wrappedValue)
            }
            return rightDefaultWidth / usableWidth
        }

        private func rightMaximumWidth(in usableWidth: CGFloat) -> CGFloat {
            let maximumByConversation = max(0, usableWidth - leftMinimumWidth)
            let maximumByRatio = usableWidth * rightMaximumWidthRatio
            let unconstrainedMaximum = max(rightMinimumWidth, min(maximumByConversation, maximumByRatio))
            return min(usableWidth, unconstrainedMaximum)
        }

        private func clampedRightWidth(_ width: CGFloat, usableWidth: CGFloat) -> CGFloat {
            let minimumWidth = min(rightMinimumWidth, usableWidth)
            let maximumWidth = rightMaximumWidth(in: usableWidth)
            return min(max(width, minimumWidth), maximumWidth)
        }

        private func updateLiveRightWidth(from splitView: NSSplitView) -> Double? {
            guard splitView.arrangedSubviews.count == 2 else {
                return nil
            }

            let dividerWidth = splitView.dividerThickness
            let totalWidth = splitView.bounds.width
            let usableWidth = max(1, totalWidth - dividerWidth)
            let rightWidth = clampedRightWidth(splitView.arrangedSubviews[1].frame.width, usableWidth: usableWidth)
            let ratio = Double(rightWidth / usableWidth)
            liveRightWidthRatio = ratio
            lastAppliedTotalWidth = totalWidth
            return ratio
        }
    }
}

final class NativeChangesSidebarSplitNSView: NSSplitView {
    var onDividerDragBegan: (() -> Void)?
    var onDividerDragEnded: (() -> Void)?

    override var dividerThickness: CGFloat {
        AssistantPanelLayout.changesSidebarResizeHandleWidth
    }

    override func drawDivider(in rect: NSRect) {
        NSColor.clear.setFill()
        rect.fill()

        let scale = window?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 2
        let lineWidth = 1 / max(1, scale)
        let lineRect = NSRect(
            x: rect.midX - lineWidth / 2,
            y: rect.minY,
            width: lineWidth,
            height: rect.height
        )
        NSColor.separatorColor.withAlphaComponent(0.65).setFill()
        lineRect.fill()
    }

    override func mouseDown(with event: NSEvent) {
        onDividerDragBegan?()
        super.mouseDown(with: event)
        onDividerDragEnded?()
    }
}
