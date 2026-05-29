import SwiftUI

enum AssistantPanelLayout {
    struct ResponsiveSidebarState: Equatable {
        let isSidebarCollapsed: Bool
        let isRightSidebarCollapsed: Bool
    }

    static let expandedSidebarWidth: CGFloat = 284
    static let sidebarDividerWidth: CGFloat = 1
    static let sidebarFloatingPanelInset: CGFloat = 5
    static let sidebarFloatingPanelWidth = expandedSidebarWidth - (sidebarFloatingPanelInset * 2)
    static let sidebarMenuLeadingPadding: CGFloat = 18
    static let sidebarLibraryLeadingPadding: CGFloat = 12
    static let sidebarMenuSurfaceOffset = sidebarFloatingPanelInset - sidebarMenuLeadingPadding
    static let sidebarContentHorizontalPadding: CGFloat = DesignTokens.Spacing.sidebar
    static let sidebarRowHorizontalPadding: CGFloat = DesignTokens.Spacing.row
    static let sidebarIconColumnWidth: CGFloat = DesignTokens.IconFrame.sidebar
    static let sidebarIconTextSpacing: CGFloat = DesignTokens.Spacing.row
    static let sidebarTrailingActionWidth: CGFloat = 42
    static let changesSidebarWidth: CGFloat = 380
    static let changesSidebarDividerWidth: CGFloat = 1
    static let changesSidebarResizeHandleWidth: CGFloat = 8
    static let changesSidebarMinimumWidth: CGFloat = 280
    static let changesSidebarMaximumWidthRatio: CGFloat = 0.68
    static let conversationMinimumResizeWidth: CGFloat = 320
    static let terminalPanelHeight: CGFloat = 240
    static let mainPanelMinimumWidth: CGFloat = 340
    static let minimumWindowWidth = expandedSidebarWidth + sidebarDividerWidth + mainPanelMinimumWidth
    static let responsiveMinimumWindowWidth = mainPanelMinimumWidth
    static let rightSidebarMinimumContentWidth = conversationMinimumResizeWidth
        + changesSidebarResizeHandleWidth
        + changesSidebarMinimumWidth
    static let minimumWindowHeight: CGFloat = 320

    static func minimumWidth(isSidebarCollapsed: Bool, isChangesSidebarCollapsed: Bool = true) -> CGFloat {
        let leadingWidth = isSidebarCollapsed ? 0 : expandedSidebarWidth + sidebarDividerWidth
        let trailingWidth = isChangesSidebarCollapsed ? 0 : changesSidebarDividerWidth + changesSidebarWidth
        return leadingWidth + mainPanelMinimumWidth + trailingWidth
    }

    static func responsiveSidebarState(
        availableWidth: CGFloat,
        prefersSidebarCollapsed: Bool,
        prefersRightSidebarCollapsed: Bool
    ) -> ResponsiveSidebarState {
        let isSidebarCollapsed = prefersSidebarCollapsed || availableWidth < minimumWindowWidth
        let isSidebarAutoCollapsed = !prefersSidebarCollapsed && isSidebarCollapsed
        let leadingWidth = isSidebarCollapsed ? 0 : expandedSidebarWidth + sidebarDividerWidth
        let canShowRightSidebar = availableWidth >= leadingWidth + rightSidebarMinimumContentWidth
        let isRightSidebarCollapsed = prefersRightSidebarCollapsed
            || isSidebarAutoCollapsed
            || !canShowRightSidebar

        return ResponsiveSidebarState(
            isSidebarCollapsed: isSidebarCollapsed,
            isRightSidebarCollapsed: isRightSidebarCollapsed
        )
    }
}
