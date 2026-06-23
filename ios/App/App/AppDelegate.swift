swift
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
                    AgiosNotificationHelper.shared.refreshAllNotifications()
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
                    bridge.eval(js: "window.location.href = '\(deepLink)'; window.dispatchEvent(new CustomEvent('agiosDeepLink', { detail: { path: '\(deepLink)' } }));")
                }
            }
        }
        NotificationCenter.default.post(name: Notification.Name("capacitorDidReceiveRemoteNotification"), object: userInfo)
        completionHandler()
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        AgiosNotificationHelper.shared.refreshAllNotifications()
    }
}

class AgiosNotificationHelper {
    static let shared = AgiosNotificationHelper()

    private let localizedStrings: [String: [String: String]] = [
        "ar": [
            "verse_title": "آية اليوم", "question_title": "سؤال اليوم", "streak_title": "حافظ على حماسك",
            "plans_title": "متابعة القراءة 📖", "tip_title": "معلومة سريعة",
            "streak_msg": "أنت في سلسلة تفاعل مدتها %@ يوم! لا تنسَ قراءة آية اليوم لتحافظ عليها 🔥",
            "streak_start": "ابدأ سلسلة تفاعلك اليوم! اقرأ آية اليوم وشاركها لتبني عادة روحية جديدة.",
            "plans_msg_multi": "لديك %@ خطط جارية. تبقّى %@ يوم في %@",
            "plans_msg_single": "تبقّى لك %@ يوم لإكمال %@",
            "new_content": "لديك محتوى روحي جديد في أجيوس ✨"
        ],
        "en": [
            "verse_title": "Verse of the Day", "question_title": "Daily Question", "streak_title": "Keep your streak!",
            "plans_title": "Continue Reading 📖", "tip_title": "Quick Tip",
            "streak_msg": "You're on a %@ day streak! Don't forget to read today's verse 🔥",
            "streak_start": "Start your streak today! Read and share the verse to build a new spiritual habit.",
            "plans_msg_multi": "You have %@ ongoing plans. %@ days left in %@",
            "plans_msg_single": "You have %@ days left to complete %@",
            "new_content": "You have new spiritual content in Agios ✨"
        ],
        "de": [
            "verse_title": "Vers des Tages", "question_title": "Tagesfrage", "streak_title": "Bleib dran!",
            "plans_title": "Weiterlesen 📖", "tip_title": "Kurzer Tipp",
            "streak_msg": "Du hast eine Serie von %@ Tagen! Vergiss nicht, den heutigen Vers zu lesen 🔥",
            "streak_start": "Beginne heute deine Serie! Lies den Vers, um eine neue Gewohnheit aufzubauen.",
            "plans_msg_multi": "Du hast %@ laufende Pläne. Noch %@ Tage in %@",
            "plans_msg_single": "Du hast noch %@ Tage, um %@ abzuschließen",
            "new_content": "Du hast neue geistliche Inhalte in Agios ✨"
        ],
        "fr": [
            "verse_title": "Verset du jour", "question_title": "Question du jour", "streak_title": "Gardez le rythme !",
            "plans_title": "Continuer la lecture 📖", "tip_title": "Astuce rapide",
            "streak_msg": "Vous avez une série de %@ jours ! N'oubliez pas de lire le verset du jour 🔥",
            "streak_start": "Commencez votre série aujourd'hui ! Lisez le verset pour bâtير une nouvelle habitude.",
            "plans_msg_multi": "Vous avez %@ plans en cours. %@ jours restants pour %@",
            "plans_msg_single": "Il vous reste %@ jours pour terminer %@",
            "new_content": "Vous avez du nouveau contenu spirituel dans Agios ✨"
        ]
    ]

    private func getLang() -> String {
        return UserDefaults.standard.string(forKey: "_cap_language") ?? "ar"
    }

    private func t(_ key: String) -> String {
        let lang = getLang()
        return localizedStrings[lang]?[key] ?? localizedStrings["ar"]?[key] ?? ""
    }

    func refreshAllNotifications() {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let idsToRemove = requests.filter { $0.identifier.hasPrefix("agios_") }.map { $0.identifier }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: idsToRemove)

            let isEnabledMaster = (UserDefaults.standard.string(forKey: "_cap_masterNotifications") ?? "true") != "false"
            guard isEnabledMaster else { return }

            var settings: [String: Any] = [:]
            if let jsonStr = UserDefaults.standard.string(forKey: "_cap_notificationSettings"),
               let data = jsonStr.data(using: .utf8) {
                settings = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            }

            for i in 0..<7 {
                self.scheduleVerse(offset: i, settings: settings)
                self.scheduleQuestion(offset: i, settings: settings)
                self.scheduleStreak(offset: i, settings: settings)
                self.scheduleStudyPlans(offset: i, settings: settings)
            }
        }
    }

    private func scheduleVerse(offset: Int, settings: [String: Any]) {
        guard isEnabled("verse", settings: settings) else { return }
        let lang = getLang()
        let folder = getFolder(lang)

        let paths = ["\(folder)dailyVerses_\(lang).json", "translations/\(folder)dailyVerses_\(lang).json", "dailyVerses.json"]
        var refData: [String: Any]?
        for p in paths {
            if let data = getTodayData(filename: p, daysOffset: offset) {
                refData = data; break
            }
        }
        guard let data = refData else { return }

        let bookId = data["book"] as? String ?? (data["bookId"] as? String ?? "")
        let chapter = data["chapter"] as? Int ?? 1
        let verseNum = data["verse"] as? Int ?? 1

        var verseText = data["verse"] as? String ?? ""
        if !bookId.isEmpty {
            let bibleFile = getBibleFilePath(lang: lang)
            if let bibleArray = loadJsonArray(filename: bibleFile) {
                for book in bibleArray {
                    if (book["abbrev"] as? String)?.lowercased() == bookId.lowercased() {
                        if let chapters = book["chapters"] as? [[Any]], chapter <= chapters.count {
                            let verses = chapters[chapter - 1]
                            if verseNum <= verses.count { verseText = verses[verseNum - 1] as? String ?? "" }
                        }
                        break
                    }
                }
            }
        }

        var bookName = bookId
        if let bookNamesObj = loadJsonObject(filename: "bookNames.json"), let langBooks = bookNamesObj[lang] as? [[String: Any]] {
            for b in langBooks {
                if (b["book_id"] as? String)?.lowercased() == bookId.lowercased() {
                    bookName = b["name"] as? String ?? bookId; break
                }
            }
        }

        let cStr = lang == "ar" ? toArabicNumbers(chapter) : "\(chapter)"
        let vStr = lang == "ar" ? toArabicNumbers(verseNum) : "\(verseNum)"
        let title = bookId.isEmpty ? t("verse_title") : "\(bookName) \(cStr):\(vStr)"

        schedule(identifier: "agios_verse_\(offset)", title: title, body: verseText,
                 hour: getHour("verse", def: 6, settings: settings),
                 minute: getMinute("verse", settings: settings), offset: offset, deepLink: "/#daily-verse")
    }

    private func scheduleQuestion(offset: Int, settings: [String: Any]) {
        guard isEnabled("question", settings: settings) else { return }
        let lang = getLang()
        let filename = "translations/\(getFolder(lang))dailyQuestions_\(lang).json"

        if let data = getTodayData(filename: filename, daysOffset: offset), let q = data["question"] as? String {
            schedule(identifier: "agios_question_\(offset)", title: t("question_title"), body: q,
                     hour: getHour("question", def: 18, settings: settings),
                     minute: getMinute("question", settings: settings), offset: offset, deepLink: "/#daily-question")
        }
    }

    private func scheduleStreak(offset: Int, settings: [String: Any]) {
        guard isEnabled("streak", settings: settings) else { return }
        let streak = Int(UserDefaults.standard.string(forKey: "_cap_userStreak") ?? "0") ?? 0
        let lang = getLang()
        let sVal = lang == "ar" ? toArabicNumbers(streak) : "\(streak)"
        let body = streak > 0 ? String(format: t("streak_msg"), sVal) : t("streak_start")

        schedule(identifier: "agios_streak_\(offset)", title: t("streak_title"), body: body,
                 hour: getHour("streak", def: 21, settings: settings),
                 minute: getMinute("streak", settings: settings), offset: offset, deepLink: "/")
    }

    private func scheduleStudyPlans(offset: Int, settings: [String: Any]) {
        guard isEnabled("studyPlans", settings: settings) else { return }
        guard let summaryJson = UserDefaults.standard.string(forKey: "_cap_studyPlansSummary"),
              let data = summaryJson.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        let count = json["count"] as? Int ?? 0
        let title = json["mainPlanTitle"] as? String ?? ""
        let remaining = json["remainingDays"] as? Int ?? 0
        if count == 0 && title.isEmpty { return }

        let lang = getLang()
        let cStr = lang == "ar" ? toArabicNumbers(count) : "\(count)"
        let rStr = lang == "ar" ? toArabicNumbers(remaining) : "\(remaining)"
        let body = count > 1 ? String(format: t("plans_msg_multi"), cStr, rStr, title) : String(format: t("plans_msg_single"), rStr, title)

        schedule(identifier: "agios_studyPlans_\(offset)", title: t("plans_title"), body: body,
                 hour: getHour("studyPlans", def: 10, settings: settings),
                 minute: getMinute("studyPlans", settings: settings), offset: offset, deepLink: "/studyPlans")
    }

    private func schedule(identifier: String, title: String, body: String, hour: Int, minute: Int, offset: Int, deepLink: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = ["deepLink": deepLink]

        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Africa/Cairo") ?? .current
        let target = cal.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        var comp = cal.dateComponents([.year, .month, .day], from: target)
        comp.hour = hour
        comp.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: comp, repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
    }

    private func isEnabled(_ type: String, settings: [String: Any]) -> Bool {
        return settings[type] as? Bool ?? true
    }

    private func getHour(_ type: String, def: Int, settings: [String: Any]) -> Int {
        if let time = settings[type + "Time"] as? String, time.contains(":") {
            return Int(time.components(separatedBy: ":")[0]) ?? def
        }
        return def
    }

    private func getMinute(_ type: String, settings: [String: Any]) -> Int {
        if let time = settings[type + "Time"] as? String, time.contains(":"), time.components(separatedBy: ":").count > 1 {
            return Int(time.components(separatedBy: ":")[1]) ?? 0
        }
        return 0
    }

    private func getFolder(_ lang: String) -> String {
        switch lang {
            case "en": return "English/"
            case "fr": return "French/"
            case "de": return "german/"
            default: return "arabic/"
        }
    }

    private func getBibleFilePath(lang: String) -> String {
        let f = getFolder(lang)
        switch lang {
            case "en": return "translations/\(f)en_web.json"
            case "fr": return "translations/\(f)fr_segond.json"
            case "de": return "translations/\(f)de_luther.json"
            default: return "translations/\(f)ar_svd_tashkeel_site.json"
        }
    }

    private func getTodayData(filename: String, daysOffset: Int) -> [String: Any]? {
        guard let array = loadJsonArray(filename: filename) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Africa/Cairo") ?? .current
        let target = cal.date(byAdding: .day, value: daysOffset, to: Date()) ?? Date()
        let comp = cal.dateComponents([.month, .day], from: target)
        return array.first(where: { ($0["month"] as? Int == comp.month) && ($0["day"] as? Int == comp.day) })
    }

    private func loadJsonArray(filename: String) -> [[String: Any]]? {
        let name = filename.replacingOccurrences(of: ".json", with: "")
        let paths = ["public/data/\(name)", "data/\(name)", name]
        for p in paths {
            if let path = Bundle.main.path(forResource: p, ofType: "json"),
               let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
               let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] { return arr }
        }
        return nil
    }

    private func loadJsonObject(filename: String) -> [String: Any]? {
        let name = filename.replacingOccurrences(of: ".json", with: "")
        let paths = ["public/data/\(name)", "data/\(name)", name]
        for p in paths {
            if let path = Bundle.main.path(forResource: p, ofType: "json"),
               let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { return dict }
        }
        return nil
    }

    private func toArabicNumbers(_ number: Int) -> String {
        let digits = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"]
        return String(number).map { c in
            if let d = Int(String(c)) { return digits[d] }
            return String(c)
        }.joined()
    }
}