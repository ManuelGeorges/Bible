package com.agios.bible;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class AgiosNotificationReceiver extends BroadcastReceiver {
    private String[] agiosTips = {
            "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
            "يمكن انشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
            "يمكنك تظليل الآيات التي تعجبك باللون الذي يريحك وكتابة ملحوظات عليها",
            "يمكنك تجربة الخرائط التفاعلية الآن واستكشاف الأماكن الكتابية",
            "يمكنك تغيير حجم الخط في صفحة الإعدادات."
    };
    private static final String TAG = "AgiosDebug";

    @Override
    public void onReceive(Context context, Intent intent) {
        String type = intent.getStringExtra("notification_type");
        Log.d(TAG, "onReceive triggered for type: " + type);

        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            refreshAllAlarms(context);
            return;
        }

        if (type == null) return;

        String normalizedType = normalizeType(type);

        switch (normalizedType) {
            case "dailyVerse":
                handleVerseNotification(context);
                break;
            case "dailyQuestion":
                handleGenericNotification(context, "سؤال اليوم", "حان وقت سؤال اليوم، اختبر معلوماتك!");
                break;
            case "streakReminder":
                handleGenericNotification(context, "حافظ على حماسك", "لا تنسَ قراءة آية اليوم لتحافظ على السلسلة!");
                break;
            case "studyPlans":
                handleGenericNotification(context, "خطة القراءة", "لديك جزء متبقي في خطة اليوم.");
                break;
            case "tip":
                handleTipNotification(context);
                break;
            default:
                Log.d(TAG, "Unknown notification type: " + type);
        }

        // Reschedule for the next day
        scheduleAlarm(context, type, getDefaultHour(normalizedType), 0);
    }

    private String normalizeType(String type) {
        if (type == null) return "";
        if (type.equals("verse")) return "dailyVerse";
        if (type.equals("question")) return "dailyQuestion";
        if (type.equals("streak")) return "streakReminder";
        return type;
    }

    private int getDefaultHour(String type) {
        switch (type) {
            case "dailyVerse": return 6;
            case "dailyQuestion": return 18;
            case "studyPlans": return 10;
            case "streakReminder": return 21;
            case "tip": return 15;
            case "checkUpdate": return 12;
            default: return -1;
        }
    }

    private void handleVerseNotification(Context context) {
        try {
            String json = loadJSONFromAsset(context, "dailyVerses.json");
            if (json != null) {
                JSONArray array = new JSONArray(json);
                int dayOfYear = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
                JSONObject verseObj = array.getJSONObject(dayOfYear % array.length());
                String title = verseObj.optString("reference", "آية اليوم");
                String text = verseObj.optString("text", "اكتشف آية اليوم");
                showNotification(context, title, text, 101);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in handleVerseNotification", e);
        }
    }

    private void handleGenericNotification(Context context, String title, String text) {
        showNotification(context, title, text, 102);
    }

    public void refreshAllAlarms(Context context) {
        Log.d(TAG, "Refreshing all alarms...");
        scheduleAlarm(context, "dailyVerse", 6, 0);
        scheduleAlarm(context, "dailyQuestion", 18, 0);
        scheduleAlarm(context, "studyPlans", 10, 0);
        scheduleAlarm(context, "streakReminder", 21, 0);
        scheduleAlarm(context, "tip", 15, 0);
        scheduleAlarm(context, "checkUpdate", 12, 0);
    }

    public void scheduleAlarm(Context context, String type, int defaultHour, int defaultMinute) {
        if (type == null) return;

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        
        String savedTime = "";
        boolean isEnabled = true;

        // 1. Try to read from notificationSettings JSON object (Capacitor style)
        String settingsJson = prefs.getString("_cap_notificationSettings", prefs.getString("notificationSettings", null));
        if (settingsJson != null) {
            try {
                JSONObject json = new JSONObject(settingsJson);
                String normalizedType = normalizeType(type);
                
                savedTime = json.optString(normalizedType + "Time", "");
                if (savedTime.isEmpty()) savedTime = json.optString(type + "Time", "");
                
                if (savedTime.isEmpty()) {
                    if (normalizedType.equals("dailyVerse")) savedTime = json.optString("verseTime", "");
                    else if (normalizedType.equals("dailyQuestion")) savedTime = json.optString("questionTime", "");
                    else if (normalizedType.equals("streakReminder")) savedTime = json.optString("streakTime", "");
                }

                if (json.has(normalizedType)) isEnabled = json.optBoolean(normalizedType, true);
                else if (json.has(type)) isEnabled = json.optBoolean(type, true);
                else {
                    if (normalizedType.equals("dailyVerse")) isEnabled = json.optBoolean("verse", true);
                    else if (normalizedType.equals("dailyQuestion")) isEnabled = json.optBoolean("question", true);
                    else if (normalizedType.equals("streakReminder")) isEnabled = json.optBoolean("streak", true);
                }
                Log.d(TAG, "Found in JSON: " + type + " -> " + savedTime + " enabled: " + isEnabled);
            } catch (Exception e) {
                Log.e(TAG, "JSON Parse Error", e);
            }
        }

        // 2. If not found in JSON, try individual SharedPreferences keys (Direct Preferences style)
        if (savedTime.isEmpty()) {
            String normalizedType = normalizeType(type);
            savedTime = getPrefsString(prefs, normalizedType + "Time");
            if (savedTime.isEmpty()) savedTime = getPrefsString(prefs, type + "Time");
            
            if (savedTime.isEmpty()) {
                if (normalizedType.equals("dailyVerse")) savedTime = getPrefsString(prefs, "verseTime");
                else if (normalizedType.equals("dailyQuestion")) savedTime = getPrefsString(prefs, "questionTime");
                else if (normalizedType.equals("streakReminder")) savedTime = getPrefsString(prefs, "streakTime");
            }
            
            // Check enabled status as individual key
            String enabledStr = getPrefsString(prefs, normalizedType);
            if (enabledStr.isEmpty()) enabledStr = getPrefsString(prefs, type);
            if (!enabledStr.isEmpty()) {
                isEnabled = Boolean.parseBoolean(enabledStr);
            }
            
            if (!savedTime.isEmpty()) {
                Log.d(TAG, "Found in individual prefs: " + type + " -> " + savedTime);
            }
        }

        if (!isEnabled) {
            Log.d(TAG, "Notification disabled for: " + type);
            cancelAlarm(context, type);
            return;
        }

        Calendar cal = Calendar.getInstance();
        boolean timeFound = false;

        if (!savedTime.isEmpty() && savedTime.contains(":")) {
            try {
                String[] parts = savedTime.split(":");
                cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(parts[0]));
                cal.set(Calendar.MINUTE, Integer.parseInt(parts[1]));
                timeFound = true;
            } catch (Exception e) {
                Log.e(TAG, "Error parsing savedTime: " + savedTime, e);
            }
        } 
        
        if (!timeFound) {
            if (defaultHour != -1) {
                cal.set(Calendar.HOUR_OF_DAY, defaultHour);
                cal.set(Calendar.MINUTE, defaultMinute);
                Log.d(TAG, "Using default time for " + type + ": " + defaultHour + ":" + defaultMinute);
            } else {
                return;
            }
        }

        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DATE, 1);
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AgiosNotificationReceiver.class);
        intent.putExtra("notification_type", type);
        
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, normalizeType(type).hashCode(), intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pendingIntent);
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pendingIntent);
        }
        
        Log.d(TAG, "Scheduled " + type + " for: " + cal.getTime().toString() + (timeFound ? " (from settings)" : " (default)"));
    }

    private String getPrefsString(SharedPreferences prefs, String key) {
        // Try with and without _cap_ prefix
        String val = prefs.getString("_cap_" + key, null);
        if (val == null) val = prefs.getString(key, "");
        return val;
    }

    private void cancelAlarm(Context context, String type) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AgiosNotificationReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, normalizeType(type).hashCode(), intent, 
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
    }

    private void showNotification(Context context, String title, String text, int id) {
        String channelId = "agios_notifications";
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Agios Daily", NotificationManager.IMPORTANCE_HIGH);
            manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_stat_ic_notification)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        manager.notify(id, builder.build());
    }

    private String loadJSONFromAsset(Context context, String fileName) {
        try {
            InputStream is = context.getAssets().open(fileName);
            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            return new String(buffer, StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.e(TAG, "Asset Error: " + fileName, e);
            return null;
        }
    }

    private void handleTipNotification(Context context) {
        int randomIndex = (int) (Math.random() * agiosTips.length);
        String randomTip = agiosTips[randomIndex];
        showNotification(context, "نصيحة أجيوس ", randomTip, 104);
    }
}
