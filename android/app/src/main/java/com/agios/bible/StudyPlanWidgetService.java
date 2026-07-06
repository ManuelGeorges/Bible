package com.agios.bible;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.util.Log;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class StudyPlanWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new StudyPlanWidgetItemFactory(getApplicationContext());
    }
}

class StudyPlanWidgetItemFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<JSONObject> planList = new ArrayList<>();
    private String currentLang = "ar";
    private boolean isDark = false;

    public StudyPlanWidgetItemFactory(Context context) {
        this.context = context;
    }

    private void loadData() {
        try {
            planList.clear();
            this.currentLang = DataHelper.getLang(context);
            this.isDark = DataHelper.isDarkTheme(context);
            
            // جلب القائمة باستخدام المساعد الذي ينظف بيانات Capacitor
            List<JSONObject> rawPlans = DataHelper.getStudyPlansList(context);
            if (rawPlans != null) {
                planList.addAll(rawPlans);
            }
        } catch (Exception e) {
            Log.e("AgiosWidgetService", "Error loading data: " + e.getMessage());
        }
    }

    @Override
    public void onCreate() {
        loadData();
    }

    @Override
    public void onDataSetChanged() {
        loadData();
    }

    @Override
    public void onDestroy() {
        planList.clear();
    }

    @Override
    public int getCount() {
        return planList.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position >= planList.size()) return null;

        try {
            JSONObject plan = planList.get(position);
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.item_study_plan_widget);
            
            String title = plan.optString("title", "");
            
            // معالجة النسبة المئوية (قد تأتي كـ String أو Int من Capacitor)
            int percent = 0;
            Object percentObj = plan.opt("percent");
            if (percentObj == null) percentObj = plan.opt("progress");
            
            if (percentObj instanceof Number) {
                percent = ((Number) percentObj).intValue();
            } else if (percentObj instanceof String) {
                try {
                    percent = Integer.parseInt(((String) percentObj).replaceAll("[^0-9]", ""));
                } catch (Exception ignored) {}
            }

            // معالجة الأيام المتبقية
            int remaining = -1;
            Object remObj = plan.opt("remainingDays");
            if (remObj instanceof Number) {
                remaining = ((Number) remObj).intValue();
            } else if (remObj instanceof String) {
                try {
                    remaining = Integer.parseInt(((String) remObj).replaceAll("[^0-9]", ""));
                } catch (Exception ignored) {}
            }
            
            String statusText = (currentLang.equals("ar") ? DataHelper.toArabicNumbers(percent) : String.valueOf(percent)) + "%";
            
            if (remaining >= 0) {
                String rStr = currentLang.equals("ar") ? DataHelper.toArabicNumbers(remaining) : String.valueOf(remaining);
                String leftLabel = currentLang.equals("ar") ? "متبقي" : "left";
                String daysLabel = currentLang.equals("ar") ? "يوم" : "days";
                statusText += " • " + leftLabel + " " + rStr + " " + daysLabel;
            }

            views.setTextViewText(R.id.item_plan_name, title);
            views.setProgressBar(R.id.item_plan_progress, 100, percent, false);
            views.setTextViewText(R.id.item_plan_status, statusText);
            
            // الثيم
            views.setTextColor(R.id.item_plan_name, isDark ? Color.parseColor("#E2E8F0") : Color.parseColor("#1E293B"));
            views.setTextColor(R.id.item_plan_status, isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B"));

            // تمكين الضغط على العنصر لفتح الخطة داخل التطبيق
            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("deepLink", "/studyPlans");
            views.setOnClickFillInIntent(R.id.widget_item_root, fillInIntent);

            return views;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public RemoteViews getLoadingView() { return null; }

    @Override
    public int getViewTypeCount() { return 1; }

    @Override
    public long getItemId(int position) { return position; }

    @Override
    public boolean hasStableIds() { return true; }
}
