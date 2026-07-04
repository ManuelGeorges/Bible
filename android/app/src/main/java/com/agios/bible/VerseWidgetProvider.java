package com.agios.bible;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.util.Log;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class VerseWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "AgiosVerseWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        String lang = DataHelper.getLang(context);
        boolean isDark = DataHelper.isDarkTheme(context);
        String folder = DataHelper.getLanguageFolder(lang);
        String localizedFileName = "dailyVerses_" + lang + ".json";

        String verseText = "";
        String reference = "";
        
        // محاولة جلب البيانات بنفس مسارات الإشعارات تماماً
        JSONObject refData = DataHelper.getTodayData(context, folder + localizedFileName);
        if (refData == null) refData = DataHelper.getTodayData(context, "translations/" + folder + localizedFileName);
        if (refData == null) refData = DataHelper.getTodayData(context, "data/translations/" + folder + localizedFileName);
        if (refData == null) refData = DataHelper.getTodayData(context, "data/dailyVerses.json");
        if (refData == null) refData = DataHelper.getTodayData(context, "dailyVerses.json");

        if (refData != null) {
            if (refData.has("book") || refData.has("bookId")) {
                String bookId = refData.optString("book", refData.optString("bookId", ""));
                int chapter = refData.optInt("chapter", 1);
                int verseNum = refData.optInt("verse", 1);

                if (!bookId.isEmpty()) {
                    verseText = DataHelper.getVerseFromBible(context, lang, bookId, chapter, verseNum);
                    String bookName = DataHelper.getBookName(context, lang, bookId);
                    String cStr = lang.equals("ar") ? DataHelper.toArabicNumbers(chapter) : String.valueOf(chapter);
                    String vStr = lang.equals("ar") ? DataHelper.toArabicNumbers(verseNum) : String.valueOf(verseNum);
                    reference = String.format("%s %s:%s", bookName, cStr, vStr);
                }
            } 
            
            if (verseText.isEmpty()) {
                verseText = refData.optString("verse", "...");
                reference = refData.optString("reference", "");
            }
        }

        String title = TranslationHelper.getString(context, "home.daily_verse", lang.equals("ar") ? "آية اليوم" : "Verse of the Day");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.verse_widget);
        
        // الألوان والثيم
        views.setInt(R.id.widget_root, "setBackgroundResource", isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        views.setTextColor(R.id.widget_title, isDark ? Color.parseColor("#93C5FD") : Color.parseColor("#1E3A8A"));
        views.setInt(R.id.widget_divider, "setBackgroundColor", isDark ? Color.parseColor("#3B82F6") : Color.parseColor("#3B82F6"));
        views.setTextColor(R.id.widget_verse_text, isDark ? Color.parseColor("#CBD5E1") : Color.parseColor("#334155"));
        views.setTextColor(R.id.widget_verse_ref, isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B"));

        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_verse_text, verseText.isEmpty() ? "..." : verseText);
        views.setTextViewText(R.id.widget_verse_ref, reference);

        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("deepLink", "/#daily-verse");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
