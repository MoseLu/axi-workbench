import AppKit
import SwiftUI

extension SettingsPanelView {
    func settingsValueRow(title: String, value: String) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
            Spacer(minLength: 18)
            Text(value)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func colorRow(
        title: String,
        hex: Binding<String>,
        fallback: AppTheme.ColorFallbackToken
    ) -> some View {
        let color = themeColor(hex.wrappedValue, fallback: fallback)

        return HStack(alignment: .center, spacing: 16) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
            Spacer(minLength: 18)

            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppTheme.colorChipBorder, lineWidth: 1)
                    )

                HStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(themeChipTextColor(hex: hex.wrappedValue, fallback: fallback).opacity(0.12))
                            .overlay(
                                Circle()
                                    .stroke(themeChipTextColor(hex: hex.wrappedValue, fallback: fallback).opacity(0.45), lineWidth: 1)
                            )

                        ColorPicker("", selection: colorPickerBinding(hex: hex, fallback: fallback), supportsOpacity: false)
                            .labelsHidden()
                            .frame(width: 18, height: 18)
                            .opacity(0.015)
                            .accessibilityLabel(title)
                    }
                    .frame(width: 14, height: 14)

                    TextField("", text: hexTextBinding(hex: hex, fallback: fallback))
                        .textFieldStyle(.plain)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(themeChipTextColor(hex: hex.wrappedValue, fallback: fallback))
                        .lineLimit(1)
                        .frame(width: 74, alignment: .leading)
                        .onSubmit {
                            hex.wrappedValue = normalizedHex(hex.wrappedValue, fallback: fallback)
                        }
                }
            }
            .frame(width: 136, height: 28)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func colorPickerBinding(hex: Binding<String>, fallback: AppTheme.ColorFallbackToken) -> Binding<Color> {
        Binding(
            get: {
                themeColor(hex.wrappedValue, fallback: fallback)
            },
            set: { newColor in
                hex.wrappedValue = hexString(from: newColor, fallback: fallback)
            }
        )
    }

    func hexTextBinding(hex: Binding<String>, fallback: AppTheme.ColorFallbackToken) -> Binding<String> {
        Binding(
            get: {
                hex.wrappedValue
            },
            set: { newValue in
                hex.wrappedValue = sanitizedHexInput(newValue, fallback: fallback)
            }
        )
    }

    func settingsSliderRow(
        title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
            Spacer(minLength: 18)
            Slider(value: value, in: range)
                .frame(width: 160)
            Text("\(Int(value.wrappedValue))")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .frame(width: 34, alignment: .trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func settingsStepperRow(
        title: String,
        description: String,
        value: Binding<Double>,
        range: ClosedRange<Double>
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)
            Stepper(value: value, in: range, step: 1) {
                HStack(spacing: 6) {
                    Text("\(Int(value.wrappedValue))")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .frame(width: 26)
                    Text("px")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                }
            }
            .fixedSize()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func settingsRowText(
        title: String,
        description: String,
        linkText: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                .allowsTightening(true)
            if !description.isEmpty || linkText != nil {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    if !description.isEmpty {
                        Text(description)
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                            .allowsTightening(true)
                            .truncationMode(.tail)
                            .layoutPriority(1)
                    }
                    if let linkText {
                        Text(linkText)
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.accent)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                            .layoutPriority(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .layoutPriority(1)
    }

    var divider: some View {
        Divider()
            .overlay(AppTheme.border)
    }

    var appearanceMode: AppearanceMode {
        get { AppearanceMode(storedValue: appearanceModeRaw) }
        nonmutating set { appearanceModeRaw = newValue.rawValue }
    }

    var appLanguage: AppLanguage {
        AppLanguage.resolved(from: language)
    }

    var settingsPanelTopInset: CGFloat {
        max(settingsPanelChromeHeight - 2, chromeMetrics.titleBarHeight + 2)
    }

    var settingsPanelChromeHeight: CGFloat {
        max(40, min(44, chromeMetrics.titleBarHeight + 4))
    }

    var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    var languageSelection: Binding<String> {
        Binding(
            get: { AppLanguageOption(storedValue: language).title(language: appLanguage) },
            set: { newValue in
                let option = AppLanguageOption.allCases.first { $0.title(language: appLanguage) == newValue } ?? AppLanguageOption(storedValue: newValue)
                language = option.storageValue
            }
        )
    }

    var languageOptions: [String] {
        AppLanguageOption.allCases.map { $0.title(language: appLanguage) }
    }

    var defaultEditorOptions: [String] {
        DefaultEditorTarget.allCases.map { $0.title(language: appLanguage) }
    }

    var defaultEditorSelection: Binding<String> {
        Binding(
            get: {
                DefaultEditorTarget(storedValue: defaultOpenTarget).title(language: appLanguage)
            },
            set: { newValue in
                if let target = DefaultEditorTarget.allCases.first(where: { $0.title(language: appLanguage) == newValue }) {
                    defaultOpenTarget = target.rawValue
                } else {
                    defaultOpenTarget = DefaultEditorTarget(storedValue: newValue).rawValue
                }
            }
        )
    }

    func localizedOptions(_ pairs: [(String, String)]) -> [String] {
        pairs.map { tr($0.0, $0.1) }
    }

    func localizedSelection(_ storage: Binding<String>, _ pairs: [(String, String)]) -> Binding<String> {
        Binding(
            get: {
                if let pair = pairs.first(where: { storage.wrappedValue == $0.0 || storage.wrappedValue == $0.1 }) {
                    return tr(pair.0, pair.1)
                }
                return storage.wrappedValue
            },
            set: { newValue in
                if let pair = pairs.first(where: { newValue == tr($0.0, $0.1) || newValue == $0.0 || newValue == $0.1 }) {
                    storage.wrappedValue = pair.0
                } else {
                    storage.wrappedValue = newValue
                }
            }
        )
    }
}
