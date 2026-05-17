import UIKit
import Capacitor
import FirebaseCore
import UserNotifications
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    // نحتفظ بمرجع للهاندلر لمنع حذفه من الذاكرة
    private let agiosHandler = AgiosScriptHandler()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // إعداد Firebase أولاً
        FirebaseApp.configure()

        // إعداد الإشعارات
        UNUserNotificationCenter.current().delegate = self
        requestNotificationPermission()
        
        // الطريقة الرسمية لـ Capacitor 7 للانتظار حتى جاهزية الـ Bridge
        NotificationCenter.default.addObserver(self, selector: #selector(handleBridgeReady(_:)), name: CAPBridge.setupNotification, object: nil)

        return ApplicationDelegateProxy.shared.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                    AgiosNotificationHelper.shared.refreshAllNotifications()
                }
            }
        }
    }

    @objc func handleBridgeReady(_ notification: Notification) {
        // الوصول الصحيح للـ Bridge في الإصدارات الحديثة
        guard let bridge = notification.object as? Bridge,
              let webView = bridge.webView else { return }
        
        self.setupNativeBridge(on: webView)
    }

    private func setupNativeBridge(on webView: WKWebView) {
        let contentController = webView.configuration.userContentController
        
        // تنظيف وحقن الهاندلر
        contentController.removeScriptMessageHandler(forName: "AgiosHandler")
        contentController.add(self.agiosHandler, name: "AgiosHandler")

        let isDark = UIScreen.main.traitCollection.userInterfaceStyle == .dark
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
        // حقن الكود ليكون متاحاً قبل تحميل الصفحة
        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        contentController.addUserScript(script)
        
        // تنفيذ فوري في حال كانت الصفحة محملة بالفعل
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        ApplicationDelegateProxy.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        ApplicationDelegateProxy.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // لإظهار الإشعارات والتطبيق مفتوح
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([[.banner, .sound, .list]])
    }
}

// MARK: - Script Handler
class AgiosScriptHandler: NSObject, WKScriptMessageHandler {
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

// MARK: - Notification Helper
class AgiosNotificationHelper {
    static let shared = AgiosNotificationHelper()
    
    private let tips = [
        "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
        "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
        "يمكنك تظليل الآيات باللون الذي يريحك وكتابة ملحوظات عليها",
        "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
        "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط"
    ]

    func updateSettings(json: String, masterEnabled: Bool) {
        UserDefaults.standard.set(json, forKey: "_cap_notificationSettings")
        UserDefaults.standard.set(String(masterEnabled), forKey: "_cap_masterNotifications")
        refreshAllNotifications()
    }

    func refreshAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        
        let master = UserDefaults.standard.string(forKey: "_cap_masterNotifications") ?? "true"
        if master == "false" { return }

        schedule(type: "verse", defH: 6, title: "آية اليوم", body: "اكتشف آية اليوم وشاركها مع أصدقائك.")
        schedule(type: "question", defH: 18, title: "سؤال اليوم", body: "حان وقت سؤال اليوم، اختبر معلوماتك!")
        schedule(type: "studyPlans", defH: 10, title: "متابعة القراءة 📖", body: "لديك جزء متبقي في خطة القراءة اليومية.")
        schedule(type: "appSuggestions", defH: 12, title: "معلومة سريعة", body: tips.randomElement() ?? "اكتشف ميزات أجيوس.")
    }

    private func schedule(type: String, defH: Int, title: String, body: String) {
        var hour = defH
        var minute = 0
        var enabled = true

        if let jsonStr = UserDefaults.standard.string(forKey: "_cap_notificationSettings"),
           let data = jsonStr.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            
            enabled = json[type] as? Bool ?? true
            if let timeStr = json[type + "Time"] as? String, timeStr.contains(":") {
                let p = timeStr.components(separatedBy: ":")
                if p.count == 2 {
                    hour = Int(p[0]) ?? defH
                    minute = Int(p[1]) ?? 0
                }
            }
        }

        if !enabled { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: "agios_\(type)", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }
}