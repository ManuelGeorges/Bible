package com.agios.bible;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
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
            public void updateStudySummary(String json) {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                prefs.edit()
                    .putString("studyPlansSummary", json)
                    .putString("_cap_studyPlansSummary", json)
                    .apply();
            }

            @JavascriptInterface
            public void updateUserStats(int streak) {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                prefs.edit()
                    .putInt("userStreak", streak)
                    .putInt("_cap_userStreak", streak)
                    .apply();
            }
        }, "AgiosScannerNative");
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
        receiver.refreshAllAlarms(MainActivity.this);
    }
}
