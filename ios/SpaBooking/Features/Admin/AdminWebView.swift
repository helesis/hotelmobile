import SwiftUI
import WebKit

/// `admin.html` — sunucu ile aynı kök URL (`AppConfig.baseURL`).
struct AdminWebView: UIViewRepresentable {
    var baseURL: URL = AppConfig.baseURL

    func makeUIView(context: Context) -> WKWebView {
        let w = WKWebView(frame: .zero)
        w.isInspectable = true // Debug
        return w
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let admin = baseURL.appendingPathComponent("admin")
        webView.load(URLRequest(url: admin))
    }
}

struct AdminContainerView: View {
    var body: some View {
        NavigationStack {
            AdminWebView()
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle("Yönetim")
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    AdminContainerView()
}
