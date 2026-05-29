import AppKit
import SwiftUI

struct SidebarBackgroundView: View {
    let isTranslucent: Bool

    var body: some View {
        Group {
            if isTranslucent {
                SidebarVisualEffectView()
            } else {
                AppTheme.sidebar
            }
        }
    }
}

private struct SidebarVisualEffectView: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        configure(view)
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        configure(nsView)
    }

    private func configure(_ view: NSVisualEffectView) {
        view.material = .sidebar
        view.blendingMode = .behindWindow
        view.state = .active
        view.isEmphasized = false
    }
}
