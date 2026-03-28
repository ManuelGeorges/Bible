package com.agios.bible;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 1. تثبيت الـ Splash Screen أولاً
        SplashScreen.installSplashScreen(this);
        
        // 2. استدعاء الـ super.onCreate (هام جداً أن يكون قبل التسجيل في بعض النسخ)
        super.onCreate(savedInstanceState);
        
        // 3. تسجيل البلجن يدوياً للتأكد من ربطه بالـ Bridge
        registerPlugin(NativeSettingsCustom.class);
    }
}

// أضفت كلمة public لضمان وصول الـ Bridge للكلاس بسهولة
@CapacitorPlugin(name = "NativeSettingsCustom")
class NativeSettingsCustom extends Plugin {
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            // إضافة Flag لضمان فتح النشاط حتى لو كان السياق غير نشط
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getLocalizedMessage());
        }
    }
}