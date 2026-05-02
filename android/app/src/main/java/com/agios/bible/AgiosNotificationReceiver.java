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
    private static final String TAG = "AgiosDebug";
    private final String[] agiosTips = {
            "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
            "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
            "يمكنك تظليل الآيات التي تعجبك باللون الذي يريحك وكتابة ملحوظات عليها",
            "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
            "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط",
            "يمكنك تغيير حجم خط القراءة من صفحة الإعدادات لراحة عينيك.",
            "هل تعلم أن بإمكانك قراءة الكتاب المقدس بدون إنترنت؟"
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String type = intent.getStringExtra("notification_type");
        String action = intent.getAction();

        Log.d(TAG, "onReceive: action=" + action + ", type=" + type);

        // إعادة جدولة المنبهات عند إعادة تشغيل الهاتف لضمان عدم ضياع المواعيد
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            refreshAllAlarms(context);
            return;
        }

        if (type == null) return;

        String norm = normalizeType(type);
        switch (norm) {
            case "verse":
                handleVerseNotification(context);
                break;
            case "question":
                handleQuestionNotification(context);
                break;
            case "streak":
                showNotification(context, "حافظ على حماسك", "لا تنسَ قراءة آية اليوم لتحافظ على سلسلة تفاعلك!", 103);
                break;
            case "studyPlans":
                handleStudyPlansNotification(context);
                break;
            case "tip":
                handleTipNotification(context);
                break;
            case "update":
                showNotification(context, "تحديث جديد", "تتوفر نسخة جديدة من أجيوس بمزايا رائعة، تفقدها الآن!", 106);
                break;
            default:
                showNotification(context, "أجيوس", "لديك محتوى روحي جديد في انتظارك", 107);
                break;
        }

        // جدولة الإشعار لليوم التالي تلقائياً لضمان الدورية
        scheduleAlarm(context, type, getDefaultHour(type), 0);
    }

    private void handleVerseNotification(Context context) {
        try {
            JSONObject data = getTodayData(context, "dailyVerses.json");
            if (data != null) {
                String title = data.optString("reference", "آية اليوم");
                String text = data.optString("verse", data.optString("text", "اكتشف آية اليوم"));
                showNotification(context, title, text, 101);
            } else {
                showNotification(context, "آية اليوم", "اكتشف آية اليوم وشاركها مع أصدقائك.", 101);
            }
        } catch (Exception e) {
            Log.e(TAG, "Verse Notify Error", e);
        }
    }

    private void handleQuestionNotification(Context context) {
        try {
            JSONObject data = getTodayData(context, "dailyQuestions.json");
            if (data != null) {
                String question = data.optString("question", "حان وقت سؤال اليوم!");
                showNotification(context, "سؤال اليوم", question, 102);
            } else {
                showNotification(context, "تحدي اليوم", "حان وقت سؤال اليوم، اختبر معلوماتك!", 102);
            }
        } catch (Exception e) {
            Log.e(TAG, "Question Notify Error", e);
        }
    }

    private void handleStudyPlansNotification(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String summaryJson = getPrefsString(prefs, "studyPlansSummary");
            if (!summaryJson.isEmpty()) {
                JSONObject json = new JSONObject(summaryJson);
                int count = json.optInt("count", 0);
                String title = json.optString("mainPlanTitle", "");
                int remaining = json.optInt("remainingDays", 0);

                String msg = count > 1 
                    ? "لديك " + count + " خطط جارية. تبقّى " + remaining + " يوم في " + title
                    : "تبقّى لك " + remaining + " يوم لإكمال " + title;
                
                showNotification(context, "متابعة القراءة 📖", msg, 104);
            } else {
                showNotification(context, "خطة القراءة 📖", "لديك جزء متبقي في خطة اليوم.", 104);
            }
        } catch (Exception e) {
            Log.e(TAG, "StudyPlans Notify Error", e);
        }
    }

    private void handleTipNotification(Context context) {
        int index = (int) (Math.random() * agiosTips.length);
        showNotification(context, "معلومة سريعة", agiosTips[index], 105);
    }

    private JSONObject getTodayData(Context context, String filename) {
        try {
            InputStream is;
            try {
                is = context.getAssets().open("public/data/" + filename);
            } catch (Exception e) {
                try {
                    is = context.getAssets().open("data/" + filename);
                } catch (Exception e2) {
                    is = context.getAssets().open(filename);
                }
            }

            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            JSONArray array = new JSONArray(new String(buffer, StandardCharsets.UTF_8));

            Calendar now = Calendar.getInstance();
            int month = now.get(Calendar.MONTH) + 1;
            int day = now.get(Calendar.DAY_OF_MONTH);

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optInt("month") == month && obj.optInt("day") == day) {
                    return obj;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error loading today's data from " + filename, e);
        }
        return null;
    }

    private String normalizeType(String type) {
        if (type == null) return "";
        String low = type.toLowerCase();
        if (low.contains("verse")) return "verse";
        if (low.contains("question")) return "question";
        if (low.contains("streak")) return "streak";
        if (low.contains("study") || low.contains("plan")) return "studyPlans";
        if (low.contains("tip")) return "tip";
        if (low.contains("update")) return "update";
        return type;
    }

    private int getDefaultHour(String type) {
        String n = normalizeType(type);
        if (n.equals("verse")) return 6;
        if (n.equals("question")) return 18;
        if (n.equals("studyPlans")) return 10;
        if (n.equals("streak")) return 21;
        if (n.equals("tip")) return 15;
        if (n.equals("update")) return 12;
        return 12;
    }

    public void refreshAllAlarms(Context context) {
        Log.d(TAG, "Refreshing all system alarms...");
        scheduleAlarm(context, "dailyVerse", 6, 0);
        scheduleAlarm(context, "dailyQuestion", 18, 0);
        scheduleAlarm(context, "studyPlans", 10, 0);
        scheduleAlarm(context, "streakReminder", 21, 0);
        scheduleAlarm(context, "tip", 15, 0);
        scheduleAlarm(context, "updateAlerts", 12, 0);
    }

    public void scheduleAlarm(Context context, String type, int defH, int defM) {
        if (type == null) return;
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

        String master = getPrefsString(prefs, "masterNotifications");
        if ("false".equals(master)) {
            cancelAlarm(context, type);
            return;
        }

        String savedTime = "";
        boolean enabled = true;
        String norm = normalizeType(type);

        String jsonStr = getPrefsString(prefs, "notificationSettings");
        if (!jsonStr.isEmpty()) {
            try {
                JSONObject json = new JSONObject(jsonStr);
                savedTime = json.optString(norm + "Time", json.optString(type + "Time", ""));
                if (json.has(norm)) enabled = json.optBoolean(norm, true);
                else if (json.has(type)) enabled = json.optBoolean(type, true);
            } catch (Exception e) { e.printStackTrace(); }
        }

        if (savedTime.isEmpty()) {
            savedTime = getPrefsString(prefs, norm + "Time");
            if (savedTime.isEmpty()) savedTime = getPrefsString(prefs, type + "Time");
        }

        if (!enabled) {
            cancelAlarm(context, type);
            return;
        }

        Calendar cal = Calendar.getInstance();
        boolean customFound = false;
        if (!savedTime.isEmpty() && savedTime.contains(":")) {
            try {
                String[] p = savedTime.split(":");
                cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(p[0]));
                cal.set(Calendar.MINUTE, Integer.parseInt(p[1]));
                customFound = true;
            } catch (Exception e) {}
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
        Log.d(TAG, "Scheduled " + type + " at " + cal.getTime().toString() + (customFound ? " (Custom)" : " (Default)"));
    }

    private String getPrefsString(SharedPreferences prefs, String key) {
        String val = prefs.getString("_cap_" + key, null);
        if (val == null) val = prefs.getString(key, "");
        return val;
    }

    private void cancelAlarm(Context context, String type) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AgiosNotificationReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(context, normalizeType(type).hashCode(), intent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pi != null) { am.cancel(pi); pi.cancel(); }
    }

    private void showNotification(Context context, String title, String text, int id) {
        String cid = "agios_notifications";
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(cid, "Agios Daily", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
        }
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        
        int iconRes = context.getResources().getIdentifier("ic_stat_ic_notification", "drawable", context.getPackageName());
        if (iconRes == 0) iconRes = android.R.drawable.ic_dialog_info;

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, cid)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);
        nm.notify(id, b.build());
    }
}
