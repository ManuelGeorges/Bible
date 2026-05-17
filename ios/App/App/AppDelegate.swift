import UIKit
import Capacitor
import Firebase
import UserNotifications
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. إعداد Firebase
        FirebaseApp.configure()

        // 2. إعداد مفوض التنبيهات لتعمل حتى والتطبيق مفتوح
        UNUserNotificationCenter.current().delegate = self

        // 3. طلب الإذن وجدولة التنبيهات الابتدائية
        requestNotificationPermission()

        // في إصدارات Capacitor الحديثة، لا نحتاج لاستدعاء Proxy هنا.
        // يتم التعامل مع الـ Launch Options تلقائياً.
        return true
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    AgiosNotificationHelper.shared.refreshAllNotifications()
                }
            }
        }
    }

    // التعامل مع الروابط العميقة (مثل تسجيل دخول جوجل وآبل)
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // إظهار التنبيه حتى لو التطبيق مفتوح (محاكاة لسلوك أندرويد)
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }
}

// MARK: - JavaScript Bridge (ترجمة @JavascriptInterface من Java)
// نقوم بإنشاء متحكم مخصص لحقن كائن AgiosScannerNative ومعالجة رسائله
class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    // جعل الـ Status Bar يستجيب تلقائياً للثيم (أبيض في المظلم، أسود في الفاتح)
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .default
    }

    // تحديث الـ Status Bar عند تغيير الثيم من إعدادات النظام
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if #available(iOS 13.0, *) {
            if self.traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
                setNeedsStatusBarAppearanceUpdate()
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // تسجيل معالج الرسائل "AgiosHandler" لاستقبال البيانات من الويب
        self.bridge?.webView?.configuration.userContentController.add(self, name: "AgiosHandler")

        let isDark = self.traitCollection.userInterfaceStyle == .dark
        let theme = isDark ? "dark" : "light"

        // حقن الكود البرمجي لتعريف AgiosScannerNative داخل نافذة المتصفح عبر WKUserScript
        // لضمان توفره عند تحميل الصفحة (أفضل من didFinish)
        let js = """
        window.AgiosScannerNative = {
            scanFile: function(path) { console.log('iOS: scanFile called for ' + path); },
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

// MARK: - Notification Logic (ترجمة ملف AgiosNotificationReceiver.java)
class AgiosNotificationHelper {
    static let shared = AgiosNotificationHelper()

    private let tips = [
        "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
        "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
        "يمكنك تظليل الآيات باللون الذي يريحك وكتابة ملحوظات عليها",
        "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
        "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط",
        "يمكنك تغيير حجم خط القراءة لراحة عينيك.",
        "هل تعلم أن بإمكانك قراءة الكتاب المقدس بدون إنترنت؟"
    ]

    private func getPrefString(key: String) -> String? {
        return UserDefaults.standard.string(forKey: "_cap_" + key) ?? UserDefaults.standard.string(forKey: key)
    }

    func updateSettings(json: String, masterEnabled: Bool) {
        UserDefaults.standard.set(json, forKey: "_cap_notificationSettings")
        UserDefaults.standard.set(String(masterEnabled), forKey: "_cap_masterNotifications")
        refreshAllNotifications()
    }

    func refreshAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()

        let master = getPrefString(key: "masterNotifications") ?? "true"
        if master == "false" { return }

        schedule(type: "verse", defH: 6, title: "آية اليوم", body: "اكتشف آية اليوم وشاركها مع أصدقائك.")
        schedule(type: "question", defH: 18, title: "سؤال اليوم", body: "حان وقت سؤال اليوم، اختبر معلوماتك!")
        schedule(type: "studyPlans", defH: 10, title: "متابعة القراءة 📖", body: "لديك جزء متبقي في خطة القراءة اليومية.")
        schedule(type: "streak", defH: 21, title: "حافظ على حماسك", body: "لا تنسَ قراءة آية اليوم لتحافظ على سلسلة تفاعلك 🔥")
        schedule(type: "appSuggestions", defH: 12, title: "معلومة سريعة", body: tips.randomElement() ?? "اكتشف ميزات أجيوس.")
        schedule(type: "updateAlerts", defH: 12, title: "تحديث جديد", body: "تأكد من استخدام أحدث نسخة من أجيوس للمميزات الجديدة.")
    }

    private func schedule(type: String, defH: Int, title: String, body: String) {
        var hour = defH
        var minute = 0
        var enabled = true

        let norm = normalize(type)

        if let jsonStr = getPrefString(key: "notificationSettings"),
           let data = jsonStr.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {

            enabled = json[norm] as? Bool ?? true
            let timeKey = norm + "Time"
            if let timeStr = json[timeKey] as? String, timeStr.contains(":") {
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
        let request = UNNotificationRequest(identifier: "agios_\(norm)", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ Local Notification Error (\(norm)): \(error.localizedDescription)")
            } else {
                print("✅ Local Notification Scheduled (\(norm)) at \(hour):\(minute)")
            }
        }
    }

    private func normalize(_ type: String) -> String {
        let low = type.lowercased()
        if low.contains("verse") { return "verse" }
        if low.contains("question") { return "question" }
        if low.contains("streak") { return "streak" }
        if low.contains("study") || low.contains("plan") { return "studyPlans" }
        if low.contains("tip") || low.contains("suggestion") { return "appSuggestions" }
        if low.contains("update") { return "updateAlerts" }
        return type
    }
}
