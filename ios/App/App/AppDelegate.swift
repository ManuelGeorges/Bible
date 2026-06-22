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

        NotificationCenter.default.post(name: Notification.Name("capacitorDidReceiveRemoteNotification"), object: userInfo)
        completionHandler()
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: Notification.Name("capacitorDidRegisterForRemoteNotifications"), object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: Notification.Name("capacitorDidFailToRegisterForRemoteNotifications"), object: error)
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

    private let localizedStrings: [String: [String: String]] = [
        "ar": [
            "verse_title": "آية اليوم",
            "question_title": "سؤال اليوم",
            "streak_title": "حافظ على حماسك",
            "plans_title": "متابعة القراءة 📖",
            "tip_title": "معلومة سريعة",
            "streak_msg": "أنت في سلسلة تفاعل مدتها %@ يوم! لا تنسَ قراءة آية اليوم لتحافظ عليها 🔥",
            "streak_start": "ابدأ سلسلة تفاعلك اليوم! اقرأ آية اليوم وشاركها لتبني عادة روحية جديدة.",
            "plans_msg_multi": "لديك %@ خطط جارية. تبقّى %@ يوم في %@",
            "plans_msg_single": "تبقّى لك %@ يوم لإكمال %@"
        ],
        "en": [
            "verse_title": "Verse of the Day",
            "question_title": "Daily Question",
            "streak_title": "Keep your streak!",
            "plans_title": "Continue Reading 📖",
            "tip_title": "Quick Tip",
            "streak_msg": "You're on a %@ day streak! Don't forget to read today's verse 🔥",
            "streak_start": "Start your streak today! Read and share the verse to build a new spiritual habit.",
            "plans_msg_multi": "You have %@ ongoing plans. %@ days left in %@",
            "plans_msg_single": "You have %@ days left to complete %@"
        ],
        "de": [
            "verse_title": "Vers des Tages",
            "question_title": "Tagesfrage",
            "streak_title": "Bleib dran!",
            "plans_title": "Weiterlesen 📖",
            "tip_title": "Kurzer Tipp",
            "streak_msg": "Du hast eine Serie von %@ Tagen! Vergiss nicht, den heutigen Vers zu lesen 🔥",
            "streak_start": "Beginne heute deine Serie! Lies den Vers, um eine neue Gewohnheit aufzubauen.",
            "plans_msg_multi": "Du hast %@ laufende Pläne. Noch %@ Tage in %@",
            "plans_msg_single": "Du hast noch %@ Tage, um %@ abzuschließen"
        ],
        "fr": [
            "verse_title": "Verset du jour",
            "question_title": "Question du jour",
            "streak_title": "Gardez le rythme !",
            "plans_title": "Continuer la lecture 📖",
            "tip_title": "Astuce rapide",
            "streak_msg": "Vous avez une série de %@ jours ! N'oubliez pas de lire le verset du jour 🔥",
            "streak_start": "Commencez votre série aujourd'hui ! Lisez le verset pour bâtir une nouvelle habitude.",
            "plans_msg_multi": "Vous avez %@ plans en cours. %@ jours restants pour %@",
            "plans_msg_single": "Il vous reste %@ jours pour terminer %@"
        ]
    ]

    private let localizedTips: [String: [String]] = [
        "ar": [
            "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
            "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
            "يمكنك تظليل الآيات التي تعجبك باللون الذي يريحك وكتابة ملحوظات عليها",
            "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
            "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط"
        ],
        "en": [
            "Have you tried the Bible search feature?",
            "Create a custom reading plan with Agios AI assistant.",
            "Highlight verses and add personal notes.",
            "Explore biblical places with interactive maps.",
            "Check your stats and badges in the points page."
        ],
        "de": [
            "Haben Sie die Bibelsuchfunktion ausprobiert?",
            "Erstellen Sie einen Leseplan mit dem Agios KI-Assistenten.",
            "Markieren Sie Verse und fügen Sie Notizen hinzu.",
            "Entdecken Sie biblische Orte mit interaktiven Karten.",
            "Überprüfen Sie Ihre Statistiken auf der Punkteseite."
        ],
        "fr": [
            "Avez-vous essayé la fonction de recherche biblique ?",
            "Créez un plan de lecture avec l'assistant IA Agios.",
            "Surlignez les versets et ajoutez des notes.",
            "Explorez les lieux bibliques avec des cartes interactives.",
            "Consultez vos statistiques sur la page des points."
        ]
    ]

    private func getLang() -> String {
        return UserDefaults.standard.string(forKey: "_cap_language") ?? "ar"
    }

    private func t(_ key: String) -> String {
        let lang = getLang()
        return localizedStrings[lang]?[key] ?? localizedStrings["ar"]?[key] ?? ""
    }

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
        let title = data["reference"] as? String ?? t("verse_title")
        let body = data["verse"] as? String ?? data["text"] as? String ?? "Bible Verse"
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
        let lang = getLang()
        let folder = lang == "ar" ? "arabic/" : (lang == "en" ? "English/" : (lang == "de" ? "german/" : "French/"))
        let filename = "translations/\(folder)dailyQuestions_\(lang).json"

        guard let data = getTodayData(filename: filename, daysOffset: offset) else { return }
        let body = data["question"] as? String ?? t("question_title")
        schedule(
            identifier: "agios_question_\(offset)",
            title: t("question_title"),
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
        let lang = getLang()
        let streakVal = lang == "ar" ? toArabicNumbers(streak) : String(streak)

        let body = streak > 0
            ? String(format: t("streak_msg"), streakVal)
            : t("streak_start")

        schedule(
            identifier: "agios_streak_\(offset)",
            title: t("streak_title"),
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

        let lang = getLang()
        let countStr = lang == "ar" ? toArabicNumbers(count) : String(count)
        let remainingStr = lang == "ar" ? toArabicNumbers(remaining) : String(remaining)

        let body = count > 1
            ? String(format: t("plans_msg_multi"), countStr, remainingStr, title)
            : String(format: t("plans_msg_single"), remainingStr, title)

        schedule(
            identifier: "agios_studyPlans_\(offset)",
            title: t("plans_title"),
            body: body,
            hour: resolvedHour("studyPlans", default: 10, settings: settings),
            minute: resolvedMinute("studyPlans", settings: settings),
            offset: offset,
            deepLink: "/studyPlans"
        )
    }

    private func scheduleTip(settings: [String: Any]) {
        guard isEnabled("appSuggestions", settings: settings) else { return }
        let lang = getLang()
        let tips = localizedTips[lang] ?? localizedTips["ar"]!
        let body = tips.randomElement() ?? ""

        schedule(
            identifier: "agios_appSuggestions_0",
            title: t("tip_title"),
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
