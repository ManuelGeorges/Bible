package com.agios.bible;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;

public class StudyPlanWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        String lang = DataHelper.getLang(context);
        boolean isDark = DataHelper.isDarkTheme(context);
        
        Intent intent = new Intent(context, StudyPlanWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.study_plan_widget);
        
        // تطبيق الثيم المحسن
        views.setInt(R.id.widget_root, "setBackgroundResource", isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        views.setTextColor(R.id.widget_title, isDark ? Color.parseColor("#93C5FD") : Color.parseColor("#1E3A8A"));
        views.setInt(R.id.widget_divider, "setBackgroundColor", isDark ? Color.parseColor("#3B82F6") : Color.parseColor("#3B82F6"));
        views.setTextColor(R.id.widget_empty_view, isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B"));

        views.setRemoteAdapter(R.id.widget_plans_list, intent);
        
        String title = TranslationHelper.getString(context, "studyPlans.title", lang.equals("ar") ? "متابعة القراءة 📖" : "Continue Reading 📖");
        views.setTextViewText(R.id.widget_title, title);

        views.setEmptyView(R.id.widget_plans_list, R.id.widget_empty_view);
        String emptyText = TranslationHelper.getString(context, "studyPlans.empty.no_plans", lang.equals("ar") ? "ابدأ خطة جديدة اليوم" : "Start a new plan today");
        views.setTextViewText(R.id.widget_empty_view, emptyText);

        // فتح صفحة الخطط الدراسية
        Intent clickIntent = new Intent(context, MainActivity.class);
        clickIntent.putExtra("deepLink", "/studyPlans");
        clickIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId + 200, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_title, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_empty_view, pendingIntent);
        
        Intent itemClickIntent = new Intent(context, MainActivity.class);
        itemClickIntent.putExtra("deepLink", "/studyPlans");
        PendingIntent itemClickPendingIntent = PendingIntent.getActivity(context, appWidgetId + 300, itemClickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setPendingIntentTemplate(R.id.widget_plans_list, itemClickPendingIntent);

        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_plans_list);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
