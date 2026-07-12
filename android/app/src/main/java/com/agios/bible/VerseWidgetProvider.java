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
        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                for (int appWidgetId : appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId);
                }
            } catch (Exception e) {
                Log.e(TAG, "Critical error in VerseWidgetProvider", e);
            } finally {
                try {
                    pendingResult.finish();
                } catch (Exception ignored) {}
            }
        }).start();
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            String lang = DataHelper.getLang(context);
            boolean isDark = DataHelper.isDarkTheme(context);

            String verseText = "";
            String reference = "";
            
            JSONObject refData = DataHelper.getDailyVerse(context);

            if (refData != null) {
                // محاولة جلب المعرفات (إذا كانت موجودة في ملف اللغة المحدد)
                String bookId = refData.optString("book", refData.optString("bookId", ""));
                int chapter = refData.optInt("chapter", -1);
                int verseNum = refData.optInt("verse", -1);

                if (!bookId.isEmpty() && chapter != -1 && verseNum != -1) {
                    verseText = DataHelper.getVerseFromBible(context, lang, bookId, chapter, verseNum);
                    String bookName = DataHelper.getBookName(context, lang, bookId);
                    String cStr = lang.equals("ar") ? DataHelper.toArabicNumbers(chapter) : String.valueOf(chapter);
                    String vStr = lang.equals("ar") ? DataHelper.toArabicNumbers(verseNum) : String.valueOf(verseNum);
                    reference = String.format("%s %s:%s", bookName, cStr, vStr);
                } 
                
                // إذا لم نجد نصاً (مثلاً الملف الأساسي لا يحتوي على معرفات)، نستخدم النص المباشر
                // ملاحظة: إذا كان lang ليس ar، سيبحث DataHelper عن dailyVerses_en.json مثلاً
                if (verseText == null || verseText.isEmpty()) {
                    verseText = refData.optString("verse", "");
                    reference = refData.optString("reference", "");
                }
            }

            // نصوص افتراضية مترجمة في حالة الفشل
            if (verseText == null || verseText.isEmpty()) {
                if (lang.equals("ar")) {
                    verseText = "اُدْعُنِي فِي يَوْمِ الضِّيقِ أُنْقِذْكَ فَتُمَجِّدَنِي";
                    reference = "(مزمور ٥٠:١٥)";
                } else if (lang.equals("fr")) {
                    verseText = "Invoque-moi au jour de la détresse; Je te délivrerai, et tu me glorifieras.";
                    reference = "(Psaume 50:15)";
                } else if (lang.equals("de")) {
                    verseText = "Rufe mich an in der Zeit der Not, so will ich dich erretten, und du sollst mich preisen.";
                    reference = "(Psalm 50:15)";
                } else {
                    verseText = "Call upon me in the day of trouble; I will deliver you, and you shall glorify me.";
                    reference = "(Psalm 50:15)";
                }
            }

            // جلب العنوان المترجم
            String title = TranslationHelper.getString(context, "home.daily_verse", lang.equals("ar") ? "آية اليوم" : "Verse of the Day");

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.verse_widget);
            
            int bgRes = isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light;
            int titleColor = isDark ? Color.parseColor("#93C5FD") : Color.parseColor("#1E3A8A");
            int dividerColor = Color.parseColor("#3B82F6");
            int textColor = isDark ? Color.parseColor("#CBD5E1") : Color.parseColor("#334155");
            int refColor = isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B");

            views.setInt(R.id.widget_root, "setBackgroundResource", bgRes);
            views.setTextColor(R.id.widget_title, titleColor);
            views.setInt(R.id.widget_divider, "setBackgroundColor", dividerColor);
            views.setTextColor(R.id.widget_verse_text, textColor);
            views.setTextColor(R.id.widget_verse_ref, refColor);

            views.setTextViewText(R.id.widget_title, title);
            views.setTextViewText(R.id.widget_verse_text, verseText);
            views.setTextViewText(R.id.widget_verse_ref, reference);

            Intent intent = new Intent(context, MainActivity.class);
            intent.putExtra("deepLink", "/#daily-verse");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            Log.e(TAG, "Error updating verse widget UI", e);
        }
    }
}
