package com.agios.bible;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class AgiosApplication extends Application {
    private static final String TAG = "AgiosApplication";
    private SharedPreferences.OnSharedPreferenceChangeListener listener;

    @Override
    public void onCreate() {
        super.onCreate();

        try {
            // مراقبة التغييرات في التخزين الخاص بـ Capacitor
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            
            listener = (sharedPreferences, key) -> {
                if (key != null) {
                    // نقوم بتشغيل التحديث على Thread منفصل أو بتأخير بسيط لتجنب الـ IllegalStateException
                    // وللتأكد من أن العمليات لا تعيق الخيط الرئيسي أثناء الـ onCreate
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        try {
                            Log.d(TAG, "Preference changed: " + key + ". Updating widgets...");
                            DataHelper.updateAllWidgets(getApplicationContext());
                        } catch (Exception e) {
                            Log.e(TAG, "Error updating widgets from listener", e);
                        }
                    }, 500); // تأخير 500 ملي ثانية لضمان استقرار الحالة
                }
            };

            prefs.registerOnSharedPreferenceChangeListener(listener);
        } catch (Exception e) {
            Log.e(TAG, "Failed to register SharedPreferences listener", e);
        }
    }
}
