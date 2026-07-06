package com.agios.bible;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

public class AgiosApplication extends Application {
    private static final String TAG = "AgiosApplication";
    private SharedPreferences.OnSharedPreferenceChangeListener listener;

    @Override
    public void onCreate() {
        super.onCreate();

        // مراقبة التغييرات في التخزين الخاص بـ Capacitor
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        
        listener = (sharedPreferences, key) -> {
            if (key != null) {
                Log.d(TAG, "Preference changed: " + key + ". Updating widgets...");
                // استخدام DataHelper لضمان مسح الكاش وتحديث الويدجت فوراً
                DataHelper.updateAllWidgets(getApplicationContext());
            }
        };

        prefs.registerOnSharedPreferenceChangeListener(listener);
    }
}