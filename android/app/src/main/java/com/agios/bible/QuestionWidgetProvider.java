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

public class QuestionWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "AgiosQuestionWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        String lang = DataHelper.getLang(context);
        boolean isDark = DataHelper.isDarkTheme(context);
        String question = "...";

        try {
            // استخدام نفس منطق الإشعارات لجلب سؤال اليوم
            JSONObject data = DataHelper.getTodayData(context, "dailyQuestions.json", lang);
            if (data != null) {
                question = data.optString("question", "...");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error matching today question", e);
        }

        String title = TranslationHelper.getString(context, "home.daily_challenge", lang.equals("ar") ? "سؤال اليوم" : "Daily Question");
        String buttonText = TranslationHelper.getString(context, "common.details", lang.equals("ar") ? "جاوب الآن" : "Answer Now");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.question_widget);
        
        // تطبيق الثيم
        views.setInt(R.id.widget_root, "setBackgroundResource", isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        views.setTextColor(R.id.widget_title, isDark ? Color.parseColor("#60A5FA") : Color.parseColor("#1E3A8A"));
        views.setTextColor(R.id.widget_question_text, isDark ? Color.parseColor("#E2E8F0") : Color.parseColor("#333333"));
        
        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_question_text, question);
        views.setTextViewText(R.id.widget_action_btn, buttonText);

        // فتح صفحة السؤال عند الضغط
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("deepLink", "/#daily-question");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId + 400, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_action_btn, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
