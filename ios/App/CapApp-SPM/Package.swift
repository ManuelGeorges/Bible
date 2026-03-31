// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.2.0"),
        .package(name: "CapacitorCommunityKeepAwake", path: "..\..\..\node_modules\@capacitor-community\keep-awake"),
        .package(name: "CapacitorFirebaseAuthentication", path: "..\..\..\node_modules\@capacitor-firebase\authentication"),
        .package(name: "CapacitorApp", path: "..\..\..\node_modules\@capacitor\app"),
        .package(name: "CapacitorBrowser", path: "..\..\..\node_modules\@capacitor\browser"),
        .package(name: "CapacitorLocalNotifications", path: "..\..\..\node_modules\@capacitor\local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "..\..\..\node_modules\@capacitor\push-notifications"),
        .package(name: "CapacitorSplashScreen", path: "..\..\..\node_modules\@capacitor\splash-screen"),
        .package(name: "CapacitorStatusBar", path: "..\..\..\node_modules\@capacitor\status-bar"),
        .package(name: "CapawesomeCapacitorAppUpdate", path: "..\..\..\node_modules\@capawesome\capacitor-app-update"),
        .package(name: "CapgoCapacitorUpdater", path: "..\..\..\node_modules\@capgo\capacitor-updater"),
        .package(name: "CapacitorNativeSettings", path: "..\..\..\node_modules\capacitor-native-settings")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityKeepAwake", package: "CapacitorCommunityKeepAwake"),
                .product(name: "CapacitorFirebaseAuthentication", package: "CapacitorFirebaseAuthentication"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapawesomeCapacitorAppUpdate", package: "CapawesomeCapacitorAppUpdate"),
                .product(name: "CapgoCapacitorUpdater", package: "CapgoCapacitorUpdater"),
                .product(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings")
            ]
        )
    ]
)
