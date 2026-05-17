import UIKit
import Capacitor
import Firebase
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. تهيئة Firebase
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // 2. إعداد Capacitor
        let proxy = ApplicationDelegateProxy.shared
        let result = proxy.application(application, didFinishLaunchingWithOptions: launchOptions)

        // 3. إعداد الإشعارات
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    // استدعاء المساعد الموجود بالأسفل
                    AgiosNotificationHelper.shared.refreshAllNotifications()
                }
            }
        }

        return result
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }
}

// MARK: - Notification Helper (دمج هنا لحل مشكلة الـ Build في CI)
@objc(AgiosNotificationHelper)
public class AgiosNotificationHelper: NSObject {
    @objc public static let shared = AgiosNotificationHelper()

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

    @objc public func refreshAllNotifications() {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let idsToRemove = requests.filter { $0.identifier.hasPrefix("agios_") }.map { $0.identifier }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: idsToRemove)

            let master = self.getPrefString(key: "masterNotifications") ?? "true"
            if master == "false" { return }

            self.schedule(type: "verse", defH: 6, title: "آية اليوم", body: "اكتشف آية اليوم وشاركها مع أصدقائك.")
            self.schedule(type: "question", defH: 18, title: "سؤال اليوم", body: "حان وقت سؤال اليوم، اختبر معلوماتك!")
            self.schedule(type: "studyPlans", defH: 10, title: "متابعة القراءة 📖", body: "لديك جزء متبقي في خطة القراءة اليومية.")
            self.schedule(type: "streak", defH: 21, title: "حافظ على حماسك", body: "لا تنسَ قراءة آية اليوم لتحافظ على سلسلة تفاعلك 🔥")
            self.schedule(type: "appSuggestions", defH: 12, title: "معلومة سريعة", body: self.tips.randomElement() ?? "اكتشف ميزات أجيوس.")
            self.schedule(type: "updateAlerts", defH: 12, title: "تحديث جديد", body: "تأكد من استخدام أحدث نسخة من أجيوس للمميزات الجديدة.")
        }
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
