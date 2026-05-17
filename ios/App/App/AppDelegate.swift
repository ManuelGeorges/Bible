import UIKit
import Capacitor
import Firebase
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. تهيئة Firebase أولاً
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // 2. إعداد الـ Proxy الخاص بـ Capacitor
        let proxy = ApplicationDelegateProxy.shared
        let result = proxy.application(application, didFinishLaunchingWithOptions: launchOptions)

        // 3. إعداد الإشعارات
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    // ملاحظة: هذا السطر سيعمل بعد إضافة الملف للمشروع في الخطوة القادمة
                    AgiosNotificationHelper.shared.refreshAllNotifications()
                }
            }
        }

        return result
    }

    // إصلاح خطأ الـ URL Handling بالتأكيد على الـ Signature الصحيح
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
