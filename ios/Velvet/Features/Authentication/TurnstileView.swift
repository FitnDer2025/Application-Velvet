import SwiftUI
import WebKit

struct TurnstileView: UIViewRepresentable {
    let siteKey: String
    @Binding var token: String?

    func makeCoordinator() -> Coordinator {
        Coordinator(token: $token)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "turnstile")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.websiteDataStore = .nonPersistent()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.siteKey = siteKey
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.accessibilityLabel = "Vérification humaine"
        loadChallenge(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.siteKey != siteKey {
            context.coordinator.siteKey = siteKey
            loadChallenge(in: webView)
        }
    }

    private func loadChallenge(in webView: WKWebView) {
        let safeKey = siteKey
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        let html = """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
          <style>
            html,body{margin:0;background:transparent;color-scheme:dark;overflow:hidden}
            #challenge{display:flex;justify-content:center;align-items:center;min-height:70px}
          </style>
        </head>
        <body>
          <div id="challenge"></div>
          <script>
            window.onload = function() {
              turnstile.render('#challenge', {
                sitekey: '\(safeKey)',
                action: 'login',
                theme: 'dark',
                callback: function(token) {
                  window.webkit.messageHandlers.turnstile.postMessage({token: token});
                },
                'expired-callback': function() {
                  window.webkit.messageHandlers.turnstile.postMessage({token: null});
                },
                'error-callback': function() {
                  window.webkit.messageHandlers.turnstile.postMessage({token: null});
                }
              });
            };
          </script>
        </body>
        </html>
        """

        let baseURL = URL(string: "https://velvet-beta.sh96hv64dj.workers.dev/")
        webView.loadHTMLString(html, baseURL: baseURL)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var token: Binding<String?>
        var siteKey = ""

        init(token: Binding<String?>) {
            self.token = token
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard
                let body = message.body as? [String: Any],
                let value = body["token"] as? String,
                !value.isEmpty
            else {
                token.wrappedValue = nil
                return
            }
            token.wrappedValue = value
        }
    }
}
