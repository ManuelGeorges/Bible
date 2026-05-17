import UIKit
import Capacitor
import Firebase
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        let result = ApplicationDelegateProxy.shared.application(application, didFinishLaunchingWithOptions: launchOptions)

        UNUserNotificationCenter.current().delegate = self

        // طلب الإذن للإشعارات
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
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

    func applicationDidBecomeActive(_ application: UIApplication) {
        if let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge {
            bridge.eval(js: "window.dispatchEvent(new Event('visibilitychange'));")
        }
    }
}
