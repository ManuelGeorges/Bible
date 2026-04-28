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
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;

public class AgiosNotificationReceiver extends BroadcastReceiver {
    private static final java.lang.String TAG = "AgiosDebug";

    @java.lang.Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        java.lang.String type = intent.getStringExtra("notification_type");
        java.lang.String action = intent.getAction();

        Log.d(TAG, "onReceive: action=" + action + ", type=" + type);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            refreshAllAlarms(context);
            return;
        }

        if (type == null) return;

        java.lang.String norm = normalizeType(type);
        switch (norm) {
            case "verse":
                handleVerseNotification(context);
                break;
            case "question":
                handleQuestionNotification(context);
                break;
            case "streak":
                showNotification(context, "حافظ على حماسك", "لا تنسَ قراءة آية اليوم لتحافظ على السلسلة!", 103);
                break;
            case "studyPlans":
                handleStudyPlansNotification(context);
                break;
            default:
                showNotification(context, "تنبيه أجيوس", "لديك محتوى جديد في انتظارك", 105);
                break;
        }

        // جدولة الإشعار لليوم التالي تلقائياً
        scheduleAlarm(context, type, getDefaultHour(type), 0);
    }

    private void handleVerseNotification(Context context) {
        try {
            JSONObject data = getTodayData(context, "dailyVerses.json");
            if (data != null) {
                java.lang.String title = data.optString("reference", "آية اليوم");
                java.lang.String text = data.optString("verse", data.optString("text", "اكتشف آية اليوم"));
                showNotification(context, title, text, 101);
            }
        } catch (java.lang.Exception e) {
            Log.e(TAG, "Verse Notify Error", e);
        }
    }

    private void handleQuestionNotification(Context context) {
        try {
            JSONObject data = getTodayData(context, "dailyQuestions.json");
            if (data != null) {
                java.lang.String question = data.optString("question", "حان وقت سؤال اليوم!");
                showNotification(context, "سؤال اليوم", question, 102);
            }
        } catch (java.lang.Exception e) {
            Log.e(TAG, "Question Notify Error", e);
        }
    }

    private void handleStudyPlansNotification(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            java.lang.String summaryJson = getPrefsString(prefs, "studyPlansSummary");
            if (!summaryJson.isEmpty()) {
                JSONObject json = new JSONObject(summaryJson);
                int count = json.optInt("count", 0);
                java.lang.String title = json.optString("mainPlanTitle", "");
                int remaining = json.optInt("remainingDays", 0);

                java.lang.String msg;
                if (count > 1) {
                    msg = "لديك " + count + " خطط جارية. تبقّى " + remaining + " يوم في " + title;
                } else {
                    msg = "تبقّى لك " + remaining + " يوم لإكمال " + title;
                }
                showNotification(context, "خطة القراءة", msg, 104);
            } else {
                showNotification(context, "خطة القراءة", "لديك جزء متبقي في خطة اليوم.", 104);
            }
        } catch (java.lang.Exception e) {
            Log.e(TAG, "StudyPlans Notify Error", e);
        }
    }

    private JSONObject getTodayData(Context context, java.lang.String filename) {
        try {
            InputStream is;
            try {
                is = context.getAssets().open("public/data/" + filename);
            } catch (java.lang.Exception e) {
                try {
                    is = context.getAssets().open("data/" + filename);
                } catch (java.lang.Exception e2) {
                    is = context.getAssets().open(filename);
                }
            }

            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            JSONArray array = new JSONArray(new String(buffer, StandardCharsets.UTF_8));

            Calendar now = Calendar.getInstance();
            int m = now.get(Calendar.MONTH) + 1;
            int d = now.get(Calendar.DAY_OF_MONTH);

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optInt("month") == m && obj.optInt("day") == d) return obj;
            }
        } catch (java.lang.Exception e) {
            Log.e(TAG, "Error loading " + filename, e);
        }
        return null;
    }

    private java.lang.String normalizeType(java.lang.String type) {
        if (type == null) return "";
        java.lang.String low = type.toLowerCase();
        if (low.contains("verse")) return "verse";
        if (low.contains("question")) return "question";
        if (low.contains("streak")) return "streak";
        if (low.contains("study") || low.contains("plan")) return "studyPlans";
        return type;
    }

    private int getDefaultHour(java.lang.String type) {
        java.lang.String n = normalizeType(type);
        if (n.equals("verse")) return 6;
        if (n.equals("question")) return 18;
        if (n.equals("studyPlans")) return 10;
        if (n.equals("streak")) return 21;
        return 12;
    }

    public void refreshAllAlarms(Context context) {
        scheduleAlarm(context, "dailyVerse", 6, 0);
        scheduleAlarm(context, "dailyQuestion", 18, 0);
        scheduleAlarm(context, "studyPlans", 10, 0);
        scheduleAlarm(context, "streakReminder", 21, 0);
    }

    public void scheduleAlarm(Context context, java.lang.String type, int defH, int defM) {
        if (type == null) return;
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

        java.lang.String master = getPrefsString(prefs, "masterNotifications");
        if ("false".equals(master)) {
            cancelAlarm(context, type);
            return;
        }

        java.lang.String savedTime = "";
        boolean enabled = true;
        java.lang.String norm = normalizeType(type);

        java.lang.String jsonStr = getPrefsString(prefs, "notificationSettings");
        if (!jsonStr.isEmpty()) {
            try {
                JSONObject json = new JSONObject(jsonStr);
                savedTime = json.optString(norm + "Time", "");
                if (savedTime.isEmpty()) savedTime = json.optString(type + "Time", "");

                if (json.has(norm)) enabled = json.optBoolean(norm, true);
                else if (json.has(type)) enabled = json.optBoolean(type, true);
            } catch (java.lang.Exception e) { e.printStackTrace(); }
        }

        if (savedTime.isEmpty()) {
            savedTime = getPrefsString(prefs, norm + "Time");
            if (savedTime.isEmpty()) savedTime = getPrefsString(prefs, type + "Time");

            if (savedTime.isEmpty()) {
                if (norm.equals("verse")) savedTime = getPrefsString(prefs, "verseTime");
                else if (norm.equals("question")) savedTime = getPrefsString(prefs, "questionTime");
            }
        }

        if (!enabled) {
            cancelAlarm(context, type);
            return;
        }

        Calendar cal = Calendar.getInstance();
        boolean customFound = false;
        if (!savedTime.isEmpty() && savedTime.contains(":")) {
            try {
                java.lang.String[] p = savedTime.split(":");
                cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(p[0]));
                cal.set(Calendar.MINUTE, Integer.parseInt(p[1]));
                customFound = true;
            } catch (java.lang.Exception e) {}
        }

        if (!customFound) {
            cal.set(Calendar.HOUR_OF_DAY, defH);
            cal.set(Calendar.MINUTE, defM);
        }

        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DATE, 1);
        }

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AgiosNotificationReceiver.class);
        intent.putExtra("notification_type", type);

        PendingIntent pi = PendingIntent.getBroadcast(context, norm.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && am.canScheduleExactAlarms()) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        }
        Log.d(TAG, "Scheduled " + type + " at " + cal.getTime().toString());
    }

    private java.lang.String getPrefsString(SharedPreferences prefs, java.lang.String key) {
        java.lang.String val = prefs.getString("_cap_" + key, null);
        if (val == null) val = prefs.getString(key, "");
        return val;
    }

    private void cancelAlarm(Context context, java.lang.String type) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AgiosNotificationReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(context, normalizeType(type).hashCode(), intent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pi != null) { am.cancel(pi); pi.cancel(); }
    }

    private void showNotification(Context context, java.lang.String title, java.lang.String text, int id) {
        java.lang.String cid = "agios_notifications";
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(cid, "Agios Daily", NotificationManager.IMPORTANCE_HIGH));
        }
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, cid)
                .setSmallIcon(R.drawable.ic_stat_ic_notification)
                .setContentTitle(title).setContentText(text).setAutoCancel(true).setContentIntent(pi);
        nm.notify(id, b.build());
    }
}