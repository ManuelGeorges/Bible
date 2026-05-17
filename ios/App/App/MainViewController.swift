import UIKit
import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .default
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // إعداد الـ Message Handler للتواصل بين الويب والـ Native
        self.bridge?.webView?.configuration.userContentController.add(self, name: "AgiosHandler")

        let isDark = self.traitCollection.userInterfaceStyle == .dark
        let theme = isDark ? "dark" : "light"

        let js = """
        window.AgiosScannerNative = {
            refreshAlarms: function() {
                window.webkit.messageHandlers.AgiosHandler.postMessage({action: 'refreshAlarms'});
            },
            updateSettings: function(json, masterEnabled) {
                window.webkit.messageHandlers.AgiosHandler.postMessage({
                    action: 'updateSettings',
                    json: json,
                    master: masterEnabled
                });
            },
            getSystemTheme: function() { return "\(theme)"; }
        };
        """
        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        self.bridge?.webView?.configuration.userContentController.addUserScript(script)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        if action == "refreshAlarms" {
            AgiosNotificationHelper.shared.refreshAllNotifications()
        } else if action == "updateSettings" {
            if let json = body["json"] as? String, let master = body["master"] as? Bool {
                AgiosNotificationHelper.shared.updateSettings(json: json, masterEnabled: master)
            }
        }
    }
}
