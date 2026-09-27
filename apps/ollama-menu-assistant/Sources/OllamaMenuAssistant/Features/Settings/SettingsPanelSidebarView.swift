import SwiftUI

struct SettingsPanelSidebarView: View {
    let selectedSection: SettingsSection
    let language: AppLanguage
    let isTranslucent: Bool
    let topInset: CGFloat
    let onBack: () -> Void
    let onSelect: (SettingsSection) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SettingsPanelMetrics.sidebarBackListSpacing) {
            Button(action: onBack) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 12, weight: .medium))
                    Text(tr("返回应用", "Back to app"))
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(AppTheme.textSecondary)
                .padding(.leading, 6)
                .frame(width: SettingsPanelMetrics.sidebarContentWidth, alignment: .leading)
                .frame(height: SettingsPanelMetrics.sidebarRowHeight, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("settings.back")

            VStack(alignment: .leading, spacing: 3) {
                ForEach(SettingsSection.allCases) { section in
                    sidebarRow(section)
                }
            }
            .frame(width: SettingsPanelMetrics.sidebarContentWidth, alignment: .leading)
        }
        .padding(.horizontal, SettingsPanelMetrics.sidebarHorizontalPadding)
        .padding(.top, topInset)
        .frame(width: SettingsPanelMetrics.sidebarWidth, alignment: .topLeading)
        .frame(maxHeight: .infinity, alignment: .topLeading)
        .fixedSize(horizontal: true, vertical: false)
        .layoutPriority(2)
        .background {
            SidebarBackgroundView(isTranslucent: isTranslucent)
        }
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(AppTheme.border)
                .frame(width: 1)
        }
    }

    private func sidebarRow(_ section: SettingsSection) -> some View {
        let isSelected = selectedSection == section

        return Button {
            onSelect(section)
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: SettingsPanelMetrics.sidebarRowCornerRadius)
                    .fill(isSelected ? AppTheme.surfaceHover : AppTheme.transparent)
                    .overlay(
                        RoundedRectangle(cornerRadius: SettingsPanelMetrics.sidebarRowCornerRadius)
                            .stroke(isSelected ? AppTheme.borderStrong : AppTheme.transparent, lineWidth: 1)
                    )

                HStack(spacing: 10) {
                    Image(systemName: section.systemName)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(isSelected ? AppTheme.textPrimary : AppTheme.textSecondary)
                        .frame(width: 18)

                    Text(section.title(language: language))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(isSelected ? AppTheme.textPrimary : AppTheme.textSecondary)

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, SettingsPanelMetrics.sidebarRowHorizontalInset)
            }
            .frame(width: SettingsPanelMetrics.sidebarContentWidth, alignment: .leading)
            .frame(height: SettingsPanelMetrics.sidebarRowHeight, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: SettingsPanelMetrics.sidebarRowCornerRadius))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("settings.section.\(section.rawValue)")
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}
