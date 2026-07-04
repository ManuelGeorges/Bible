package com.agios.bible;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.Calendar;
import java.util.Locale;
import java.util.Scanner;

public class DataHelper {
    private static final String TAG = "AgiosDataHelper";

    public static String getLang(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String[] langKeys = {"language", "app_lang", "settings_lang", "selected_lang", "settings-language", "lang", "locale"};
        String lang = null;
        for (String key : langKeys) {
            lang = cleanCapacitorString(getPrefsString(prefs, key));
            if (lang != null && !lang.isEmpty()) break;
        }
        if (lang == null || lang.isEmpty()) lang = "ar";
        lang = lang.toLowerCase();
        if (lang.contains("-")) lang = lang.split("-")[0];
        return lang;
    }

    public static boolean isDarkTheme(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String theme = cleanCapacitorString(getPrefsString(prefs, "theme"));
            if ("dark".equalsIgnoreCase(theme)) return true;
            if ("light".equalsIgnoreCase(theme)) return false;
            int nightModeFlags = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            return nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
        } catch (Exception e) {
            return false;
        }
    }

    public static String cleanCapacitorString(String val) {
        if (val == null) return null;
        val = val.trim();
        while (val.startsWith("\"") && val.endsWith("\"") && val.length() >= 2) {
            val = val.substring(1, val.length() - 1);
        }
        val = val.replace("\\\"", "\"");
        return val;
    }

    public static String getPrefsString(SharedPreferences prefs, String key) {
        String val = prefs.getString("_cap_" + key, null);
        if (val == null) val = prefs.getString(key, null);
        return val;
    }

    public static String loadAssetString(Context context, String path) {
        // هذه المسارات متطابقة تماماً مع منطق الإشعارات (AgiosNotificationReceiver)
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
                if (obj.optInt("month") == month && obj.optInt("day") == day) {
                    return obj;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error matching today data for: " + path);
        }
        return null;
    }

    public static String getVerseFromBible(Context context, String lang, String bookId, int chapter, int verseNum) {
        try {
            String biblePath = getBibleFilePath(lang);
            String content = loadAssetString(context, biblePath);
            if (content == null) return "";

            JSONArray bibleArray = new JSONArray(content);
            for (int i = 0; i < bibleArray.length(); i++) {
                JSONObject bookObj = bibleArray.getJSONObject(i);
                if (bookObj.optString("abbrev").equalsIgnoreCase(bookId)) {
                    JSONArray chapters = bookObj.getJSONArray("chapters");
                    if (chapter <= chapters.length()) {
                        JSONArray verses = chapters.getJSONArray(chapter - 1);
                        if (verseNum <= verses.length()) {
                            return verses.getString(verseNum - 1);
                        }
                    }
                    break;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Bible Lookup Error: " + e.getMessage());
        }
        return "";
    }

    public static String getBookName(Context context, String lang, String bookId) {
        try {
            String content = loadAssetString(context, "bookNames.json");
            if (content != null) {
                JSONObject allNames = new JSONObject(content);
                if (allNames.has(lang)) {
                    JSONArray langBooks = allNames.getJSONArray(lang);
                    for (int i = 0; i < langBooks.length(); i++) {
                        JSONObject b = langBooks.getJSONObject(i);
                        if (b.optString("book_id").equalsIgnoreCase(bookId)) {
                            return b.getString("name");
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return bookId;
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
            if (Character.isDigit(n.charAt(i))) {
                builder.append(arabicChars[n.charAt(i) - '0']);
            } else {
                builder.append(n.charAt(i));
            }
        }
        return builder.toString();
    }
}
