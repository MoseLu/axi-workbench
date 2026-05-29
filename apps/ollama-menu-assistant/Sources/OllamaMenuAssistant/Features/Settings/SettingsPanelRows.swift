import SwiftUI

extension SettingsPanelView {
    func settingsGroup<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
            content()
        }
    }

    func settingsCard<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(spacing: 0) {
            content()
        }
        .appCard(cornerRadius: 12)
    }

    func workModeCard(
        id: String,
        title: String,
        subtitle: String,
        systemName: String,
        accent: Color
    ) -> some View {
        let isSelected = workMode == id

        return Button {
            workMode = id
        } label: {
            HStack(spacing: 14) {
                Image(systemName: systemName)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: 22, height: 22)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                        .allowsTightening(true)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                        .allowsTightening(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

                Spacer(minLength: 8)

                ZStack {
                    Circle()
                        .stroke(isSelected ? AppTheme.accent : AppTheme.borderStrong, lineWidth: 1.5)
                        .frame(width: 18, height: 18)
                    if isSelected {
                        Circle()
                            .fill(AppTheme.accent)
                            .frame(width: 8, height: 8)
                    }
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 64)
            .background(isSelected ? accent : AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? AppTheme.borderStrong : AppTheme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    func permissionRow(
        title: String,
        description: String,
        isOn: Binding<Bool>,
        action: (() -> Void)? = nil
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                Text(description)
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            Spacer(minLength: 18)

            settingsSwitch(isOn: isOn)
                .onChange(of: isOn.wrappedValue) { _, newValue in
                    if newValue {
                        action?()
                    }
                }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    func settingsActionRow(
        title: String,
        description: String,
        systemName: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                        .allowsTightening(true)
                    Text(description)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                        .allowsTightening(true)
                        .truncationMode(.tail)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

                Spacer(minLength: 18)

                Image(systemName: systemName)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: 30, height: 30)
                    .background(AppTheme.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    func settingsToggleRow(
        title: String,
        description: String,
        isOn: Binding<Bool>,
        linkText: String? = nil
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description, linkText: linkText)
            Spacer(minLength: 18)
            settingsSwitch(isOn: isOn)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    func settingsSwitch(isOn: Binding<Bool>) -> some View {
        Toggle("", isOn: isOn)
            .toggleStyle(.switch)
            .controlSize(.small)
            .labelsHidden()
            .scaleEffect(SettingsPanelMetrics.switchScale, anchor: .center)
            .frame(
                width: SettingsPanelMetrics.switchFrameWidth,
                height: SettingsPanelMetrics.switchFrameHeight,
                alignment: .center
            )
            .contentShape(Rectangle())
    }

    func settingsMenuRow(
        title: String,
        description: String,
        selection: Binding<String>,
        options: [String],
        leadingValue: String? = nil,
        trailingValue: String? = nil
    ) -> some View {
        HStack(alignment: .center, spacing: 14) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)

            if let leadingValue {
                Button(leadingValue) {}
                    .font(.system(size: 12, weight: .medium))
                    .buttonStyle(.plain)
                    .foregroundStyle(AppTheme.textTertiary)
            }

            if let trailingValue {
                Button(trailingValue) {
                    AppClipboard().copyText(themeExportText)
                }
                .font(.system(size: 12, weight: .medium))
                .buttonStyle(.plain)
                .foregroundStyle(AppTheme.textTertiary)
            }

            Menu {
                ForEach(options, id: \.self) { option in
                    Button {
                        selection.wrappedValue = option
                    } label: {
                        HStack {
                            Text(option)
                            if option == selection.wrappedValue {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Text(selection.wrappedValue)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)

                    Spacer(minLength: 8)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                }
                .padding(.horizontal, 12)
                .frame(width: 210, height: 30)
                .background(AppTheme.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .contentShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .fixedSize(horizontal: true, vertical: false)
            .accessibilityLabel(title)
            .accessibilityValue(selection.wrappedValue)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    func settingsSegmentedRow(
        title: String,
        description: String,
        selection: Binding<String>,
        options: [String]
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)
            settingSegmentedControl(selection: selection, options: options)
                .fixedSize(horizontal: true, vertical: false)
                .layoutPriority(2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    func settingSegmentedControl(selection: Binding<String>, options: [String]) -> some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                Button {
                    selection.wrappedValue = option
                } label: {
                    Text(option)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(selection.wrappedValue == option ? AppTheme.textPrimary : AppTheme.textTertiary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, 10)
                        .frame(minWidth: SettingsPanelMetrics.segmentedOptionMinWidth, minHeight: 26)
                        .background(selection.wrappedValue == option ? AppTheme.surfaceRaised : AppTheme.transparent)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    func settingsActionValueRow(
        title: String,
        description: String,
        systemName: String? = nil,
        value: String,
        buttonTitle: String?,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 14) {
                if let systemName {
                    Image(systemName: systemName)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(width: 38, height: 38)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                settingsRowText(title: title, description: description)
                Spacer(minLength: 18)

                if !value.isEmpty {
                    Text(value)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .layoutPriority(2)
                }

                if let buttonTitle {
                    Text(buttonTitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, 10)
                        .frame(height: 26)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(Capsule())
                        .layoutPriority(2)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    func settingsDisclosureRow(title: String, description: String) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)
            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }
}
