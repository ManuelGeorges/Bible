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
import java.util.TimeZone;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import java.util.HashMap;
import java.util.Map;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.tasks.Task;

public class AgiosNotificationReceiver extends BroadcastReceiver {
    private static final String TAG = "AgiosDebug";

    private String getLang(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String lang = prefs.getString("_cap_language", "ar");
        if (lang == null || lang.isEmpty()) lang = "ar";
        return lang;
    }

    private String getLocalizedString(String key, String lang) {
        Map<String, Map<String, String>> translations = new HashMap<>();
        
        Map<String, String> ar = new HashMap<>();
        ar.put("verse_title", "آية اليوم");
        ar.put("question_title", "سؤال اليوم");
        ar.put("streak_title", "حافظ على حماسك");
        ar.put("plans_title", "متابعة القراءة 📖");
        ar.put("tip_title", "معلومة سريعة");
        ar.put("update_title", "تحديث جديد متاح");
        ar.put("update_body", "تتوفر نسخة جديدة من أجيوس بمزايا رائعة، حملها الآن من المتجر!");
        ar.put("streak_msg", "أنت في سلسلة تفاعل مدتها %s يوم! لا تنسَ قراءة آية اليوم لتحافظ عليها 🔥");
        ar.put("streak_start", "ابدأ سلسلة تفاعلك اليوم! اقرأ آية اليوم وشاركها لتبني عادة روحية جديدة.");
        ar.put("plans_msg_multi", "لديك %s خطط جارية. تبقّى %s يوم في %s");
        ar.put("plans_msg_single", "تبقّى لك %s يوم لإكمال %s");
        ar.put("new_content", "لديك محتوى روحي جديد في أجيوس ✨");
        translations.put("ar", ar);

        Map<String, String> en = new HashMap<>();
        en.put("verse_title", "Verse of the Day");
        en.put("question_title", "Daily Question");
        en.put("streak_title", "Keep your streak!");
        en.put("plans_title", "Continue Reading 📖");
        en.put("tip_title", "Quick Tip");
        en.put("update_title", "New Update Available");
        en.put("update_body", "A new version of Agios is available with great features, download it now!");
        en.put("streak_msg", "You're on a %s day streak! Don't forget to read today's verse 🔥");
        en.put("streak_start", "Start your streak today! Read and share the verse to build a new spiritual habit.");
        en.put("plans_msg_multi", "You have %s ongoing plans. %s days left in %s");
        en.put("plans_msg_single", "You have %s days left to complete %s");
        en.put("new_content", "You have new spiritual content in Agios ✨");
        translations.put("en", en);

        Map<String, String> de = new HashMap<>();
        de.put("verse_title", "Vers des Tages");
        de.put("question_title", "Tagesfrage");
        de.put("streak_title", "Bleib dran!");
        de.put("plans_title", "Weiterlesen 📖");
        de.put("tip_title", "Kurzer Tipp");
        de.put("update_title", "Neues Update verfügbar");
        de.put("update_body", "Eine neue Version von Agios ist verfügbar, lade sie jetzt herunter!");
        de.put("streak_msg", "Du hast eine Serie von %s Tagen! Vergiss nicht, den heutigen Vers zu lesen 🔥");
        de.put("streak_start", "Beginne heute deine Serie! Lies den Vers, um eine neue Gewohnheit aufzubauen.");
        de.put("plans_msg_multi", "Du hast %s laufende Pläne. Noch %s Tage in %s");
        de.put("plans_msg_single", "Du hast noch %s Tage, um %s abzuschließen");
        de.put("new_content", "Du hast neue geistliche Inhalte in Agios ✨");
        translations.put("de", de);

        Map<String, String> fr = new HashMap<>();
        fr.put("verse_title", "Verset du jour");
        fr.put("question_title", "Question du jour");
        fr.put("streak_title", "Gardez le rythme !");
        fr.put("plans_title", "Continuer la lecture 📖");
        fr.put("tip_title", "Astuce rapide");
        fr.put("update_title", "Mise à jour disponible");
        fr.put("update_body", "Une nouvelle version d'Agios est disponible, téléchargez-la maintenant !");
        fr.put("streak_msg", "Vous avez une série de %s jours ! N'oubliez pas de lire le verset du jour 🔥");
        fr.put("streak_start", "Commencez votre série aujourd'hui ! Lisez le verset pour bâtir une nouvelle habitude.");
        fr.put("plans_msg_multi", "Vous avez %s plans en cours. %s jours restants pour %s");
        fr.put("plans_msg_single", "Il vous reste %s jours pour terminer %s");
        fr.put("new_content", "Vous avez du nouveau contenu spirituel dans Agios ✨");
        translations.put("fr", fr);

        Map<String, String> langMap = translations.get(lang);
        if (langMap == null) langMap = translations.get("ar");
        return langMap.get(key);
    }

    private final String[][] localizedTips = {
            { // Arabic
                "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
                "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
                "يمكنك تظليل الآيات التي تعجبك باللون الذي يريحك وكتابة ملحوظات عليها",
                "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
                "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط",
                "يمكنك تغيير حجم خط القراءة من صفحة الإعدادات لراحة عينيك.",
                "هل تعلم أن بإمكانك قراءة الكتاب المقدس بدون إنترنت؟"
            },
            { // English
                "Have you tried the Bible search feature?",
                "Create a custom reading plan with Agios AI assistant.",
                "Highlight verses and add personal notes.",
                "Explore biblical places with interactive maps.",
                "Check your stats and badges in the points page.",
                "Change font size in settings for comfortable reading.",
                "Did you know you can read the Bible offline?"
            },
            { // German
                "Haben Sie die Bibelsuchfunktion ausprobiert?",
                "Erstellen Sie einen Leseplan mit dem Agios KI-Assistenten.",
                "Markieren Sie Verse und fügen Sie Notizen hinzu.",
                "Entdecken Sie biblische Orte mit interaktiven Karten.",
                "Überprüfen Sie Ihre Statistiken auf der Punkteseite.",
                "Passen Sie die Schriftgröße in den Einstellungen an.",
                "Wussten Sie, dass Sie die Bibel offline lesen können?"
            },
            { // French
                "Avez-vous essayé la fonction de recherche biblique ?",
                "Créez un plan de lecture avec l'assistant IA Agios.",
                "Surlignez les versets et ajoutez des notes.",
                "Explorez les lieux bibliques avec des cartes interactives.",
                "Consultez vos statistiques sur la page des points.",
                "Changez la taille de la police pour un confort de lecture.",
                "Saviez-vous que vous pouvez lire la Bible hors ligne ?"
            }
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String type = intent.getStringExtra("notification_type");
        String action = intent.getAction();

        Log.d(TAG, "onReceive: action=" + action + ", type=" + type);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            refreshAllAlarms(context);
            return;
        }

        if (type == null) return;

        String norm = normalizeType(type);
        String lang = getLang(context);

        if (norm.equals("updateAlerts")) {
            checkForUpdateAndNotify(context, lang);
            scheduleAlarm(context, type, getDefaultHour(type), 0);
            return;
        }

        switch (norm) {
            case "verse":
                handleVerseNotification(context, lang);
                break;
            case "question":
                handleQuestionNotification(context, lang);
                break;
            case "streak":
                handleStreakNotification(context, lang);
                break;
            case "studyPlans":
                handleStudyPlansNotification(context, lang);
                break;
            case "appSuggestions":
                handleTipNotification(context, lang);
                break;
            default:
                showNotification(context, "Agios", getLocalizedString("new_content", lang), 107, "/");
                break;
        }

        scheduleAlarm(context, type, getDefaultHour(type), 0);
    }

    private void checkForUpdateAndNotify(Context context, String lang) {
        try {
            AppUpdateManager appUpdateManager = AppUpdateManagerFactory.create(context);
            Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();
            appUpdateInfoTask.addOnSuccessListener(appUpdateInfo -> {
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                    showNotification(context, getLocalizedString("update_title", lang),
                            getLocalizedString("update_body", lang), 106, "/");
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error checking for updates", e);
        }
    }

    private void handleVerseNotification(Context context, String lang) {
        try {
            JSONObject refData = getTodayData(context, "dailyVerses.json", lang);
            if (refData == null) {
                showNotification(context, getLocalizedString("verse_title", lang), "...", 101, "/#daily-verse");
                return;
            }

            String bookId = refData.getString("book");
            int chapter = refData.getInt("chapter");
            int verseNum = refData.getInt("verse");

            // Load Bible Text
            String biblePath = getBibleFilePath(lang);
            JSONArray bibleArray = loadJsonArray(context, biblePath);
            String verseText = "";
            if (bibleArray != null) {
                for (int i = 0; i < bibleArray.length(); i++) {
                    JSONObject bookObj = bibleArray.getJSONObject(i);
                    if (bookObj.getString("abbrev").equalsIgnoreCase(bookId)) {
                        JSONArray chapters = bookObj.getJSONArray("chapters");
                        if (chapter <= chapters.length()) {
                            JSONArray verses = chapters.getJSONArray(chapter - 1);
                            if (verseNum <= verses.length()) {
                                verseText = verses.getString(verseNum - 1);
                            }
                        }
                        break;
                    }
                }
            }

            // Load Book Name
            String bookName = bookId;
            JSONObject allBookNames = loadJsonObject(context, "bookNames.json");
            if (allBookNames != null && allBookNames.has(lang)) {
                JSONArray langBooks = allBookNames.getJSONArray(lang);
                for (int i = 0; i < langBooks.length(); i++) {
                    JSONObject b = langBooks.getJSONObject(i);
                    if (b.getString("book_id").equalsIgnoreCase(bookId)) {
                        bookName = b.getString("name");
                        break;
                    }
                }
            }

            String cStr = lang.equals("ar") ? toArabicNumbers(chapter) : String.valueOf(chapter);
            String vStr = lang.equals("ar") ? toArabicNumbers(verseNum) : String.valueOf(verseNum);
            String title = String.format("%s %s:%s", bookName, cStr, vStr);

            if (verseText.isEmpty()) verseText = getLocalizedString("verse_title", lang);

            showNotification(context, title, verseText, 101, "/#daily-verse");
        } catch (Exception e) {
            Log.e(TAG, "Verse Notify Error", e);
            showNotification(context, getLocalizedString("verse_title", lang), "...", 101, "/#daily-verse");
        }
    }

    private void handleQuestionNotification(Context context, String lang) {
        try {
            String filename = "dailyQuestions_" + lang + ".json";
            String folder = getLanguageFolder(lang);

            JSONObject data = getTodayData(context, "translations/" + folder + filename, lang);
            if (data != null) {
                String question = data.optString("question", "");
                showNotification(context, getLocalizedString("question_title", lang), question, 102, "/#daily-question");
            }
        } catch (Exception e) {
            Log.e(TAG, "Question Notify Error", e);
        }
    }

    private void handleStreakNotification(Context context, String lang) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            int streak = 0;
            String streakStr = getPrefsString(prefs, "userStreak");
            if (!streakStr.isEmpty()) {
                try { streak = Integer.parseInt(streakStr); } catch (Exception e) {}
            }

            String msg;
            if (streak > 0) {
                String val = lang.equals("ar") ? toArabicNumbers(streak) : String.valueOf(streak);
                msg = String.format(getLocalizedString("streak_msg", lang), val);
            } else {
                msg = getLocalizedString("streak_start", lang);
            }
            showNotification(context, getLocalizedString("streak_title", lang), msg, 103, "/");
        } catch (Exception e) {
            Log.e(TAG, "Streak Notify Error", e);
        }
    }

    private void handleStudyPlansNotification(Context context, String lang) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String summaryJson = getPrefsString(prefs, "studyPlansSummary");
            if (!summaryJson.isEmpty()) {
                JSONObject json = new JSONObject(summaryJson);
                int count = json.optInt("count", 0);
                String title = json.optString("mainPlanTitle", "");
                int remaining = json.optInt("remainingDays", 0);

                String cStr = lang.equals("ar") ? toArabicNumbers(count) : String.valueOf(count);
                String rStr = lang.equals("ar") ? toArabicNumbers(remaining) : String.valueOf(remaining);

                String msg = count > 1
                        ? String.format(getLocalizedString("plans_msg_multi", lang), cStr, rStr, title)
                        : String.format(getLocalizedString("plans_msg_single", lang), rStr, title);

                showNotification(context, getLocalizedString("plans_title", lang), msg, 104, "/studyPlans");
            }
        } catch (Exception e) {
            Log.e(TAG, "StudyPlans Notify Error", e);
        }
    }

    private void handleTipNotification(Context context, String lang) {
        int langIdx = 0;
        if (lang.equals("en")) langIdx = 1;
        else if (lang.equals("de")) langIdx = 2;
        else if (lang.equals("fr")) langIdx = 3;

        String[] tips = localizedTips[langIdx];
        int index = (int) (Math.random() * tips.length);
        showNotification(context, getLocalizedString("tip_title", lang), tips[index], 105, "/");
    }

    private String getLanguageFolder(String lang) {
        switch (lang) {
            case "en": return "English/";
            case "fr": return "French/";
            case "de": return "german/";
            default: return "arabic/";
        }
    }

    private String getBibleFilePath(String lang) {
        String folder = getLanguageFolder(lang);
        switch (lang) {
            case "en": return "translations/" + folder + "en_web.json";
            case "fr": return "translations/" + folder + "fr_segond.json";
            case "de": return "translations/" + folder + "de_luther.json";
            default: return "translations/" + folder + "ar_svd_tashkeel_site.json";
        }
    }

    private JSONObject getTodayData(Context context, String path, String lang) {
        try {
            JSONArray array = loadJsonArray(context, path);
            if (array == null) return null;

            Calendar now = Calendar.getInstance(TimeZone.getTimeZone("Africa/Cairo"));
            int month = now.get(Calendar.MONTH) + 1;
            int day = now.get(Calendar.DAY_OF_MONTH);

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optInt("month") == month && obj.optInt("day") == day) {
                    return obj;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error matching today data: " + path);
        }
        return null;
    }

    private JSONArray loadJsonArray(Context context, String path) {
        try {
            String content = loadAssetString(context, path);
            if (content != null) return new JSONArray(content);
        } catch (Exception e) {
            Log.e(TAG, "Error loading JSON array: " + path);
        }
        return null;
    }

    private JSONObject loadJsonObject(Context context, String path) {
        try {
            String content = loadAssetString(context, path);
            if (content != null) return new JSONObject(content);
        } catch (Exception e) {
            Log.e(TAG, "Error loading JSON object: " + path);
        }
        return null;
    }

    private String loadAssetString(Context context, String path) {
        InputStream is = null;
        try {
            try {
                is = context.getAssets().open("public/data/" + path);
            } catch (Exception e) {
                try {
                    is = context.getAssets().open("data/" + path);
                } catch (Exception e2) {
                    is = context.getAssets().open(path);
                }
            }

            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            return new String(buffer, StandardCharsets.UTF_8);
        } catch (Exception e) {
            if (is != null) { try { is.close(); } catch (Exception ignored) {} }
            return null;
        }
    }

    private String toArabicNumbers(int number) {
        String n = String.valueOf(number);
        char[] arabicChars = {'٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'};
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < n.length(); i++) {
            if (Character.isDigit(n.charAt(i))) {
                builder.append(arabicChars[n.charAt(i) - '0']);
            } else {
                builder.append(n.charAt(i));
            }
        }
        return builder.toString();
    }

    private String normalizeType(String type) {
        if (type == null) return "";
        String low = type.toLowerCase();
        if (low.contains("verse")) return "verse";
        if (low.contains("question")) return "question";
        if (low.contains("streak")) return "streak";
        if (low.contains("study") || low.contains("plan")) return "studyPlans";
        if (low.contains("tip") || low.contains("suggestion")) return "appSuggestions";
        if (low.contains("update")) return "updateAlerts";
        return type;
    }

    private int getDefaultHour(String type) {
        switch (normalizeType(type)) {
            case "verse":           return 6;
            case "question":        return 18;
            case "studyPlans":      return 10;
            case "streak":          return 21;
            case "appSuggestions":  return 12;
            case "updateAlerts":    return 12;
            default:                return 12;
        }
    }

    public void refreshAllAlarms(Context context) {
        scheduleAlarm(context, "dailyVerse", 6, 0);
        scheduleAlarm(context, "dailyQuestion", 18, 0);
        scheduleAlarm(context, "studyPlans", 10, 0);
        scheduleAlarm(context, "streakReminder", 21, 0);
        scheduleAlarm(context, "appSuggestions", 12, 0);
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
            } catch (Exception e) {}
        }

        if (!enabled) {
            cancelAlarm(context, type);
            return;
        }

        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("Africa/Cairo"));
        if (!savedTime.isEmpty() && savedTime.contains(":")) {
            try {
                String[] p = savedTime.split(":");
                cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(p[0]));
                cal.set(Calendar.MINUTE, Integer.parseInt(p[1]));
            } catch (Exception e) {}
        } else {
            cal.set(Calendar.HOUR_OF_DAY, defH);
            cal.set(Calendar.MINUTE, defM);
        }

        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(Calendar.DATE, 1);

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
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    private void showNotification(Context context, String title, String text, int id, String deepLink) {
        String cid = "agios_notifications";
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(cid, "Agios Daily", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
        }
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (deepLink != null) intent.putExtra("deepLink", deepLink);
        PendingIntent pi = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int iconRes = context.getResources().getIdentifier("ic_stat_ic_notification", "drawable", context.getPackageName());
        if (iconRes == 0) iconRes = android.R.drawable.ic_dialog_info;

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, cid)
                .setSmallIcon(iconRes).setContentTitle(title).setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(pi);
        nm.notify(id, b.build());
    }
}
