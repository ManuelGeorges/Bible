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
import java.util.Scanner;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.tasks.Task;

public class AgiosNotificationReceiver extends BroadcastReceiver {
    private static final String TAG = "AgiosDebug";

    private String getLang(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

        // محاولة جلب اللغة من عدة مفاتيح محتملة يستخدمها Capacitor
        String[] langKeys = {"language", "app_lang", "settings_lang", "selected_lang", "settings-language"};
        String lang = null;
        for (String key : langKeys) {
            lang = cleanCapacitorString(getPrefsString(prefs, key));
            if (lang != null && !lang.isEmpty()) break;
        }
        
        if (lang == null || lang.isEmpty()) lang = "ar";
        lang = lang.toLowerCase();
        if (lang.contains("-")) lang = lang.split("-")[0]; // en-US -> en
        return lang;
    }

    private String cleanCapacitorString(String val) {
        if (val == null) return null;
        val = val.trim();
        // تنظيف النصوص من علامات التنصيص الزائدة التي قد يضيفها Capacitor Storage
        while (val.startsWith("\"") && val.endsWith("\"") && val.length() >= 2) {
            val = val.substring(1, val.length() - 1);
        }
        val = val.replace("\\\"", "\"");
        return val;
    }

    private String getLocalizedString(String key, String lang) {
        Map<String, Map<String, String>> translations = new HashMap<>();

        // Arabic
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

        // English
        Map<String, String> en = new HashMap<>();
        en.put("verse_title", "Verse of the Day");
        en.put("question_title", "Daily Question");
        en.put("streak_title", "Keep your streak!");
        en.put("plans_title", "Continue Reading 📖");
        en.put("tip_title", "Quick Tip");
        en.put("update_title", "New Update Available");
        en.put("update_body", "A new version of Agios is available, download it now!");
        en.put("streak_msg", "You're on a %s day streak! Don't forget to read today's verse 🔥");
        en.put("streak_start", "Start your streak today! Read the verse to build a habit.");
        en.put("plans_msg_multi", "You have %s ongoing plans. %s days left in %s");
        en.put("plans_msg_single", "You have %s days left to complete %s");
        en.put("new_content", "You have new spiritual content ✨");
        translations.put("en", en);

        // French
        Map<String, String> fr = new HashMap<>();
        fr.put("verse_title", "Verset du jour");
        fr.put("question_title", "Question du jour");
        fr.put("streak_title", "Maintenez votre série !");
        fr.put("plans_title", "Continuer la lecture 📖");
        fr.put("tip_title", "Conseil rapide");
        fr.put("update_title", "Nouvelle mise à jour disponible");
        fr.put("update_body", "Une nouvelle version d'Agios est disponible, téléchargez-la maintenant !");
        fr.put("streak_msg", "Vous avez une série de %s jours ! N'oubliez pas de lire le verset d'aujourd'hui 🔥");
        fr.put("streak_start", "Commencez votre série aujourd'hui ! Lisez le verset pour créer une habitude.");
        fr.put("plans_msg_multi", "Vous avez %s plans en cours. %s jours restants dans %s");
        fr.put("plans_msg_single", "Il vous reste %s jours pour terminer %s");
        fr.put("new_content", "Vous avez un nouveau contenu spirituel ✨");
        translations.put("fr", fr);

        // German
        Map<String, String> de = new HashMap<>();
        de.put("verse_title", "Vers des Tages");
        de.put("question_title", "Frage des Tages");
        de.put("streak_title", "Halte deinen Streak!");
        de.put("plans_title", "Weiterlesen 📖");
        de.put("tip_title", "Kurzer Tipp");
        de.put("update_title", "Update verfügbar");
        de.put("update_body", "Eine neue Version von Agios ist da!");
        de.put("streak_msg", "Du hast einen Streak von %s Tagen! Vergiss nicht, den heutigen Vers zu lesen 🔥");
        de.put("streak_start", "Beginne heute deinen Streak! Lies den Vers, um eine Gewohnheit aufzubauen.");
        de.put("plans_msg_multi", "%s laufende Pläne. %s Tage verbleibend in %s");
        de.put("plans_msg_single", "Noch %s Tage, um %s abzuschließen");
        de.put("new_content", "Neue geistliche Inhalte ✨");
        translations.put("de", de);

        Map<String, String> langMap = translations.get(lang);
        if (langMap == null) langMap = translations.get("ar");
        String result = langMap.get(key);
        return (result != null) ? result : key;
    }

    private final String[][] localizedTips = {
            { // Arabic (Index 0)
                    "هل جربت ميزة البحث بالمشتقات في الكتاب المقدس؟",
                    "يمكنك إنشاء خطة قراءة مخصصة تناسبك باستخدام مساعد أجيوس الذكي",
                    "يمكنك تظليل الآيات التي تعجبك باللون الذي يريحك وكتابة ملحوظات عليها",
                    "استكشف الأماكن الكتابية الآن عبر الخرائط التفاعلية",
                    "لا تنسَ مراجعة إحصائياتك وأوسمتك في صفحة النقاط",
                    "يمكنك تغيير حجم خط القراءة من صفحة الإعدادات لراحة عينيك.",
                    "هل تعلم أن بإمكانك قراءة الكتاب المقدس بدون إنترنت؟"
            },
            { // English (Index 1)
                    "Have you tried the Bible search feature?",
                    "Create a custom reading plan with Agios AI assistant.",
                    "Highlight verses and add personal notes.",
                    "Explore biblical places with interactive maps.",
                    "Check your stats and badges in the points page.",
                    "Change font size in settings for comfortable reading.",
                    "Did you know you can read the Bible offline?"
            },
            { // French (Index 2)
                    "Avez-vous essayé la recherche dans la Bible ?",
                    "Créez un plan de lecture personnalisé avec l'IA.",
                    "Surlignez les versets et ajouteز des notes.",
                    "Explorez les lieux bibliques sur les cartes.",
                    "Consultez vos statistiques sur la page des points.",
                    "Changez la taille du texte pour votre confort.",
                    "Saviez-vous que vous pouvez lire la Bible hors ligne ?"
            },
            { // German (Index 3)
                    "Hast du die Bibelsuche schon ausproبيert?",
                    "Erstelle einen Plan mit dem KI-Assistenten.",
                    "Markiere Verse und füge Notizen hinzu.",
                    "Erkunde biblische Orte auf der Karte.",
                    "Prüfe deine Abzeichen auf der Punkteseite.",
                    "Passe die Schriftgröße in den Einstellungen an.",
                    "Wusstest du, dass du die Bible offline lesen kannst?"
            }
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String type = intent.getStringExtra("notification_type");
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.d(TAG, "Boot completed, refreshing all alarms");
            refreshAllAlarms(context);
            return;
        }

        if (type == null) return;
        String norm = normalizeType(type);
        String lang = getLang(context);
        Log.d(TAG, "Agios Receiver fired: " + type + " (norm: " + norm + "), Lang: " + lang);

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
        // جدولة المرة القادمة
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

    // تم تحديث دالة handleVerseNotification في ملف:
// F:/AlMalak system/Agios Bible/website/android/app/src/main/java/com/agios/bible/AgiosNotificationReceiver.java

private void handleVerseNotification(Context context, String lang) {
    try {
        String folder = getLanguageFolder(lang);
        String localizedFileName = "dailyVerses_" + lang + ".json";
        
        // 1. محاولة تحميل البيانات من عدة مسارات محتملة (الترجمة أولاً)
        JSONObject refData = getTodayData(context, folder + localizedFileName, lang);
        if (refData == null) refData = getTodayData(context, "translations/" + folder + localizedFileName, lang);
        if (refData == null) refData = getTodayData(context, "data/translations/" + folder + localizedFileName, lang);
        if (refData == null) refData = getTodayData(context,"data/dailyVerses.json", lang);

        if (refData == null) {
            showNotification(context, getLocalizedString("verse_title", lang), "...", 101, "/#daily-verse");
            return;
        }

        // 2. إذا كانت البيانات تحتوي على مفاتيح هيكلية (سفر، إصحاح، آية)
        if (refData.has("book") || refData.has("bookId")) {
            String bookId = refData.optString("book", refData.optString("bookId"));
            int chapter = refData.optInt("chapter", 1);
            int verseNum = refData.optInt("verse", 1);

            // جلب نص الآية من ملف ترجمة الكتاب المقدس المتوافق مع لغة المستخدم
            String biblePath = getBibleFilePath(lang);
            JSONArray bibleArray = loadJsonArray(context, biblePath);
            String verseText = "";
            if (bibleArray != null) {
                for (int i = 0; i < bibleArray.length(); i++) {
                    JSONObject bookObj = bibleArray.getJSONObject(i);
                    if (bookObj.optString("abbrev").equalsIgnoreCase(bookId)) {
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

            // جلب اسم السفر المترجم
            String bookName = bookId;
            JSONObject allBookNames = loadJsonObject(context, "bookNames.json");
            if (allBookNames != null && allBookNames.has(lang)) {
                JSONArray langBooks = allBookNames.getJSONArray(lang);
                for (int i = 0; i < langBooks.length(); i++) {
                    JSONObject b = langBooks.getJSONObject(i);
                    if (b.optString("book_id").equalsIgnoreCase(bookId)) {
                        bookName = b.getString("name");
                        break;
                    }
                }
            }

            String cStr = lang.equals("ar") ? toArabicNumbers(chapter) : String.valueOf(chapter);
            String vStr = lang.equals("ar") ? toArabicNumbers(verseNum) : String.valueOf(verseNum);
            String title = String.format("%s %s:%s", bookName, cStr, vStr);

            if (verseText.isEmpty()) verseText = refData.optString("verse", "...");
            showNotification(context, title, verseText, 101, "/#daily-verse");
        } 
        // 3. إذا كان الملف يحتوي على نص جاهز (مثل النسخة العربية الافتراضية)
        else if (refData.has("verse")) {
            String verseText = refData.getString("verse");
            // إذا كانت اللغة ليست العربية، والنص يبدو عربياً، يفضل إظهار "آية اليوم" باللغة الصحيحة كعنوان
            String title = refData.optString("reference", getLocalizedString("verse_title", lang));
            showNotification(context, title, verseText, 101, "/#daily-verse");
        }
    } catch (Exception e) {
        Log.e(TAG, "Verse Notify Error", e);
        showNotification(context, getLocalizedString("verse_title", lang), "...", 101, "/#daily-verse");
    }
}

    private void handleQuestionNotification(Context context, String lang) {
        try {
            String folder = getLanguageFolder(lang);
            String localizedFileName = "dailyQuestions_" + lang + ".json";
            
            JSONObject data = getTodayData(context, folder + localizedFileName, lang);
            if (data == null) data = getTodayData(context, "public/translations/" + folder + localizedFileName, lang);
            if (data == null) data = getTodayData(context, "public/data/translations/" + folder + localizedFileName, lang);
            if (data == null) data = getTodayData(context, "dailyQuestions.json", lang);

            if (data != null) {
                String question = data.optString("question", "...");
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
            String streakStr = cleanCapacitorString(getPrefsString(prefs, "userStreak"));
            if (streakStr != null && !streakStr.isEmpty()) {
                try { streak = Integer.parseInt(streakStr); } catch (Exception e) {}
            }

            String msg = (streak > 0)
                    ? String.format(getLocalizedString("streak_msg", lang), (lang.equals("ar") ? toArabicNumbers(streak) : String.valueOf(streak)))
                    : getLocalizedString("streak_start", lang);
            showNotification(context, getLocalizedString("streak_title", lang), msg, 103, "/");
        } catch (Exception e) {
            Log.e(TAG, "Streak Notify Error", e);
        }
    }

    private void handleStudyPlansNotification(Context context, String lang) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String summaryRaw = getPrefsString(prefs, "studyPlansSummary");
            String summaryJson = cleanCapacitorString(summaryRaw);
            
            Log.d(TAG, "Handling study plans. Raw: " + summaryRaw + ", Clean: " + summaryJson);

            if (summaryJson == null || summaryJson.isEmpty()) {
                Log.d(TAG, "Study plans summary is empty. Skipping notification.");
                return;
            }

            String msg = null;
            // Case 1: It's an array of plans
            if (summaryJson.startsWith("[")) {
                JSONArray plans = new JSONArray(summaryJson);
                int count = plans.length();
                if (count > 0) {
                    JSONObject main = plans.getJSONObject(0);
                    String title = main.optString("title", "");
                    int remaining = main.optInt("remainingDays", -1);
                    String cStr = lang.equals("ar") ? toArabicNumbers(count) : String.valueOf(count);

                    if (remaining >= 0) {
                        String rStr = lang.equals("ar") ? toArabicNumbers(remaining) : String.valueOf(remaining);
                        if (count > 1) {
                            msg = String.format(getLocalizedString("plans_msg_multi", lang), cStr, rStr, title);
                        } else {
                            msg = String.format(getLocalizedString("plans_msg_single", lang), rStr, title);
                        }
                    } else if (!title.isEmpty()) {
                        msg = getLocalizedString("plans_title", lang) + ": " + title;
                    }
                }
            } 
            // Case 2: It's a single plan object
            else if (summaryJson.startsWith("{")) {
                JSONObject plan = new JSONObject(summaryJson);
                String title = plan.optString("title", "");
                int remaining = plan.optInt("remainingDays", -1);
                String rStr = lang.equals("ar") ? toArabicNumbers(remaining) : String.valueOf(remaining);
                
                if (remaining >= 0) {
                    msg = String.format(getLocalizedString("plans_msg_single", lang), rStr, title);
                } else if (!title.isEmpty()) {
                    msg = getLocalizedString("plans_title", lang) + ": " + title;
                }
            }

            if (msg != null) {
                Log.d(TAG, "Showing study plans notification: " + msg);
                showNotification(context, getLocalizedString("plans_title", lang), msg, 104, "/studyPlans");
            } else {
                Log.d(TAG, "Could not construct study plans message from JSON: " + summaryJson);
            }
        } catch (Exception e) {
            Log.e(TAG, "StudyPlans Notify Error", e);
        }
    }

    private void handleTipNotification(Context context, String lang) {
        int langIdx = 0;
        if (lang.equals("en")) langIdx = 1;
        else if (lang.equals("fr")) langIdx = 2;
        else if (lang.equals("de")) langIdx = 3;

        String[] tips = localizedTips[langIdx];
        int index = (int) (Math.random() * tips.length);
        showNotification(context, getLocalizedString("tip_title", lang), tips[index], 105, "/");
    }

    private String getBibleFilePath(String lang) {
        String folder = getLanguageFolder(lang);
        switch (lang) {
            case "en": return folder + "en_web.json";
            case "fr": return folder + "fr_segond.json";
            case "de": return folder + "de_luther.json";
            default: return folder + "ar_svd_tashkeel_site.json";
        }
    }

    private String getLanguageFolder(String lang) {
        switch (lang) {
            case "en": return "English/";
            case "fr": return "French/";
            case "de": return "german/";
            default: return "arabic/";
        }
    }

    private JSONObject getTodayData(Context context, String path, String lang) {
        try {
            JSONArray array = loadJsonArray(context, path);
            if (array == null) return null;

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
            Log.e(TAG, "Error matching today data for: " + path);
        }
        return null;
    }

    private JSONArray loadJsonArray(Context context, String path) {
        try {
            String content = loadAssetString(context, path);
            if (content != null && !content.isEmpty()) return new JSONArray(content);
        } catch (Exception e) {
            Log.e(TAG, "Error loading JSON array: " + path);
        }
        return null;
    }

    private JSONObject loadJsonObject(Context context, String path) {
        try {
            String content = loadAssetString(context, path);
            if (content != null && !content.isEmpty()) return new JSONObject(content);
        } catch (Exception e) {
            Log.e(TAG, "Error loading JSON object: " + path);
        }
        return null;
    }

    private String loadAssetString(Context context, String path) {
        String[] searchPaths = {
                path,
                "public/" + path,
                "public/translations/" + path,
                "public/data/" + path,
                "public/data/translations/" + path,
                "www/" + path,
                "www/data/" + path,
                "data/" + path,
                "translations/" + path,
                "arabic/" + path
        };

        for (String p : searchPaths) {
            try (InputStream is = context.getAssets().open(p)) {
                Scanner s = new Scanner(is).useDelimiter("\\A");
                String res = s.hasNext() ? s.next() : "";
                if (!res.isEmpty()) return res;
            } catch (Exception ignored) {}
        }
        return null;
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
        Log.d(TAG, "Refreshing all notification alarms");
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
        String master = cleanCapacitorString(getPrefsString(prefs, "masterNotifications"));

        if ("false".equals(master)) {
            Log.d(TAG, "Master notifications disabled, cancelling alarm for: " + type);
            cancelAlarm(context, type);
            return;
        }

        String savedTime = "";
        boolean enabled = true;
        String norm = normalizeType(type);

        String jsonStr = getPrefsString(prefs, "notificationSettings");
        if (jsonStr != null && !jsonStr.isEmpty()) {
            try {
                JSONObject json = new JSONObject(cleanCapacitorString(jsonStr));
                savedTime = json.optString(norm + "Time", json.optString(type + "Time", ""));
                if (json.has(norm)) enabled = json.optBoolean(norm, true);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing notification settings for: " + type, e);
            }
        }

        if (!enabled) {
            Log.d(TAG, "Alarm disabled for: " + type + ", cancelling.");
            cancelAlarm(context, type);
            return;
        }

        Calendar cal = Calendar.getInstance();
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
        Log.d(TAG, "Scheduled alarm: " + type + " at " + cal.get(Calendar.HOUR_OF_DAY) + ":" + cal.get(Calendar.MINUTE));
    }

    private String getPrefsString(SharedPreferences prefs, String key) {
        String val = prefs.getString("_cap_" + key, null);
        if (val == null) val = prefs.getString(key, null);
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
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);
        nm.notify(id, b.build());
    }
}
