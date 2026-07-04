package com.agios.bible;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

public class PointsWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String lang = DataHelper.getLang(context);
        boolean isDark = DataHelper.isDarkTheme(context);

        String points = DataHelper.cleanCapacitorString(DataHelper.getPrefsString(prefs, "userPoints"));
        String streak = DataHelper.cleanCapacitorString(DataHelper.getPrefsString(prefs, "userStreak"));
        
        if (points == null || points.isEmpty()) points = "0";
        if (streak == null || streak.isEmpty()) streak = "0";

        if (lang.equals("ar")) {
            try {
                points = DataHelper.toArabicNumbers(Integer.parseInt(points));
                streak = DataHelper.toArabicNumbers(Integer.parseInt(streak));
            } catch (Exception ignored) {}
        }

        String title = TranslationHelper.getString(context, "points.title", lang.equals("ar") ? "نقاطي" : "My Points");
        String pointsLabel = lang.equals("ar") ? "نقطة" : "Points";
        String streakTemplate = TranslationHelper.getString(context, "points.streak_label", "🔥 {streak}");
        String streakDisplay = streakTemplate.replace("{streak}", streak);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.points_widget);
        
        // تطبيق الثيم المحسن
        views.setInt(R.id.widget_root, "setBackgroundResource", isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        views.setTextColor(R.id.widget_title, isDark ? Color.parseColor("#93C5FD") : Color.parseColor("#1E3A8A"));
        views.setTextColor(R.id.widget_points_value, isDark ? Color.parseColor("#F8FAFC") : Color.parseColor("#0F172A"));
        views.setTextColor(R.id.widget_points_label, isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B"));
        
        // تخصيص مظهر الـ Streak بناءً على الثيم
        if (isDark) {
            views.setTextColor(R.id.widget_streak_value, Color.parseColor("#FDBA74"));
            // في حالة الدارك مود نستخدم لون خلفية داكن للـ Streak
            // ملحوظة: setInt مع setBackgroundColor قد لا يظهر الحواف المستديرة، يفضل استخدام Drawable
        } else {
            views.setTextColor(R.id.widget_streak_value, Color.parseColor("#D97706"));
        }

        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_points_value, points);
        views.setTextViewText(R.id.widget_points_label, pointsLabel);
        views.setTextViewText(R.id.widget_streak_value, streakDisplay);

        // إضافة حدث الضغط لفتح صفحة النقاط
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("deepLink", "/#points");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId + 100, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
