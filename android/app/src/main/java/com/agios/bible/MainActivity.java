package com.agios.bible;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            splashScreen.setOnExitAnimationListener(splashScreenView -> {
                splashScreenView.remove();
            });
        }

        super.onCreate(savedInstanceState);

        checkAndRequestAlarmPermission();
        refreshAllAlarms();

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            settings.setAlgorithmicDarkeningAllowed(false);
        }

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void scanFile(String path) {
                if (path == null) return;
                MediaScannerConnection.scanFile(MainActivity.this,
                        new String[]{path}, null, null);
            }

            @JavascriptInterface
            public void refreshAlarms() {
                refreshAllAlarms();
            }

            @JavascriptInterface
            public void refreshWidgets() {
                DataHelper.updateAllWidgets(MainActivity.this);
            }

            @JavascriptInterface
            public void pinWidget(String widgetType) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AppWidgetManager appWidgetManager = getSystemService(AppWidgetManager.class);
                    Class<?> providerClass;

                    switch (widgetType) {
                        case "verse": providerClass = VerseWidgetProvider.class; break;
                        case "question": providerClass = QuestionWidgetProvider.class; break;
                        case "studyPlan": providerClass = StudyPlanWidgetProvider.class; break;
                        case "points": providerClass = PointsWidgetProvider.class; break;
                        default: return;
                    }

                    ComponentName myProvider = new ComponentName(MainActivity.this, providerClass);

                    if (appWidgetManager.isRequestPinAppWidgetSupported()) {
                        Intent pinnedWidgetCallbackIntent = new Intent(MainActivity.this, MainActivity.class);
                        PendingIntent successCallback = PendingIntent.getBroadcast(MainActivity.this, 0,
                                pinnedWidgetCallbackIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

                        appWidgetManager.requestPinAppWidget(myProvider, null, successCallback);
                    }
                }
            }

            @JavascriptInterface
            public void updateSettings(String json, boolean masterEnabled) {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                prefs.edit()
                        .putString("notificationSettings", json)
                        .putString("_cap_notificationSettings", json)
                        .putString("masterNotifications", String.valueOf(masterEnabled))
                        .putString("_cap_masterNotifications", String.valueOf(masterEnabled))
                        .apply();
                refreshAllAlarms();
                DataHelper.updateAllWidgets(MainActivity.this);
            }

            @JavascriptInterface
            public void updateUserStats(int streak, String plansSummaryJson, int points) {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                
                String streakStr = String.valueOf(streak);
                editor.putString("_cap_userStreak", streakStr);
                editor.putString("userStreak", streakStr);

                String pointsStr = String.valueOf(points);
                editor.putString("_cap_userPoints", pointsStr);
                editor.putString("userPoints", pointsStr);

                if (plansSummaryJson != null && !plansSummaryJson.isEmpty()) {
                    editor.putString("_cap_studyPlansSummary", plansSummaryJson);
                    editor.putString("studyPlansSummary", plansSummaryJson);
                }
                
                editor.apply();
                refreshAllAlarms();
                DataHelper.updateAllWidgets(MainActivity.this);
            }

            @JavascriptInterface
            public String getSystemTheme() {
                int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
                return nightModeFlags == Configuration.UI_MODE_NIGHT_YES ? "dark" : "light";
            }
        }, "AgiosScannerNative");

        handleDeepLinkIntent(getIntent());
    }

    @Override
    public void onPause() {
        super.onPause();
        // تحديث الويدجت فوراً عند خروج المستخدم من التطبيق لضمان تطبيق اللغة/الثيم/النقاط الجديدة
        DataHelper.updateAllWidgets(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLinkIntent(intent);
    }

    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null) return;
        String deepLink = intent.getStringExtra("deepLink");
        if (deepLink == null || deepLink.isEmpty()) return;

        getBridge().getWebView().post(() -> {
            String safeLink = deepLink.replace("'", "\\'");
            getBridge().getWebView().evaluateJavascript(
                "setTimeout(function() {" +
                "  window.__agiosDeepLink = '" + safeLink + "';" +
                "  window.dispatchEvent(new CustomEvent('agiosDeepLink', { detail: { path: '" + safeLink + "' } }));" +
                "}, 800);",
                null
            );
        });
    }

    private void checkAndRequestAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }
    }

    public void refreshAllAlarms() {
        AgiosNotificationReceiver receiver = new AgiosNotificationReceiver();
        receiver.refreshAllAlarms(this);
    }
}
