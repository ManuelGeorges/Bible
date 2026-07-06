package com.agios.bible;

import android.content.Context;
import android.util.Log;
import org.json.JSONObject;

public class TranslationHelper {
    private static final String TAG = "AgiosTranslation";
    private static JSONObject translations;
    private static String currentLang = "";

    public static String getString(Context context, String keyPath, String defaultValue) {
        try {
            String lang = DataHelper.getLang(context);

            if (translations == null || !currentLang.equals(lang)) {
                currentLang = lang;
                translations = loadTranslationFile(context, lang);
            }

            if (translations == null) return defaultValue;

            String[] keys = keyPath.split("\\.");
            JSONObject current = translations;
            for (int i = 0; i < keys.length - 1; i++) {
                if (current.has(keys[i])) {
                    current = current.getJSONObject(keys[i]);
                } else {
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
        String[] possibleFileNames = {
            lang + ".json",
            folder + lang + ".json",
            lang.toLowerCase() + ".json"
        };
        
        for (String fileName : possibleFileNames) {
            // تم تصحيح المسارات هنا (حذف assets/ والتركيز على المسارات الفعلية)
            String content = DataHelper.loadAssetString(context, "data/translations/" + fileName);
            if (content == null) content = DataHelper.loadAssetString(context, "translations/" + fileName);
            if (content == null) content = DataHelper.loadAssetString(context, fileName);

            try {
                if (content != null && !content.isEmpty()) {
                    Log.d(TAG, "Successfully loaded translation: " + fileName);
                    return new JSONObject(content);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing JSON: " + fileName);
            }
        }
        return null;
    }
}
