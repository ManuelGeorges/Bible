package com.agios.bible;

import android.app.AlarmManager;
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
        SplashScreen.installSplashScreen(this);
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
            public void updateSettings(String json, boolean masterEnabled) {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                prefs.edit()
                        .putString("notificationSettings", json)
                        .putString("_cap_notificationSettings", json)
                        .putString("masterNotifications", String.valueOf(masterEnabled))
                        .putString("_cap_masterNotifications", String.valueOf(masterEnabled))
                        .apply();
                refreshAllAlarms();
            }

            @JavascriptInterface
            public void updateUserStats(int streak, String plansSummaryJson) {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                
                // الحل: Capacitor تتوقع القيم كنصوص (Strings)
                String streakStr = String.valueOf(streak);
                editor.putString("_cap_agios_streak", streakStr); // المفتاح الموحد الجديد
                editor.putString("agios_streak", streakStr);
                
                // للموافقة مع الكود القديم وتجنب الكراش
                editor.putString("_cap_userStreak", streakStr);
                editor.putString("userStreak", streakStr);

                if (plansSummaryJson != null && !plansSummaryJson.isEmpty()) {
                    editor.putString("_cap_studyPlansSummary", plansSummaryJson);
                    editor.putString("studyPlansSummary", plansSummaryJson);
                }
                editor.apply();
                refreshAllAlarms();
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
            if (!alarmManager.canScheduleExactAlarms()) {
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
