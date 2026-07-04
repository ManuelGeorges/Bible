package com.agios.bible;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.util.Log;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
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

    public StudyPlanWidgetItemFactory(Context context) {
        this.context = context;
    }

    private void loadData() {
        planList.clear();
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String summaryRaw = DataHelper.getPrefsString(prefs, "studyPlansSummary");
            String summaryJson = DataHelper.cleanCapacitorString(summaryRaw);

            if (summaryJson != null && !summaryJson.isEmpty()) {
                if (summaryJson.startsWith("[")) {
                    JSONArray plans = new JSONArray(summaryJson);
                    for (int i = 0; i < plans.length(); i++) {
                        planList.add(plans.getJSONObject(i));
                    }
                } else if (summaryJson.startsWith("{")) {
                    planList.add(new JSONObject(summaryJson));
                }
            }
        } catch (Exception e) {
            Log.e("StudyPlanWidget", "Error loading plans for list", e);
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
            int percent = plan.optInt("percent", plan.optInt("progress", 0));
            int remaining = plan.optInt("remainingDays", -1);
            
            String lang = DataHelper.getLang(context);
            boolean isDark = DataHelper.isDarkTheme(context);
            
            // تشكيل نص الحالة ليطابق منطق الإشعارات (النسبة + الأيام المتبقية)
            String statusText = (lang.equals("ar") ? DataHelper.toArabicNumbers(percent) : String.valueOf(percent)) + "%";
            
            if (remaining >= 0) {
                String rStr = lang.equals("ar") ? DataHelper.toArabicNumbers(remaining) : String.valueOf(remaining);
                String leftLabel = lang.equals("ar") ? "متبقي" : "left";
                String daysLabel = lang.equals("ar") ? "يوم" : "days";
                statusText += " • " + leftLabel + " " + rStr + " " + daysLabel;
            }

            views.setTextViewText(R.id.item_plan_name, title);
            views.setProgressBar(R.id.item_plan_progress, 100, percent, false);
            views.setTextViewText(R.id.item_plan_status, statusText);
            
            // تطبيق الألوان حسب الثيم
            views.setTextColor(R.id.item_plan_name, isDark ? Color.parseColor("#E2E8F0") : Color.parseColor("#1E293B"));
            views.setTextColor(R.id.item_plan_status, isDark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B"));

            // إضافة Intent لفتح الخطة عند الضغط
            Intent fillInIntent = new Intent();
            views.setOnClickFillInIntent(R.id.widget_item_root, fillInIntent);

            return views;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return true;
    }
}
