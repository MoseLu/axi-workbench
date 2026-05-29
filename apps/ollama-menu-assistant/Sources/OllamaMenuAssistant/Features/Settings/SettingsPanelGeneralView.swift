import SwiftUI

extension SettingsPanelView {
    var generalSettings: some View {
        VStack(alignment: .leading, spacing: 30) {
            settingsGroup(title: tr("工作模式", "Work mode")) {
                Text(tr("选择 Assistant 显示多少技术细节", "Choose how much technical detail Assistant shows"))
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textSecondary)

                HStack(spacing: 14) {
                    workModeCard(
                        id: "coding",
                        title: tr("适用于编程", "For coding"),
                        subtitle: tr("更具技术性的回复和控制", "More technical replies and control"),
                        systemName: "terminal",
                        accent: AppTheme.accentSoft
                    )
                    workModeCard(
                        id: "daily",
                        title: tr("适用于日常工作", "For everyday work"),
                        subtitle: tr("同样强大，技术细节更少", "Just as powerful, with fewer technical details"),
                        systemName: "bubble.left.and.bubble.right",
                        accent: AppTheme.surfaceHover
                    )
                }
            }

            settingsGroup(title: tr("权限", "Permissions")) {
                settingsCard {
                    settingsToggleRow(
                        title: tr("默认权限", "Default permissions"),
                        description: tr("默认情况下，Assistant 可以读取并编辑其工作区中的文件。必要时，它可以请求额外的访问权限", "By default, Assistant can read and edit files in its workspace. It can request extra access when needed."),
                        isOn: $defaultPermissionEnabled
                    )
                    divider
                    settingsToggleRow(
                        title: tr("自动审核", "Auto review"),
                        description: tr("Assistant 可以读取和编辑其工作区中的文件。Assistant 会自动审核额外访问权限请求。自动审核可能会出错。", "Assistant can read and edit files in its workspace. Extra access requests are reviewed automatically, which can be wrong."),
                        isOn: $autoReviewEnabled,
                        linkText: tr("了解更多", "Learn more")
                    )
                    divider
                    settingsToggleRow(
                        title: tr("完全访问权限", "Full access"),
                        description: tr("当 Assistant 以完全访问权限运行时，无需你批准，即可编辑你的电脑上的任何文件并运行联网命令。这会显著增加数据丢失、泄露或意外行为的风险。", "When Assistant runs with full access, it can edit any file on your computer and run network commands without approval. This increases the risk of data loss, leakage, or unexpected behavior."),
                        isOn: $fullAccessEnabled,
                        linkText: tr("了解更多", "Learn more")
                    )
                }
            }

            settingsGroup(title: tr("常规", "General")) {
                settingsCard {
                    settingsMenuRow(
                        title: tr("默认打开目标", "Default open target"),
                        description: tr("默认打开文件和文件夹的位置", "Where files and folders open by default"),
                        selection: defaultEditorSelection,
                        options: defaultEditorOptions
                    )
                    divider
                    settingsMenuRow(
                        title: tr("语言", "Language"),
                        description: tr("应用 UI 语言", "App UI language"),
                        selection: languageSelection,
                        options: languageOptions
                    )
                    divider
                    settingsToggleRow(
                        title: tr("在菜单栏中显示", "Show in menu bar"),
                        description: tr("关闭主窗口后，仍在 macOS 菜单栏中保留 Assistant", "Keep Assistant in the macOS menu bar after closing the main window"),
                        isOn: $showInMenuBar
                    )
                    divider
                    settingsActionValueRow(
                        title: tr("弹出窗口快捷键", "Popup window shortcut"),
                        description: tr("为弹出窗口设置全局快捷键。留空则保持关闭。", "Set a global shortcut for the popup window. Leave empty to keep it off."),
                        value: tr("禁用", "Disabled"),
                        buttonTitle: tr("设置", "Set"),
                        action: {}
                    )
                    divider
                    settingsToggleRow(
                        title: tr("运行时防止系统休眠", "Prevent sleep while running"),
                        description: tr("在 Assistant 运行对话时，让电脑保持唤醒状态", "Keep the computer awake while Assistant is running"),
                        isOn: $preventSystemSleep
                    )
                    divider
                    settingsToggleRow(
                        title: tr("需按 ⌘ + 回车键发送长文本提示", "Require ⌘ + Enter for long prompts"),
                        description: tr("启用后，长文本提示需按 ⌘ + 回车键发送。", "When enabled, long prompts require ⌘ + Enter to send."),
                        isOn: $enterToSend
                    )
                    divider
                    settingsMenuRow(
                        title: tr("速度", "Speed"),
                        description: tr("选择聊天、子智能体和上下文压缩中的推理速度。快速模式会增加套餐用量", "Choose reasoning speed for chats, subagents, and context compaction. Quick mode increases usage."),
                        selection: localizedSelection($speed, [("快速", "Quick"), ("标准", "Standard"), ("深度", "Deep")]),
                        options: localizedOptions([("快速", "Quick"), ("标准", "Standard"), ("深度", "Deep")])
                    )
                    divider
                    settingsSegmentedRow(
                        title: tr("跟进行为", "Follow-up behavior"),
                        description: tr("在 Assistant 运行时将后续操作加入队列，或引导当前运行。按 ⌘Enter 可对单条消息执行相反操作", "Queue follow-ups while Assistant is running, or guide the current run. Press ⌘Enter to invert for one message."),
                        selection: localizedSelection($followBehavior, [("排队", "Queue"), ("引导", "Guide")]),
                        options: localizedOptions([("排队", "Queue"), ("引导", "Guide")])
                    )
                    divider
                    settingsSegmentedRow(
                        title: tr("代码审查", "Code review"),
                        description: tr("尽可能在当前对话中启动 /review，或发起单独的审查对话", "Start /review in the current chat when possible, or start a separate review chat."),
                        selection: localizedSelection($codeReview, [("行内视图", "Inline view"), ("分离视图", "Separate view")]),
                        options: localizedOptions([("行内视图", "Inline view"), ("分离视图", "Separate view")])
                    )
                    divider
                    settingsToggleRow(
                        title: tr("建议提示", "Suggested prompts"),
                        description: tr("搜索项目文件和已连接应用，建议下一步操作", "Search project files and connected apps to suggest next steps"),
                        isOn: $suggestionsEnabled
                    )
                    divider
                    settingsActionValueRow(
                        title: tr("导入的代理设置", "Imported agent settings"),
                        description: tr("未检测到配置", "No configuration detected"),
                        systemName: "gearshape",
                        value: "",
                        buttonTitle: nil,
                        action: {}
                    )
                }
            }

            settingsGroup(title: tr("听写", "Dictation")) {
                settingsCard {
                    settingsActionValueRow(
                        title: tr("按住听写快捷键", "Hold-to-dictate shortcut"),
                        description: tr("在桌面任意位置按住，即可在光标处听写", "Hold anywhere on the desktop to dictate at the cursor"),
                        value: listenHotkeyEnabled ? tr("已启用", "Enabled") : tr("关闭", "Off"),
                        buttonTitle: tr("设置", "Set"),
                        action: { listenHotkeyEnabled.toggle() }
                    )
                    divider
                    settingsActionValueRow(
                        title: tr("切换听写快捷键", "Toggle dictation shortcut"),
                        description: tr("在桌面任意位置按一次开始听写，再按一次停止", "Press once anywhere on the desktop to start dictation, then press again to stop"),
                        value: toggleListenHotkeyEnabled ? tr("已启用", "Enabled") : tr("关闭", "Off"),
                        buttonTitle: tr("设置", "Set"),
                        action: { toggleListenHotkeyEnabled.toggle() }
                    )
                    divider
                    settingsDisclosureRow(
                        title: tr("听写词典", "Dictation dictionary"),
                        description: tr("听写应识别的单词或短语", "Words or phrases dictation should recognize")
                    )
                }
            }

            settingsGroup(title: tr("通知", "Notifications")) {
                settingsCard {
                    settingsMenuRow(
                        title: tr("轮次完成通知", "Turn completion notifications"),
                        description: tr("设置 Assistant 完成任务时的提醒", "Configure reminders when Assistant completes work"),
                        selection: localizedSelection($notificationTiming, [("关闭", "Off"), ("仅当应用失焦时", "Only when app is unfocused"), ("始终", "Always")]),
                        options: localizedOptions([("关闭", "Off"), ("仅当应用失焦时", "Only when app is unfocused"), ("始终", "Always")])
                    )
                    divider
                    settingsToggleRow(
                        title: tr("启用权限通知", "Enable permission notifications"),
                        description: tr("在需要通知权限时显示提醒", "Show reminders when notification permissions are needed"),
                        isOn: $permissionNotifications
                    )
                    divider
                    settingsToggleRow(
                        title: tr("启用问题通知", "Enable question notifications"),
                        description: tr("需要输入才能继续时显示提醒", "Show reminders when input is needed to continue"),
                        isOn: $questionNotifications
                    )
                }
            }
        }
    }

}
