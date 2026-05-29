import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func defaultAssistantWindowMinimumSizeFitsCompactQuarterTile() {
    let commonCompactQuarterTile = CGSize(width: 640, height: 340)

    #expect(
        AssistantPanelLayout.minimumWidth(
            isSidebarCollapsed: false,
            isChangesSidebarCollapsed: true
        ) <= commonCompactQuarterTile.width
    )
    #expect(AssistantPanelLayout.minimumWindowHeight <= commonCompactQuarterTile.height)
}

@Test
func responsiveMinimumWidthAllowsSidebarAutoCollapse() {
    #expect(AssistantPanelLayout.responsiveMinimumWindowWidth == AssistantPanelLayout.mainPanelMinimumWidth)
}

@Test
func responsiveLayoutCollapsesLeadingSidebarBelowExpandedMinimumWidth() {
    let state = AssistantPanelLayout.responsiveSidebarState(
        availableWidth: AssistantPanelLayout.minimumWindowWidth - 1,
        prefersSidebarCollapsed: false,
        prefersRightSidebarCollapsed: true
    )

    #expect(state.isSidebarCollapsed)
    #expect(state.isRightSidebarCollapsed)
}

@Test
func responsiveLayoutKeepsLeadingSidebarAtExpandedMinimumWidth() {
    let state = AssistantPanelLayout.responsiveSidebarState(
        availableWidth: AssistantPanelLayout.minimumWindowWidth,
        prefersSidebarCollapsed: false,
        prefersRightSidebarCollapsed: true
    )

    #expect(!state.isSidebarCollapsed)
    #expect(state.isRightSidebarCollapsed)
}

@Test
func responsiveLayoutCollapsesRightSidebarBeforeLeadingSidebar() {
    let state = AssistantPanelLayout.responsiveSidebarState(
        availableWidth: AssistantPanelLayout.minimumWindowWidth,
        prefersSidebarCollapsed: false,
        prefersRightSidebarCollapsed: false
    )

    #expect(!state.isSidebarCollapsed)
    #expect(state.isRightSidebarCollapsed)
}

@Test
func responsiveLayoutShowsBothSidebarsWhenMinimumSplitWidthFits() {
    let availableWidth = AssistantPanelLayout.expandedSidebarWidth
        + AssistantPanelLayout.sidebarDividerWidth
        + AssistantPanelLayout.rightSidebarMinimumContentWidth
    let state = AssistantPanelLayout.responsiveSidebarState(
        availableWidth: availableWidth,
        prefersSidebarCollapsed: false,
        prefersRightSidebarCollapsed: false
    )

    #expect(!state.isSidebarCollapsed)
    #expect(!state.isRightSidebarCollapsed)
}

@Test
func responsiveLayoutCanShowRightSidebarWhenLeadingSidebarIsUserCollapsed() {
    let state = AssistantPanelLayout.responsiveSidebarState(
        availableWidth: AssistantPanelLayout.rightSidebarMinimumContentWidth,
        prefersSidebarCollapsed: true,
        prefersRightSidebarCollapsed: false
    )

    #expect(state.isSidebarCollapsed)
    #expect(!state.isRightSidebarCollapsed)
}
