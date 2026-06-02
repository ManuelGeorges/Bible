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

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }

        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo

        if let deepLink = userInfo["deepLink"] as? String {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                if let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge {
                    bridge.eval(js: "window.__agiosDeepLink = '\(deepLink)'; window.dispatchEvent(new CustomEvent('agiosDeepLink', { detail: { path: '\(deepLink)' } }));")
                }
            }
        }

        NotificationCenter.default.post(name: .capacitorDidReceiveRemoteNotification, object: userInfo)
        completionHandler()
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
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

class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override var preferredStatusBarStyle: UIStatusBarStyle {
        if #available(iOS 13.0, *) {
            return traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
        }
        return .default
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let weakHandler = WeakScriptMessageHandler(delegate: self)
        self.bridge?.webView?.configuration.userContentController.add(weakHandler, name: "AgiosHandler")

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
            updateUserStats: function(streak, plansSummaryJson) {
                window.webkit.messageHandlers.AgiosHandler.postMessage({
                    action: 'updateUserStats', streak: streak, plansSummary: plansSummaryJson || ''
                });
            },
            getSystemTheme: function() { return "\(theme)"; }
        };

        window.addEventListener('agiosDeepLink', function(e) {
            var path = e.detail.path;
            if (!path) return;
            if (path === '/#daily-verse' || path === '/#daily-question') {
                var anchor = path.split('#')[1];
                if (window.location.pathname !== '/') {
                    window.location.href = '/';
                    setTimeout(function() {
                        var el = document.getElementById(anchor);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 800);
                } else {
                    var el = document.getElementById(anchor);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                window.location.href = path;
            }
        });
        """

        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        self.bridge?.webView?.configuration.userContentController.addUserScript(script)
    }

    deinit {
        self.bridge?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "AgiosHandler")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "refreshAlarms":
            AgiosNotificationHelper.shared.refreshAllNotifications()
        case "updateSettings":
            if let json = body["json"] as? String, let master = body["master"] as? Bool {
                AgiosNotificationHelper.shared.updateSettings(json: json, masterEnabled: master)
            }
        case "updateUserStats":
            if let streak = body["streak"] as? Int {
                UserDefaults.standard.set(streak, forKey: "_cap_userStreak")
            }
            if let plansSummary = body["plansSummary"] as? String, !plansSummary.isEmpty {
                UserDefaults.standard.set(plansSummary, forKey: "_cap_studyPlansSummary")
            }
            AgiosNotificationHelper.shared.refreshAllNotifications()
        default:
            break
        }
    }
}

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
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let idsToRemove = requests.filter { $0.identifier.hasPrefix("agios_") }.map { $0.identifier }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: idsToRemove)

            guard (self.getPrefString(key: "masterNotifications") ?? "true") != "false" else { return }

            var settings: [String: Any] = [:]
            if let jsonStr = self.getPrefString(key: "notificationSettings"),
               let data = jsonStr.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                settings = parsed
            }

            for i in 0..<7 {
                self.scheduleVerse(offset: i, settings: settings)
                self.scheduleQuestion(offset: i, settings: settings)
                self.scheduleStreak(offset: i, settings: settings)
                self.scheduleStudyPlans(offset: i, settings: settings)
            }
            self.scheduleTip(settings: settings)
        }
    }

    private func scheduleVerse(offset: Int, settings: [String: Any]) {
        guard isEnabled("verse", settings: settings) else { return }
        guard let data = getTodayData(filename: "dailyVerses.json", daysOffset: offset) else { return }
        let title = data["reference"] as? String ?? "آية اليوم"
        let body = data["verse"] as? String ?? data["text"] as? String ?? "اكتشف آية اليوم"
        schedule(
            identifier: "agios_verse_\(offset)",
            title: title,
            body: body,
            hour: resolvedHour("verse", default: 6, settings: settings),
            minute: resolvedMinute("verse", settings: settings),
            offset: offset,
            deepLink: "/#daily-verse"
        )
    }

    private func scheduleQuestion(offset: Int, settings: [String: Any]) {
        guard isEnabled("question", settings: settings) else { return }
        guard let data = getTodayData(filename: "dailyQuestions.json", daysOffset: offset) else { return }
        let body = data["question"] as? String ?? "حان وقت سؤال اليوم!"
        schedule(
            identifier: "agios_question_\(offset)",
            title: "سؤال اليوم",
            body: body,
            hour: resolvedHour("question", default: 18, settings: settings),
            minute: resolvedMinute("question", settings: settings),
            offset: offset,
            deepLink: "/#daily-question"
        )
    }

    private func scheduleStreak(offset: Int, settings: [String: Any]) {
        guard isEnabled("streak", settings: settings) else { return }
        let streak = getPrefInt(key: "userStreak")
        let body = streak > 0
            ? "أنت في سلسلة تفاعل مدتها \(toArabicNumbers(streak)) يوم! لا تنسَ قراءة آية اليوم لتحافظ عليها 🔥"
            : "ابدأ سلسلة تفاعلك اليوم! اقرأ آية اليوم وشاركها لتبني عادة روحية جديدة."
        schedule(
            identifier: "agios_streak_\(offset)",
            title: "حافظ على حماسك",
            body: body,
            hour: resolvedHour("streak", default: 21, settings: settings),
            minute: resolvedMinute("streak", settings: settings),
            offset: offset,
            deepLink: "/"
        )
    }

    private func scheduleStudyPlans(offset: Int, settings: [String: Any]) {
        guard isEnabled("studyPlans", settings: settings) else { return }
        guard let summaryJson = getPrefString(key: "studyPlansSummary"),
              let data = summaryJson.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        let count = json["count"] as? Int ?? 0
        let title = json["mainPlanTitle"] as? String ?? ""
        let remaining = json["remainingDays"] as? Int ?? 0

        let body = count > 1
            ? "لديك \(toArabicNumbers(count)) خطط جارية. تبقّى \(toArabicNumbers(remaining)) يوم في \(title)"
            : "تبقّى لك \(toArabicNumbers(remaining)) يوم لإكمال \(title)"

        schedule(
            identifier: "agios_studyPlans_\(offset)",
            title: "متابعة القراءة 📖",
            body: body,
            hour: resolvedHour("studyPlans", default: 10, settings: settings),
            minute: resolvedMinute("studyPlans", settings: settings),
            offset: offset,
            deepLink: "/studyPlans"
        )
    }

    private func scheduleTip(settings: [String: Any]) {
        guard isEnabled("appSuggestions", settings: settings) else { return }
        let body = tips.randomElement() ?? "اكتشف ميزات أجيوس."
        schedule(
            identifier: "agios_appSuggestions_0",
            title: "معلومة سريعة",
            body: body,
            hour: resolvedHour("appSuggestions", default: 12, settings: settings),
            minute: resolvedMinute("appSuggestions", settings: settings),
            offset: 0,
            deepLink: "/"
        )
    }

    private func schedule(identifier: String, title: String, body: String, hour: Int, minute: Int, offset: Int, deepLink: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = ["deepLink": deepLink]

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Africa/Cairo") ?? .current

        let targetDate = calendar.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        var components = calendar.dateComponents([.year, .month, .day], from: targetDate)
        components.hour = hour
        components.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    private func isEnabled(_ key: String, settings: [String: Any]) -> Bool {
        return settings[key] as? Bool ?? true
    }

    private func resolvedHour(_ key: String, default defH: Int, settings: [String: Any]) -> Int {
        guard let timeStr = settings[key + "Time"] as? String, timeStr.contains(":") else { return defH }
        let parts = timeStr.components(separatedBy: ":")
        return Int(parts[0]) ?? defH
    }

    private func resolvedMinute(_ key: String, settings: [String: Any]) -> Int {
        guard let timeStr = settings[key + "Time"] as? String, timeStr.contains(":") else { return 0 }
        let parts = timeStr.components(separatedBy: ":")
        return parts.count >= 2 ? (Int(parts[1]) ?? 0) : 0
    }

    private func getTodayData(filename: String, daysOffset: Int) -> [String: Any]? {
        let possiblePaths = [
            Bundle.main.bundlePath + "/public/data/\(filename)",
            Bundle.main.bundlePath + "/data/\(filename)",
            Bundle.main.path(forResource: filename, ofType: nil) ?? ""
        ]

        for path in possiblePaths where !path.isEmpty {
            guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
                  let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { continue }

            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: "Africa/Cairo") ?? .current
            let targetDate = calendar.date(byAdding: .day, value: daysOffset, to: Date()) ?? Date()
            let comp = calendar.dateComponents([.month, .day], from: targetDate)

            if let match = array.first(where: { ($0["month"] as? Int == comp.month) && ($0["day"] as? Int == comp.day) }) {
                return match
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
        let arabicDigits = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"]
        return String(number).map { c in
            if let d = Int(String(c)) { return arabicDigits[d] }
            return String(c)
        }.joined()
    }
}