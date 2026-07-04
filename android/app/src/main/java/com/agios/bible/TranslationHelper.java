package com.agios.bible;

import android.content.Context;
import android.util.Log;
import org.json.JSONObject;

public class TranslationHelper {
    private static final String TAG = "AgiosTranslation";
    private static JSONObject translations;
    private static String currentLang = "";

    /**
     * جلب نص مترجم من ملفات الـ JSON بناءً على لغة التطبيق الحالية
     */
    public static String getString(Context context, String keyPath, String defaultValue) {
        try {
            String lang = DataHelper.getLang(context);

            // إعادة تحميل ملف الترجمة إذا تغيرت اللغة أو كانت المرة الأولى
            if (translations == null || !currentLang.equals(lang)) {
                currentLang = lang;
                translations = loadTranslationFile(context, lang);
            }

            if (translations == null) {
                Log.w(TAG, "Translations object is null for lang: " + lang);
                return defaultValue;
            }

            // التنقل داخل هيكلية الـ JSON (مثلاً "home.daily_verse")
            String[] keys = keyPath.split("\\.");
            JSONObject current = translations;
            for (int i = 0; i < keys.length - 1; i++) {
                if (current.has(keys[i])) {
                    current = current.getJSONObject(keys[i]);
                } else {
                    Log.w(TAG, "Key path not found: " + keys[i] + " in " + keyPath);
                    return defaultValue;
                }
            }
            
            String result = current.optString(keys[keys.length - 1], defaultValue);
            return (result == null || result.isEmpty()) ? defaultValue : result;

        } catch (Exception e) {
            Log.e(TAG, "Error getting string: " + keyPath, e);
            return defaultValue;
        }
    }

    private static JSONObject loadTranslationFile(Context context, String lang) {
        String folder = DataHelper.getLanguageFolder(lang);
        // تجربة أسماء ملفات مختلفة (ar.json أو French/fr.json)
        String[] possibleFileNames = {
            lang + ".json",
            folder + lang + ".json",
            folder.toLowerCase() + lang + ".json"
        };
        
        for (String fileName : possibleFileNames) {
            // محاولة التحميل من المسارات المختلفة
            String content = DataHelper.loadAssetString(context, "data/translations/" + fileName);
            if (content == null) content = DataHelper.loadAssetString(context, "translations/" + fileName);
            if (content == null) content = DataHelper.loadAssetString(context, "assets/data/translations/" + fileName);

            try {
                if (content != null) {
                    Log.d(TAG, "Successfully loaded translation file: " + fileName);
                    return new JSONObject(content);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing JSON for: " + fileName, e);
            }
        }

        return null;
    }
}