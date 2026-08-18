package com.agios.bible;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.Scanner;

public class DataHelper {
    private static final String TAG = "AgiosDataHelper";
    private static final String CACHE_PREFS = "AgiosWidgetCache";
    
    private static String lastLoadedBiblePath = "";
    private static JSONArray cachedBibleArray = null;

    public static String getLang(Context context) {
        try {
            if (context == null) return "ar";
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

            String[] langKeys = {
                "i18nextLng",
                "language",
                "lang",
                "app_lang",
                "settings_lang",
                "selected_lang",
                "settings-language",
                "locale"
            };

            String lang = null;
            for (String key : langKeys) {
                lang = cleanCapacitorString(getPrefsString(prefs, key));
                if (lang != null && !lang.isEmpty()) break;
            }
            
            if (lang == null || lang.isEmpty()) {
                lang = Locale.getDefault().getLanguage();
            }

            if (lang == null || lang.isEmpty()) lang = "ar";
            lang = lang.toLowerCase().split("-")[0].split("_")[0];

            if (!lang.equals("ar") && !lang.equals("en") && !lang.equals("fr") && !lang.equals("de")) {
                lang = "ar";
            }

            return lang;
        } catch (Exception e) {
            return "ar";
        }
    }

    public static boolean isDarkTheme(Context context) {
        try {
            if (context == null) return false;
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String theme = cleanCapacitorString(getPrefsString(prefs, "theme"));
            if ("dark".equalsIgnoreCase(theme)) return true;
            if ("light".equalsIgnoreCase(theme)) return false;
            return (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        } catch (Exception e) {
            return false;
        }
    }

    public static void updateAllWidgets(Context context) {
        if (context == null) return;
        try {
            Context appCtx = context.getApplicationContext();
            AppWidgetManager am = AppWidgetManager.getInstance(appCtx);
            if (am == null) return;

            Class<?>[] providers = {
                VerseWidgetProvider.class, 
                QuestionWidgetProvider.class, 
                StudyPlanWidgetProvider.class, 
                PointsWidgetProvider.class
            };
            
            for (Class<?> provider : providers) {
                try {
                    ComponentName name = new ComponentName(appCtx, provider);
                    int[] ids = am.getAppWidgetIds(name);
                    if (ids != null && ids.length > 0) {
                        Intent intent = new Intent(appCtx, provider);
                        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                        appCtx.sendBroadcast(intent);
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    public static String cleanCapacitorString(String val) {
        if (val == null) return null;
        val = val.trim();
        if (val.equalsIgnoreCase("null")) return null;
        while (val.startsWith("\"") && val.endsWith("\"") && val.length() >= 2) {
            val = val.substring(1, val.length() - 1);
        }
        return val.replace("\\\"", "\"");
    }

    public static String getPrefsString(SharedPreferences prefs, String key) {
        if (prefs == null) return null;
        String val = prefs.getString("_cap_" + key, null);
        if (val == null) val = prefs.getString(key, null);
        return val;
    }

    public static String loadAssetString(Context context, String path) {
        if (context == null || path == null || path.isEmpty()) return null;

        // 1. محاولة التحميل من نظام الملفات (R2)
        try {
            File internalFile = new File(context.getFilesDir(), "translations/" + path);
            if (internalFile.exists()) {
                FileInputStream fis = new FileInputStream(internalFile);
                Scanner s = new Scanner(fis).useDelimiter("\\A");
                String res = s.hasNext() ? s.next() : "";
                fis.close();
                if (!res.isEmpty()) return res;
            }
        } catch (Exception ignored) {}
        
        // 2. محاولة التحميل من الأصول المدمجة
        String[] searchPaths = {
                path,
                "public/data/" + path,
                "public/data/translations/" + path,
                "data/" + path,
                "data/translations/" + path,
                "translations/" + path,
                "www/data/" + path,
                "www/" + path
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

    public static JSONObject getDailyVerse(Context context) {
        if (context == null) return null;
        String lang = getLang(context);
        Calendar now = Calendar.getInstance();
        int dayOfYear = now.get(Calendar.DAY_OF_YEAR);
        SharedPreferences cache = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE);
        String cacheKey = "dv_" + lang + "_" + dayOfYear;
        
        String cached = cache.getString(cacheKey, null);
        if (cached != null) {
            try { return new JSONObject(cached); } catch (Exception ignored) {}
        }

        String folder = getLanguageFolder(lang);
        String fileName = "dailyVerses_" + lang + ".json";
        
        JSONObject dataResult = null;
        String[] paths = {
            folder + fileName,
            "data/translations/" + folder + fileName,
            "dailyVerses.json",
            "data/dailyVerses.json",
            "dailyVerses_ar.json"
        };

        for (String path : paths) {
            dataResult = getTodayData(context, path);
            if (dataResult != null) break;
        }

        if (dataResult != null) {
            cache.edit().putString(cacheKey, dataResult.toString()).apply();
        }
        return dataResult;
    }

    public static JSONObject getDailyQuestion(Context context) {
        if (context == null) return null;
        String lang = getLang(context);
        Calendar now = Calendar.getInstance();
        int dayOfYear = now.get(Calendar.DAY_OF_YEAR);
        SharedPreferences cache = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE);
        String cacheKey = "dq_" + lang + "_" + dayOfYear;

        String cached = cache.getString(cacheKey, null);
        if (cached != null) {
            try { return new JSONObject(cached); } catch (Exception ignored) {}
        }

        String folder = getLanguageFolder(lang);
        String fileName = "dailyQuestions_" + lang + ".json";
        
        JSONObject dataResult = null;
        String[] paths = {
            folder + fileName,
            "data/translations/" + folder + fileName,
            "dailyQuestions.json",
            "data/dailyQuestions.json"
        };

        for (String path : paths) {
            dataResult = getTodayData(context, path);
            if (dataResult != null) break;
        }

        if (dataResult != null) {
            cache.edit().putString(cacheKey, dataResult.toString()).apply();
        }
        return dataResult;
    }

    public static JSONObject getTodayData(Context context, String path) {
        try {
            String content = loadAssetString(context, path);
            if (content == null || content.isEmpty()) return null;
            
            JSONArray array = new JSONArray(content);
            Calendar now = Calendar.getInstance();
            int month = now.get(Calendar.MONTH) + 1;
            int day = now.get(Calendar.DAY_OF_MONTH);
            
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optInt("month") == month && obj.optInt("day") == day) return obj;
            }
        } catch (Exception ignored) {}
        return null;
    }

    public static List<JSONObject> getStudyPlansList(Context context) {
        List<JSONObject> planList = new ArrayList<>();
        try {
            if (context == null) return planList;
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String summaryRaw = getPrefsString(prefs, "studyPlansSummary");
            String summaryJson = cleanCapacitorString(summaryRaw);
            
            if (summaryJson != null && !summaryJson.isEmpty()) {
                if (summaryJson.startsWith("[")) {
                    JSONArray array = new JSONArray(summaryJson);
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject obj = array.optJSONObject(i);
                        if (obj != null) planList.add(obj);
                    }
                } else if (summaryJson.startsWith("{")) {
                    planList.add(new JSONObject(summaryJson));
                }
            }
        } catch (Exception ignored) {}
        return planList;
    }

    public static synchronized String getVerseFromBible(Context context, String lang, String bookId, int chapter, int verseNum) {
        if (context == null) return "";
        SharedPreferences cache = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE);
        String cacheKey = "vtext_" + lang + "_" + bookId + "_" + chapter + "_" + verseNum;
        String cachedText = cache.getString(cacheKey, null);
        if (cachedText != null) return cachedText;

        try {
            String bibleFile = getBibleFilePath(lang);
            
            if (!lastLoadedBiblePath.equals(bibleFile) || cachedBibleArray == null) {
                String content = loadAssetString(context, bibleFile);
                if (content == null || content.isEmpty()) return "";
                cachedBibleArray = new JSONArray(content);
                lastLoadedBiblePath = bibleFile;
            }
            
            for (int i = 0; i < cachedBibleArray.length(); i++) {
                JSONObject bookObj = cachedBibleArray.getJSONObject(i);
                String bAbbrev = bookObj.optString("abbrev", "");
                String bId = bookObj.optString("id", "");
                String bBookId = bookObj.optString("book_id", "");
                
                if (bAbbrev.equalsIgnoreCase(bookId) || 
                    bId.equalsIgnoreCase(bookId) ||
                    bBookId.equalsIgnoreCase(bookId)) {
                    
                    JSONArray chapters = bookObj.getJSONArray("chapters");
                    if (chapter > 0 && chapter <= chapters.length()) {
                        JSONArray verses = chapters.getJSONArray(chapter - 1);
                        if (verseNum > 0 && verseNum <= verses.length()) {
                            String result = verses.getString(verseNum - 1);
                            cache.edit().putString(cacheKey, result).apply();
                            return result;
                        }
                    }
                    break;
                }
            }
        } catch (Exception ignored) {}
        return "";
    }

    public static String getBibleFilePath(String lang) {
        String folder = getLanguageFolder(lang);
        switch (lang) {
            case "en": return folder + "en_web.json";
            case "fr": return folder + "fr_segond.json";
            case "de": return folder + "de_luther.json";
            default: return folder + "ar_svd_tashkeel_site.json";
        }
    }

    public static String getBookName(Context context, String lang, String bookId) {
        try {
            String content = loadAssetString(context, "bookNames.json");
            if (content != null) {
                JSONObject allNames = new JSONObject(content);
                String lookupLang = lang;
                if (!allNames.has(lookupLang)) lookupLang = "ar";
                
                JSONArray books = allNames.getJSONArray(lookupLang);
                for (int i = 0; i < books.length(); i++) {
                    JSONObject b = books.getJSONObject(i);
                    if (b.optString("book_id").equalsIgnoreCase(bookId) || 
                        b.optString("id").equalsIgnoreCase(bookId) ||
                        b.optString("abbrev").equalsIgnoreCase(bookId)) {
                        return b.getString("name");
                    }
                }
            }
        } catch (Exception ignored) {}
        return bookId;
    }

    public static String getLanguageFolder(String lang) {
        switch (lang) {
            case "en": return "English/";
            case "fr": return "French/";
            case "de": return "german/";
            default: return "arabic/";
        }
    }

    public static String toArabicNumbers(int number) {
        String n = String.valueOf(number);
        char[] arabicChars = {'٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'};
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < n.length(); i++) {
            char c = n.charAt(i);
            if (c >= '0' && c <= '9') builder.append(arabicChars[c - '0']);
            else builder.append(c);
        }
        return builder.toString();
    }
}
