import UIKit
import Capacitor
import Firebase
import FirebaseMessaging
import UserNotifications
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        UNUserNotificationCenter.current().delegate = self

        // تحديث التنبيهات عند تشغيل التطبيق لضمان دقة البيانات الديناميكية
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            AgiosNotificationHelper.shared.refreshAllNotifications()
        }

        return true
    }

    // MARK: - Push Notifications
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        NotificationCenter.default.post(name: .capacitorDidReceiveRemoteNotification, object: userInfo)
        completionHandler()
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        if let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge {
            bridge.eval(js: "window.dispatchEvent(new Event('visibilitychange'));")
        }
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

// MARK: - Bridge for JS to Native (AgiosScannerNative)
class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {
    override func viewDidLoad() {
        super.viewDidLoad()
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
                    action: 'updateSettings', json: json, master: masterEnabled
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

// MARK: - Dynamic Notifications Logic (Like Android)
class AgiosNotificationHelper {
    static let shared = AgiosNotificationHelper()

    func updateSettings(json: String, masterEnabled: Bool) {
        UserDefaults.standard.set(json, forKey: "_cap_notificationSettings")
        UserDefaults.standard.set(String(masterEnabled), forKey: "_cap_masterNotifications")
        refreshAllNotifications()
    }

    func refreshAllNotifications() {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            // مسح التنبيهات المجدولة سابقاً لـ agios لتجنب التكرار عند التحديث
            let idsToRemove = requests.filter { $0.identifier.hasPrefix("agios_") }.map { $0.identifier }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: idsToRemove)

            let master = self.getPrefString(key: "masterNotifications") ?? "true"
            if master == "false" { return }

            // جدولة الأيام الـ 7 القادمة لضمان تغيير المحتوى يومياً بنصوص ديناميكية
            for i in 0..<7 {
                self.scheduleVerse(offset: i)
                self.scheduleQuestion(offset: i)
                self.scheduleStreak(offset: i)
                self.scheduleStudyPlans(offset: i)
            }
            self.scheduleTip()
        }
    }

    private func scheduleVerse(offset: Int) {
        if let data = getTodayData(filename: "dailyVerses.json", daysOffset: offset) {
            let title = data["reference"] as? String ?? "آية اليوم"
            let body = data["verse"] as? String ?? (data["text"] as? String ?? "اكتشف آية اليوم")
            schedule(type: "verse", defH: 6, title: title, body: body, offset: offset)
        }
    }

    private func scheduleQuestion(offset: Int) {
        if let data = getTodayData(filename: "dailyQuestions.json", daysOffset: offset) {
            let question = data["question"] as? String ?? "حان وقت سؤال اليوم!"
            schedule(type: "question", defH: 18, title: "سؤال اليوم", body: question, offset: offset)
        }
    }

    private func scheduleStreak(offset: Int) {
        let streak = getPrefInt(key: "userStreak")
        let msg = streak > 0
            ? "أنت في سلسلة تفاعل مدتها \(toArabicNumbers(streak)) يوم! لا تنسَ قراءة آية اليوم لتحافظ عليها 🔥"
            : "ابدأ سلسلة تفاعلك اليوم! اقرأ آية اليوم وشاركها لتبني عادة روحية جديدة."
        schedule(type: "streak", defH: 21, title: "حافظ على حماسك", body: msg, offset: offset)
    }

    private func scheduleStudyPlans(offset: Int) {
        if let summaryJson = getPrefString(key: "studyPlansSummary"),
           let data = summaryJson.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {

            let count = json["count"] as? Int ?? 0
            let title = json["mainPlanTitle"] as? String ?? ""
            let remaining = json["remainingDays"] as? Int ?? 0

            let msg = count > 1
                ? "لديك \(toArabicNumbers(count)) خطط جارية. تبقّى \(toArabicNumbers(remaining)) يوم في \(title)"
                : "تبقّى لك \(toArabicNumbers(remaining)) يوم لإكمال \(title)"

            schedule(type: "studyPlans", defH: 10, title: "متابعة القراءة 📖", body: msg, offset: offset)
        }
    }

    private func scheduleTip() {
        let tips = [
            "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
            "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
            "يمكنك تظليل الآيات باللون الذي يريحك وكتابة ملحوظات عليها",
            "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
            "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط"
        ]
        schedule(type: "appSuggestions", defH: 12, title: "معلومة سريعة", body: tips.randomElement() ?? "اكتشف ميزات أجيوس.", offset: 0)
    }

    private func schedule(type: String, defH: Int, title: String, body: String, offset: Int) {
        var hour = defH
        var minute = 0
        var enabled = true

        if let jsonStr = getPrefString(key: "notificationSettings"),
           let data = jsonStr.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {

            let normType = normalize(type)
            enabled = json[normType] as? Bool ?? true
            if let timeStr = json[normType + "Time"] as? String, timeStr.contains(":") {
                let p = timeStr.components(separatedBy: ":")
                hour = Int(p[0]) ?? defH
                minute = Int(p[1]) ?? 0
            }
        }

        if !enabled { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Africa/Cairo")!

        let targetDate = calendar.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        var components = calendar.dateComponents([.year, .month, .day], from: targetDate)
        components.hour = hour
        components.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: "agios_\(type)_\(offset)", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    private func getTodayData(filename: String, daysOffset: Int) -> [String: Any]? {
        let possiblePaths = [
            Bundle.main.bundlePath + "/public/data/\(filename)",
            Bundle.main.bundlePath + "/data/\(filename)",
            Bundle.main.path(forResource: filename, ofType: nil) ?? ""
        ]

        for path in possiblePaths where !path.isEmpty {
            if let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
               let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {

                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = TimeZone(identifier: "Africa/Cairo")!
                let targetDate = calendar.date(byAdding: .day, value: daysOffset, to: Date()) ?? Date()
                let comp = calendar.dateComponents([.month, .day], from: targetDate)

                return array.first { ($0["month"] as? Int == comp.month) && ($0["day"] as? Int == comp.day) }
            }
        }
        return nil
    }

    private func getPrefString(key: String) -> String? {
        return UserDefaults.standard.string(forKey: "_cap_" + key) ?? UserDefaults.standard.string(forKey: key)
    }

    private func getPrefInt(key: String) -> Int {
        if let val = UserDefaults.standard.object(forKey: "_cap_" + key) as? Int { return val }
        if let s = getPrefString(key: key), let val = Int(s) { return val }
        return 0
    }

    private func toArabicNumbers(_ number: Int) -> String {
        let n = String(number)
        let arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
        var result = ""
        for char in n {
            if let digit = Int(String(char)) { result += arabicDigits[digit] }
            else { result += String(char) }
        }
        return result
    }

    private func normalize(_ type: String) -> String {
        let low = type.lowercased()
        if low.contains("verse") { return "verse" }
        if low.contains("question") { return "question" }
        if low.contains("streak") { return "streak" }
        if low.contains("study") || low.contains("plan") { return "studyPlans" }
        if low.contains("tip") || low.contains("suggestion") { return "appSuggestions" }
        return type
    }
}