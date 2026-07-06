package com.agios.bible;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.util.Log;
import android.widget.RemoteViews;

public class StudyPlanWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "AgiosStudyPlanWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                for (int appWidgetId : appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error updating study plan widget", e);
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
            
            Intent serviceIntent = new Intent(context, StudyPlanWidgetService.class);
            serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.study_plan_widget);
            
            int bgRes = isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light;
            int titleColor = isDark ? Color.parseColor("#93C5FD") : Color.parseColor("#1E3A8A");
            int dividerColor = Color.parseColor("#3B82F6");
            int emptyTextColor = isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B");

            views.setInt(R.id.widget_root, "setBackgroundResource", bgRes);
            views.setTextColor(R.id.widget_title, titleColor);
            views.setInt(R.id.widget_divider, "setBackgroundColor", dividerColor);
            views.setTextColor(R.id.widget_empty_view, emptyTextColor);

            views.setRemoteAdapter(R.id.widget_plans_list, serviceIntent);
            
            String title = TranslationHelper.getString(context, "studyPlans.title", lang.equals("ar") ? "متابعة القراءة 📖" : "Continue Reading 📖");
            views.setTextViewText(R.id.widget_title, title);

            views.setEmptyView(R.id.widget_plans_list, R.id.widget_empty_view);
            String emptyText = TranslationHelper.getString(context, "studyPlans.empty.no_plans", lang.equals("ar") ? "ابدأ خطة جديدة اليوم" : "Start a new plan today");
            views.setTextViewText(R.id.widget_empty_view, emptyText);

            // Intent عام لفتح التطبيق على صفحة الخطط
            Intent mainIntent = new Intent(context, MainActivity.class);
            mainIntent.putExtra("deepLink", "/studyPlans");
            mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // نستخدم requestCode فريد لكل نوع من الويدجت لضمان عدم تداخل الـ Intents
            PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId + 200, mainIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            
            // ربط الضغط على الخلفية، العنوان، والشاشة الفارغة
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
            views.setOnClickPendingIntent(R.id.widget_title, pendingIntent);
            views.setOnClickPendingIntent(R.id.widget_empty_view, pendingIntent);
            
            // Template للضغط على عناصر القائمة لفتح التطبيق أيضاً
            Intent itemClickIntent = new Intent(context, MainActivity.class);
            itemClickIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent itemClickPendingIntent = PendingIntent.getActivity(context, appWidgetId + 300, itemClickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setPendingIntentTemplate(R.id.widget_plans_list, itemClickPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_plans_list);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update study plan widget UI", e);
        }
    }
}
