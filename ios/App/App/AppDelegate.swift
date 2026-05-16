import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. إعداد Firebase
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // 2. إعداد مفوض التنبيهات
        UNUserNotificationCenter.current().delegate = self

        // 3. طلب الإذن
        requestNotificationPermission()

        // تسجيل التطبيق لاستقبال التنبيهات
        application.registerForRemoteNotifications()

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

    // --- ربط التنبيهات مع Firebase و Capacitor ---
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // ربط توكن Apple بـ Firebase Messaging
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                print("Error fetching FCM registration token: \(error)")
            } else if let token = token {
                print("FCM registration token: \(token)")
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // إظهار التنبيه أثناء تواجد المستخدم داخل التطبيق
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([[.banner, .sound, .list]])
    }

    // التعامل مع النقر على التنبيه
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        NotificationCenter.default.post(name: .capacitorDidReceiveNotification, object: response)
        completionHandler()
    }
}

// MARK: - Logic for Notifications (AgiosNotificationHelper)
class AgiosNotificationHelper {
    static let shared = AgiosNotificationHelper()

    private let tips = [
        "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
        "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
        "يمكنك تظليل الآيات باللون الذي يريحك وكتابة ملحوظات عليها",
        "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
        "هل تعلم أن بإمكانك قراءة الكتاب المقدس بدون إنترنت؟"
    ]

    private func getPref(_ key: String) -> String? {
        return UserDefaults.standard.string(forKey: "_cap_" + key) ?? UserDefaults.standard.string(forKey: key)
    }

    func updateSettings(json: String, masterEnabled: Bool) {
        UserDefaults.standard.set(json, forKey: "_cap_notificationSettings")
        UserDefaults.standard.set(String(masterEnabled), forKey: "_cap_masterNotifications")
        refreshAllNotifications()
    }

    func refreshAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()

        let master = getPref("masterNotifications") ?? "true"
        if master == "false" { return }

        schedule(type: "verse", defH: 6, title: "آية اليوم", body: "اكتشف آية اليوم وشاركها مع أصدقائك.")
        schedule(type: "question", defH: 18, title: "سؤال اليوم", body: "حان وقت سؤال اليوم، اختبر معلوماتك!")
        schedule(type: "studyPlans", defH: 10, title: "متابعة القراءة 📖", body: "لديك جزء متبقي في خطة القراءة اليومية.")
        schedule(type: "streak", defH: 21, title: "حافظ على حماسك", body: "لا تنسَ قراءة آية اليوم لتحافظ على سلسلة تفاعلك 🔥")
        schedule(type: "appSuggestions", defH: 12, title: "معلومة سريعة", body: tips.randomElement() ?? "اكتشف ميزات أجيوس.")
    }

    private func schedule(type: String, defH: Int, title: String, body: String) {
        var hour = defH
        var enabled = true

        let norm = normalize(type)

        if let jsonStr = getPref("notificationSettings"),
           let data = jsonStr.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {

            enabled = json[norm] as? Bool ?? true
            let timeKey = norm + "Time"
            if let timeStr = json[timeKey] as? String, timeStr.contains(":") {
                hour = Int(timeStr.components(separatedBy: ":")[0]) ?? defH
            }
        }

        if !enabled { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = 0

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: "agios_\(norm)", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
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
