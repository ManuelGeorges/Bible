import UIKit
import Capacitor
import Firebase
import FirebaseMessaging
import UserNotifications
import WebKit
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    static let groupID = "group.com.agios.bible"

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        FirebaseApp.configure()

        UNUserNotificationCenter.current().delegate = self

        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, _ in

            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()

                    AgiosNotificationHelper.shared.refreshAllNotifications()
                }
            }
        }

        return true
    }

    // MARK: - Widget Sync

    static func syncToWidget(key: String, value: Any) {

        if let shared = UserDefaults(suiteName: groupID) {

            shared.set(value, forKey: key)
            shared.synchronize()

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    // MARK: - Notifications

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler:
        @escaping (UNNotificationPresentationOptions) -> Void
    ) {

        completionHandler([
            .banner,
            .sound,
            .badge
        ])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {

        let userInfo = response.notification.request.content.userInfo

        if let deepLink = userInfo["deepLink"] as? String {

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {

                if let bridge =
                    (self.window?.rootViewController as? CAPBridgeViewController)?.bridge {

                    let escaped = deepLink
                        .replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "'", with: "\\'")

                    bridge.eval(
                        js: """
                        window.__agiosDeepLink = '\(escaped)';
                        window.dispatchEvent(
                            new CustomEvent('agiosDeepLink', {
                                detail: {
                                    path: '\(escaped)'
                                }
                            })
                        );
                        """
                    )
                }
            }
        }

        NotificationCenter.default.post(
            name: Notification.Name("capacitorDidReceiveRemoteNotification"),
            object: userInfo
        )

        completionHandler()
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {

        Messaging.messaging().apnsToken = deviceToken

        NotificationCenter.default.post(
            name: Notification.Name("capacitorDidRegisterForRemoteNotifications"),
            object: deviceToken
        )
    }

    func applicationDidBecomeActive(_ application: UIApplication) {

        AgiosNotificationHelper.shared.refreshAllNotifications()

        if let bridge =
            (self.window?.rootViewController as? CAPBridgeViewController)?.bridge {

            bridge.eval(
                js: "window.dispatchEvent(new Event('visibilitychange'));"
            )
        }
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {

        return ApplicationDelegateProxy.shared.application(
            app,
            open: url,
            options: options
        )
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {

        return ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }
}


// MARK: - Weak Script Handler

class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {

    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {

        delegate?.userContentController(
            userContentController,
            didReceive: message
        )
    }
}


// MARK: - Main View Controller

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override var preferredStatusBarStyle: UIStatusBarStyle {

        if #available(iOS 13.0, *) {
            return traitCollection.userInterfaceStyle == .dark
                ? .lightContent
                : .darkContent
        }

        return .default
    }

    override func viewDidLoad() {

        super.viewDidLoad()

        let weakHandler = WeakScriptMessageHandler(delegate: self)

        self.bridge?.webView?.configuration.userContentController.add(
            weakHandler,
            name: "AgiosHandler"
        )

        let theme =
            self.traitCollection.userInterfaceStyle == .dark
            ? "dark"
            : "light"

        let js = """
        window.AgiosScannerNative = {

            refreshAlarms: function() {
                window.webkit.messageHandlers.AgiosHandler.postMessage({
                    action: 'refreshAlarms'
                });
            },

            updateSettings: function(json, masterEnabled) {
                window.webkit.messageHandlers.AgiosHandler.postMessage({
                    action: 'updateSettings',
                    json: json,
                    master: masterEnabled
                });
            },

            updateUserStats: function(streak, plansSummaryJson, points) {
                window.webkit.messageHandlers.AgiosHandler.postMessage({
                    action: 'updateUserStats',
                    streak: streak,
                    plansSummary: plansSummaryJson || '',
                    points: points || 0
                });
            },

            getSystemTheme: function() {
                return "\(theme)";
            }
        };
        """

        let script = WKUserScript(
            source: js,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )

        self.bridge?.webView?.configuration.userContentController.addUserScript(
            script
        )
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {

        guard
            let body = message.body as? [String: Any],
            let action = body["action"] as? String
        else {
            return
        }

        switch action {

        case "refreshAlarms":

            AgiosNotificationHelper.shared.refreshAllNotifications()

        case "updateSettings":

            if
                let json = body["json"] as? String,
                let master = body["master"] as? Bool {

                AgiosNotificationHelper.shared.updateSettings(
                    json: json,
                    masterEnabled: master
                )
            }

        case "updateUserStats":

            if let streak = body["streak"] as? Int {

                UserDefaults.standard.set(
                    streak,
                    forKey: "_cap_userStreak"
                )

                AppDelegate.syncToWidget(
                    key: "streak_days",
                    value: "\(streak)"
                )
            }

            if let points = body["points"] as? Int {

                AppDelegate.syncToWidget(
                    key: "points_total",
                    value: "\(points)"
                )
            }

            if let plans = body["plansSummary"] as? String {

                UserDefaults.standard.set(
                    plans,
                    forKey: "_cap_studyPlansSummary"
                )

                if
                    let data = plans.data(using: .utf8),
                    let json =
                        try? JSONSerialization.jsonObject(
                            with: data
                        ) as? [String: Any] {

                    AppDelegate.syncToWidget(
                        key: "plan_title",
                        value: json["mainPlanTitle"] as? String ?? ""
                    )

                    AppDelegate.syncToWidget(
                        key: "plan_progress",
                        value: "\(json["progress"] as? Int ?? 0)"
                    )

                    AppDelegate.syncToWidget(
                        key: "plan_remaining",
                        value:
                            "متبقي \(json["remainingDays"] as? Int ?? 0) يوم"
                    )
                }
            }

            AgiosNotificationHelper.shared.refreshAllNotifications()

        default:
            break
        }
    }
}


// MARK: - Notification Helper

class AgiosNotificationHelper {

    static let shared = AgiosNotificationHelper()

    // MARK: - Localized Strings

    private let localizedStrings: [String: [String: String]] = [

        "ar": [

            "verse_title": "آية اليوم",
            "question_title": "سؤال اليوم",
            "streak_title": "حافظ على حماسك",
            "plans_title": "متابعة القراءة 📖",
            "tip_title": "معلومة سريعة",

            "streak_msg":
                "أنت في سلسلة تفاعل مدتها %@ يوم! لا تنسَ قراءة آية اليوم لتحافظ عليها 🔥",

            "streak_start":
                "ابدأ سلسلة تفاعلك اليوم! اقرأ آية اليوم وشاركها لتبني عادة روحية جديدة.",

            "plans_msg_multi":
                "لديك %@ خطط جارية. تبقّى %@ يوم في %@",

            "plans_msg_single":
                "تبقّى لك %@ يوم لإكمال %@",

            "new_content":
                "لديك محتوى روحي جديد في أجيوس ✨",

            "reengage_3_t": "نفتقدك! ✨",
            "reengage_3_b":
                "مرت 3 أيام لم تفتح فيها آجيوس. هل نلقي نظرة على كلمة اليوم؟",

            "reengage_7_t": "أين أنت؟ 🕊️",
            "reengage_7_b":
                "مضى أسبوع كامل! خصص دقائق قليلة لغذاء روحك.",

            "reengage_14_t": "اشتقنا إليك 📖",
            "reengage_14_b":
                "أسبوعان مرا بسرعة. الكتاب المقدس ينتظرك.",

            "reengage_30_t": "رسالة خاصة لك ❤️",
            "reengage_30_b":
                "شهر كامل غياب.. الرب يبارك حياتك، عد إلينا لنقرأ سوياً."
        ],

        "en": [

            "verse_title": "Verse of the Day",
            "question_title": "Daily Question",
            "streak_title": "Keep your streak!",
            "plans_title": "Continue Reading 📖",
            "tip_title": "Quick Tip",

            "streak_msg":
                "You're on a %@ day streak! Don't forget to read today's verse 🔥",

            "streak_start":
                "Start your streak today! Read and share the verse to build a new spiritual habit.",

            "plans_msg_multi":
                "You have %@ ongoing plans. %@ days left in %@",

            "plans_msg_single":
                "You have %@ days left to complete %@",

            "new_content":
                "You have new spiritual content in Agios ✨",

            "reengage_3_t": "We miss you! ✨",
            "reengage_3_b":
                "It's been 3 days since you last opened Agios. Shall we look at today's verse?",

            "reengage_7_t": "Where are you? 🕊️",
            "reengage_7_b":
                "A whole week has passed! Take a few minutes for your spiritual nourishment.",

            "reengage_14_t": "We've missed you 📖",
            "reengage_14_b":
                "Two weeks went by so fast. The Bible is waiting for you.",

            "reengage_30_t": "A special message for you ❤️",
            "reengage_30_b":
                "A whole month of absence.. God bless your life, come back to read together."
        ],

        "fr": [

            "verse_title": "Verset du jour",
            "question_title": "Question du jour",
            "streak_title": "Maintenez votre série !",
            "plans_title": "Continuer la lecture 📖",
            "tip_title": "Conseil rapide",

            "streak_msg":
                "Vous avez une série de %@ jours ! N'oubliez pas de lire le verset d'aujourd'hui 🔥",

            "streak_start":
                "Commencez votre série aujourd'hui ! Lisez le verset pour créer une habitude.",

            "plans_msg_multi":
                "Vous avez %@ plans en cours. %@ jours restants dans %@",

            "plans_msg_single":
                "Il vous reste %@ jours pour terminer %@",

            "new_content":
                "Vous avez un nouveau contenu spirituel ✨",

            "reengage_3_t": "Vous nous manquez ! ✨",
            "reengage_3_b":
                "Cela fait 3 jours que vous n'avez pas ouvert Agios. Regardons le verset du jour ?",

            "reengage_7_t": "Où êtes-vous ? 🕊️",
            "reengage_7_b":
                "Une semaine entière s'est écoulée ! Prenez quelques minutes pour votre ressourcement.",

            "reengage_14_t": "Vous nous avez manqué 📖",
            "reengage_14_b":
                "Deux semaines sont passées si vite. La Bible vous attend.",

            "reengage_30_t": "Un message spécial ❤️",
            "reengage_30_b":
                "Un mois d'absence.. Que Dieu bénisse votre vie, revenez lire avec nous."
        ],

        "de": [

            "verse_title": "Vers des Tages",
            "question_title": "Frage des Tages",
            "streak_title": "Halte deinen Streak!",
            "plans_title": "Weiterlesen 📖",
            "tip_title": "Kurzer Tipp",

            "streak_msg":
                "Du hast einen Streak von %@ Tagen! Vergiss nicht, den heutigen Vers zu lesen 🔥",

            "streak_start":
                "Beginne heute deinen Streak! Lies den Vers, um eine Gewohnheit aufzubauen.",

            "plans_msg_multi":
                "%@ laufende Pläne. %@ Tage verbleibend in %@",

            "plans_msg_single":
                "Noch %@ Tage, um %@ abzuschließen",

            "new_content":
                "Neue geistliche Inhalte ✨",

            "reengage_3_t": "Wir vermissen dich! ✨",
            "reengage_3_b":
                "Es ist 3 Tage her, seit du Agios das letzte Mal geöffnet hast. Sollen wir den heutigen Vers ansehen?",

            "reengage_7_t": "Wo bist du? 🕊️",
            "reengage_7_b":
                "Eine ganze Woche ist vergangen! Nimm dir ein paar Minuten für deine geistliche Nahrung.",

            "reengage_14_t": "Wir haben dich vermisst 📖",
            "reengage_14_b":
                "Zwei Wochen vergingen wie im Flug. Die Bibel wartet auf dich.",

            "reengage_30_t": "Eine Nachricht für dich ❤️",
            "reengage_30_b":
                "Ein ganzer Monat Abwesenheit.. Gott segne dich, komm zurück zum gemeinsamen Lesen."
        ]
    ]


    // MARK: - Tips

    private let localizedTips: [String: [String]] = [

        "ar": [
            "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
            "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
            "يمكنك تظليل الآيات التي تعجبك باللون الذي يريحك وكتابة ملحوظات عليها",
            "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
            "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط",
            "يمكنك تغيير حجم خط القراءة من صفحة الإعدادات لراحة عينيك.",
            "هل تعلم أن بإمكانك قراءة الكتاب المقدس بدون إنترنت؟"
        ],

        "en": [
            "Have you tried the Bible search feature?",
            "Create a custom reading plan with Agios AI assistant.",
            "Highlight verses and add personal notes.",
            "Explore biblical places with interactive maps.",
            "Check your stats and badges in the points page.",
            "Change font size in settings for comfortable reading.",
            "Did you know you can read the Bible offline?"
        ],

        "fr": [
            "Avez-vous essayé la recherche dans la Bible ?",
            "Créez un plan de lecture personnalisé avec l'IA.",
            "Surlignez les versets et ajoutez des notes.",
            "Explorez les lieux bibliques sur les cartes.",
            "Consultez vos statistiques sur la page des points.",
            "Changez la taille du texte pour votre confort.",
            "Saviez-vous que vous pouvez lire la Bible hors ligne ?"
        ],

        "de": [
            "Hast du die Bibelsuche schon ausprobiert?",
            "Erstelle einen Plan mit dem KI-Assistenten.",
            "Markiere Verse und füge Notizen hinzu.",
            "Erkunde biblische Orte auf der Karte.",
            "Prüfe deine Abzeichen auf der Punkteseite.",
            "Passe die Schriftgröße in den Einstellungen an.",
            "Wusstest du, dass du die Bibel offline lesen kannst?"
        ]
    ]


    // MARK: - Language

    private func getLang() -> String {

        let raw =
            UserDefaults.standard.string(forKey: "_cap_language")
            ?? UserDefaults.standard.string(forKey: "language")
            ?? "ar"

        var lang = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        while lang.hasPrefix("\"") && lang.hasSuffix("\"") && lang.count >= 2 {
            lang.removeFirst()
            lang.removeLast()
        }

        if lang.contains("-") {
            lang = String(lang.split(separator: "-").first ?? "ar")
        }

        if lang.contains("_") {
            lang = String(lang.split(separator: "_").first ?? "ar")
        }

        if ["ar", "en", "fr", "de"].contains(lang) {
            return lang
        }

        return "ar"
    }


    private func t(_ key: String) -> String {

        let lang = getLang()

        return localizedStrings[lang]?[key]
            ?? localizedStrings["ar"]?[key]
            ?? ""
    }


    // MARK: - Settings

    func updateSettings(
        json: String,
        masterEnabled: Bool
    ) {

        UserDefaults.standard.set(
            json,
            forKey: "_cap_notificationSettings"
        )

        UserDefaults.standard.set(
            String(masterEnabled),
            forKey: "_cap_masterNotifications"
        )

        refreshAllNotifications()
    }


    // MARK: - Refresh Notifications

    func refreshAllNotifications() {

        UNUserNotificationCenter.current()
            .getPendingNotificationRequests { requests in

                let idsToRemove = requests
                    .filter {
                        $0.identifier.hasPrefix("agios_")
                    }
                    .map {
                        $0.identifier
                    }

                UNUserNotificationCenter.current()
                    .removePendingNotificationRequests(
                        withIdentifiers: idsToRemove
                    )

                guard
                    (self.getPrefString(
                        key: "masterNotifications"
                    ) ?? "true") != "false"
                else {
                    return
                }

                var settings: [String: Any] = [:]

                if
                    let jsonStr = self.getPrefString(
                        key: "notificationSettings"
                    ),
                    let data = jsonStr.data(using: .utf8),
                    let parsed =
                        try? JSONSerialization.jsonObject(
                            with: data
                        ) as? [String: Any] {

                    settings = parsed
                }

                // =====================================================
                // IMPORTANT:
                // نفس نظام الـ 7 أيام القديم في Swift
                // =====================================================

                for i in 0..<7 {

                    self.scheduleVerse(
                        offset: i,
                        settings: settings
                    )

                    self.scheduleQuestion(
                        offset: i,
                        settings: settings
                    )

                    self.scheduleStreak(
                        offset: i,
                        settings: settings
                    )

                    self.scheduleStudyPlans(
                        offset: i,
                        settings: settings
                    )
                }

                self.scheduleTip(
                    settings: settings
                )

                self.scheduleReengagement()
            }
    }


    // MARK: - Re-engagement
    // لم يتم تغييره

    private func scheduleReengagement() {

        let days = [3, 7, 14, 30]

        for d in days {

            schedule(
                identifier: "agios_reengage_\(d)",
                title: t("reengage_\(d)_t"),
                body: t("reengage_\(d)_b"),
                hour: 17,
                minute: 0,
                offset: d,
                deepLink: "/"
            )
        }
    }


    // MARK: - Verse

    private func scheduleVerse(
        offset: Int,
        settings: [String: Any]
    ) {

        guard isEnabled(
            "verse",
            settings: settings
        )
        else {
            return
        }

        let lang = getLang()

        // =====================================================
        // نفس منطق Android:
        //
        // 1. shared/dailyVerses.json
        // 2. data/dailyVerses.json
        //
        // ثم الـ fallback الخاص بالـ Bundle.
        // =====================================================

        let versePaths = [
            "shared/dailyVerses.json",
            "data/dailyVerses.json",
            "dailyVerses.json"
        ]

        var refData: [String: Any]?

        for path in versePaths {

            if let data = getTodayData(
                filename: path,
                daysOffset: offset
            ) {

                refData = data
                break
            }
        }

        guard let data = refData else {
            return
        }

        let bookId =
            data["book"] as? String
            ?? data["bookId"] as? String
            ?? ""

        let chapter =
            data["chapter"] as? Int
            ?? 1

        let verseNum =
            data["verse"] as? Int
            ?? 1

        let bibleFile =
            getBibleFilePath(lang: lang)

        var verseText = ""

        if let books = loadJsonArray(
            filename: bibleFile
        ) {

            for book in books {

                guard
                    let abbrev =
                        book["abbrev"] as? String
                else {
                    continue
                }

                if abbrev.lowercased()
                    == bookId.lowercased() {

                    if
                        let chapters =
                            book["chapters"] as? [[Any]],
                        chapter <= chapters.count {

                        let verses =
                            chapters[chapter - 1]

                        if verseNum <= verses.count {

                            verseText =
                                verses[verseNum - 1]
                                as? String
                                ?? ""
                        }
                    }

                    break
                }
            }
        }

        var bookName = bookId

        if
            let allNames =
                loadJsonObject(
                    filename: "bookNames.json"
                ),
            let langBooks =
                allNames[lang] as? [[String: Any]] {

            for b in langBooks {

                if
                    (b["book_id"] as? String)?
                        .lowercased()
                    == bookId.lowercased() {

                    bookName =
                        b["name"] as? String
                        ?? bookId

                    break
                }
            }
        }

        let cStr =
            lang == "ar"
            ? toArabicNumbers(chapter)
            : "\(chapter)"

        let vStr =
            lang == "ar"
            ? toArabicNumbers(verseNum)
            : "\(verseNum)"

        let title =
            bookId.isEmpty
            ? t("verse_title")
            : "\(bookName) \(cStr):\(vStr)"

        if offset == 0 {

            AppDelegate.syncToWidget(
                key: "verse_text",
                value: verseText
            )

            AppDelegate.syncToWidget(
                key: "verse_ref",
                value:
                    "(\(bookName) \(cStr):\(vStr))"
            )
        }

        schedule(
            identifier: "agios_verse_\(offset)",
            title: title,
            body:
                verseText.isEmpty
                ? t("verse_title")
                : verseText,
            hour: resolvedHour(
                "verse",
                default: 6,
                settings: settings
            ),
            minute: resolvedMinute(
                "verse",
                settings: settings
            ),
            offset: offset,
            deepLink: "/#daily-verse"
        )
    }


    // MARK: - Question

    private func scheduleQuestion(
        offset: Int,
        settings: [String: Any]
    ) {

        guard isEnabled(
            "question",
            settings: settings
        )
        else {
            return
        }

        let lang = getLang()

        // =====================================================
        // نفس Android:
        //
        // getLanguageFolder(lang)
        // +
        // dailyQuestions_<lang>.json
        //
        // مثال:
        // English/dailyQuestions_en.json
        // French/dailyQuestions_fr.json
        // german/dailyQuestions_de.json
        // arabic/dailyQuestions_ar.json
        //
        // =====================================================

        let folder = getLanguageFolder(lang)

        let localizedFileName =
            "dailyQuestions_\(lang).json"

        let paths = [

            "\(folder)\(localizedFileName)",

            "data/\(folder)\(localizedFileName)",

            "translations/\(folder)\(localizedFileName)",

            "dailyQuestions.json",

            "data/dailyQuestions.json"
        ]

        var refData: [String: Any]?

        for path in paths {

            if let data = getTodayData(
                filename: path,
                daysOffset: offset
            ) {

                refData = data
                break
            }
        }

        guard let data = refData else {
            return
        }

        let question =
            data["question"] as? String
            ?? t("question_title")

        if offset == 0 {

            AppDelegate.syncToWidget(
                key: "question_text",
                value: question
            )
        }

        schedule(
            identifier: "agios_question_\(offset)",
            title: t("question_title"),
            body: question,
            hour: resolvedHour(
                "question",
                default: 18,
                settings: settings
            ),
            minute: resolvedMinute(
                "question",
                settings: settings
            ),
            offset: offset,
            deepLink: "/#daily-question"
        )
    }


    // MARK: - Streak

    private func scheduleStreak(
        offset: Int,
        settings: [String: Any]
    ) {

        guard isEnabled(
            "streak",
            settings: settings
        )
        else {
            return
        }

        let streak =
            getPrefInt(key: "userStreak")

        let lang = getLang()

        let sVal =
            lang == "ar"
            ? toArabicNumbers(streak)
            : String(streak)

        let body =
            streak > 0
            ? String(
                format: t("streak_msg"),
                sVal
            )
            : t("streak_start")

        schedule(
            identifier: "agios_streak_\(offset)",
            title: t("streak_title"),
            body: body,
            hour: resolvedHour(
                "streak",
                default: 21,
                settings: settings
            ),
            minute: resolvedMinute(
                "streak",
                settings: settings
            ),
            offset: offset,
            deepLink: "/"
        )
    }


    // MARK: - Study Plans

    private func scheduleStudyPlans(
        offset: Int,
        settings: [String: Any]
    ) {

        guard isEnabled(
            "studyPlans",
            settings: settings
        )
        else {
            return
        }

        guard
            let summaryJson =
                getPrefString(
                    key: "studyPlansSummary"
                ),
            let data =
                summaryJson.data(using: .utf8),
            let json =
                try? JSONSerialization.jsonObject(
                    with: data
                ) as? [String: Any]
        else {
            return
        }

        let count =
            json["count"] as? Int
            ?? 0

        let title =
            json["mainPlanTitle"] as? String
            ?? ""

        let remaining =
            json["remainingDays"] as? Int
            ?? 0

        let lang = getLang()

        let cStr =
            lang == "ar"
            ? toArabicNumbers(count)
            : String(count)

        let rStr =
            lang == "ar"
            ? toArabicNumbers(remaining)
            : String(remaining)

        let body =
            count > 1
            ? String(
                format: t("plans_msg_multi"),
                cStr,
                rStr,
                title
            )
            : String(
                format: t("plans_msg_single"),
                rStr,
                title
            )

        schedule(
            identifier:
                "agios_studyPlans_\(offset)",
            title: t("plans_title"),
            body: body,
            hour: resolvedHour(
                "studyPlans",
                default: 10,
                settings: settings
            ),
            minute: resolvedMinute(
                "studyPlans",
                settings: settings
            ),
            offset: offset,
            deepLink: "/studyPlans"
        )
    }


    // MARK: - Tips

    private func scheduleTip(
        settings: [String: Any]
    ) {

        guard isEnabled(
            "appSuggestions",
            settings: settings
        )
        else {
            return
        }

        let lang = getLang()

        let tips =
            localizedTips[lang]
            ?? localizedTips["ar"]!

        schedule(
            identifier:
                "agios_appSuggestions_0",
            title: t("tip_title"),
            body:
                tips.randomElement()
                ?? "",
            hour: resolvedHour(
                "appSuggestions",
                default: 12,
                settings: settings
            ),
            minute: resolvedMinute(
                "appSuggestions",
                settings: settings
            ),
            offset: 0,
            deepLink: "/"
        )
    }


    // MARK: - Schedule

    private func schedule(
        identifier: String,
        title: String,
        body: String,
        hour: Int,
        minute: Int,
        offset: Int,
        deepLink: String
    ) {

        let content =
            UNMutableNotificationContent()

        content.title = title
        content.body = body
        content.sound = .default

        content.userInfo = [
            "deepLink": deepLink
        ]

        var cal =
            Calendar(identifier: .gregorian)

        cal.timeZone =
            TimeZone(
                identifier: "Africa/Cairo"
            )
            ?? .current

        let target =
            cal.date(
                byAdding: .day,
                value: offset,
                to: Date()
            )
            ?? Date()

        var comp =
            cal.dateComponents(
                [
                    .year,
                    .month,
                    .day
                ],
                from: target
            )

        comp.hour = hour
        comp.minute = minute

        let trigger =
            UNCalendarNotificationTrigger(
                dateMatching: comp,
                repeats: false
            )

        let request =
            UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: trigger
            )

        UNUserNotificationCenter.current()
            .add(request)
    }


    // MARK: - Settings Helpers

    private func isEnabled(
        _ key: String,
        settings: [String: Any]
    ) -> Bool {

        return settings[key] as? Bool ?? true
    }


    private func resolvedHour(
        _ key: String,
        default defH: Int,
        settings: [String: Any]
    ) -> Int {

        guard
            let timeStr =
                settings[key + "Time"] as? String,
            timeStr.contains(":")
        else {
            return defH
        }

        let parts =
            timeStr.components(
                separatedBy: ":"
            )

        return Int(parts[0]) ?? defH
    }


    private func resolvedMinute(
        _ key: String,
        settings: [String: Any]
    ) -> Int {

        guard
            let timeStr =
                settings[key + "Time"] as? String,
            timeStr.contains(":")
        else {
            return 0
        }

        let parts =
            timeStr.components(
                separatedBy: ":"
            )

        return
            parts.count >= 2
            ? Int(parts[1]) ?? 0
            : 0
    }


    // MARK: - Language Folders

    private func getLanguageFolder(
        _ lang: String
    ) -> String {

        switch lang {

        case "en":
            return "English/"

        case "fr":
            return "French/"

        case "de":
            return "german/"

        default:
            return "arabic/"
        }
    }


    // MARK: - Bible File

    private func getBibleFilePath(
        lang: String
    ) -> String {

        let folder =
            getLanguageFolder(lang)

        switch lang {

        case "en":
            return "\(folder)en_web.json"

        case "fr":
            return "\(folder)fr_segond.json"

        case "de":
            return "\(folder)de_luther.json"

        default:
            // نفس Android
            return "\(folder)ar_svd_no_tashkeel.json"
        }
    }


    // MARK: =========================================================
    // FILE LOADING
    // =========================================================

    /*
     ================================================================
     أهم جزء في التعديل
     ================================================================

     Android كان بيعمل:

     1. filesDir/translations/<path>

     ثم يبحث في Assets:

     path
     public/path
     public/translations/path
     public/data/path
     public/data/translations/path
     www/path
     www/data/path
     data/path
     translations/path
     arabic/path

     هنا بنعمل نفس الفكرة على iOS.

     ================================================================
     */

    private func loadJsonArray(
        filename: String
    ) -> [[String: Any]]? {

        guard
            let data =
                loadFileData(
                    filename: filename
                )
        else {
            return nil
        }

        return
            try? JSONSerialization.jsonObject(
                with: data
            ) as? [[String: Any]]
    }


    private func loadJsonObject(
        filename: String
    ) -> [String: Any]? {

        guard
            let data =
                loadFileData(
                    filename: filename
                )
        else {
            return nil
        }

        return
            try? JSONSerialization.jsonObject(
                with: data
            ) as? [String: Any]
    }


    // MARK: - Today Data

    private func getTodayData(
        filename: String,
        daysOffset: Int
    ) -> [String: Any]? {

        guard
            let array =
                loadJsonArray(
                    filename: filename
                )
        else {
            return nil
        }

        var cal =
            Calendar(identifier: .gregorian)

        cal.timeZone =
            TimeZone(
                identifier: "Africa/Cairo"
            )
            ?? .current

        let target =
            cal.date(
                byAdding: .day,
                value: daysOffset,
                to: Date()
            )
            ?? Date()

        let comp =
            cal.dateComponents(
                [
                    .month,
                    .day
                ],
                from: target
            )

        return array.first {
            ($0["month"] as? Int)
                == comp.month
            &&
            ($0["day"] as? Int)
                == comp.day
        }
    }


    // MARK: - Main File Loader

    private func loadFileData(
        filename: String
    ) -> Data? {

        let normalized =
            filename
                .trimmingCharacters(
                    in: CharacterSet(
                        charactersIn: "/"
                    )
                )

        // =========================================================
        // 1. SERVER-DOWNLOADED FILES
        // =========================================================

        let fileManager =
            FileManager.default

        var downloadedCandidates: [URL] = []

        /*
         Android:

         context.getFilesDir()
         +
         "translations/"
         +
         path

         لذلك بنجرب نفس البنية على iOS.
         */

        if let appSupport =
            fileManager.urls(
                for: .applicationSupportDirectory,
                in: .userDomainMask
            ).first {

            downloadedCandidates.append(
                appSupport
                    .appendingPathComponent(
                        "translations",
                        isDirectory: true
                    )
                    .appendingPathComponent(
                        normalized
                    )
            )

            downloadedCandidates.append(
                appSupport
                    .appendingPathComponent(
                        normalized
                    )
            )
        }


        /*
         بعض أنظمة Capacitor / Filesystem
         ممكن تخزن الملفات في Documents.
         */

        if let documents =
            fileManager.urls(
                for: .documentDirectory,
                in: .userDomainMask
            ).first {

            downloadedCandidates.append(
                documents
                    .appendingPathComponent(
                        "translations",
                        isDirectory: true
                    )
                    .appendingPathComponent(
                        normalized
                    )
            )

            downloadedCandidates.append(
                documents
                    .appendingPathComponent(
                        normalized
                    )
            )
        }


        /*
         Library/Application Support
         كـ fallback إضافي.
         */

        if let library =
            fileManager.urls(
                for: .libraryDirectory,
                in: .userDomainMask
            ).first {

            downloadedCandidates.append(
                library
                    .appendingPathComponent(
                        "translations",
                        isDirectory: true
                    )
                    .appendingPathComponent(
                        normalized
                    )
            )
        }


        // جرب الملفات المحملة من السيرفر أولًا

        for url in downloadedCandidates {

            if fileManager.fileExists(
                atPath: url.path
            ) {

                if let data =
                    try? Data(
                        contentsOf: url
                    ) {

                    if !data.isEmpty {

                        return data
                    }
                }
            }
        }


        // =========================================================
        // 2. BUNDLE / ASSETS FALLBACK
        // =========================================================

        let bundleCandidates = [

            normalized,

            "public/\(normalized)",

            "public/translations/\(normalized)",

            "public/data/\(normalized)",

            "public/data/translations/\(normalized)",

            "www/\(normalized)",

            "www/data/\(normalized)",

            "data/\(normalized)",

            "translations/\(normalized)",

            "arabic/\(normalized)"
        ]


        for candidate in bundleCandidates {

            let pathWithoutExtension =
                candidate
                    .replacingOccurrences(
                        of: ".json",
                        with: ""
                    )

            if let path =
                Bundle.main.path(
                    forResource:
                        pathWithoutExtension,
                    ofType: "json"
                ) {

                if let data =
                    try? Data(
                        contentsOf:
                            URL(
                                fileURLWithPath: path
                            )
                    ) {

                    if !data.isEmpty {
                        return data
                    }
                }
            }
        }


        // =========================================================
        // 3. Direct Bundle Resources Fallback
        // =========================================================

        let fileName =
            URL(fileURLWithPath: normalized)
                .lastPathComponent

        let name =
            fileName
                .replacingOccurrences(
                    of: ".json",
                    with: ""
                )

        if let path =
            Bundle.main.path(
                forResource: name,
                ofType: "json"
            ) {

            if let data =
                try? Data(
                    contentsOf:
                        URL(
                            fileURLWithPath: path
                        )
                ) {

                return data
            }
        }

        return nil
    }


    // MARK: - UserDefaults

    private func getPrefString(
        key: String
    ) -> String? {

        return
            UserDefaults.standard.string(
                forKey: "_cap_" + key
            )
            ??
            UserDefaults.standard.string(
                forKey: key
            )
    }


    private func getPrefInt(
        key: String
    ) -> Int {

        if
            let val =
                UserDefaults.standard.object(
                    forKey: "_cap_" + key
                ) as? Int {

            return val
        }

        if
            let s =
                getPrefString(
                    key: key
                ),
            let val =
                Int(s) {

            return val
        }

        return 0
    }


    // MARK: - Arabic Numbers

    private func toArabicNumbers(
        _ number: Int
    ) -> String {

        let digits = [
            "٠",
            "١",
            "٢",
            "٣",
            "٤",
            "٥",
            "٦",
            "٧",
            "٨",
            "٩"
        ]

        return String(number)
            .map { character in

                if
                    let d =
                        Int(
                            String(character)
                        ) {

                    return digits[d]
                }

                return String(character)
            }
            .joined()
    }
}