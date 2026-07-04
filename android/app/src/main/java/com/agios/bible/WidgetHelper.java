package com.agios.bible;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class WidgetHelper {
    private static final String TAG = "AgiosWidgetHelper";

    public static void updateAllWidgets(Context context) {
        Log.d(TAG, "Updating all widgets...");
        Class<?>[] providers = {
            VerseWidgetProvider.class,
            QuestionWidgetProvider.class,
            StudyPlanWidgetProvider.class,
            PointsWidgetProvider.class
        };
        
        for (Class<?> provider : providers) {
            Intent intent = new Intent(context, provider);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length > 0) {
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(intent);
            }
        }
    }
}