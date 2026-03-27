package com.agios.bible;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen; // ضيف السطر ده
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // السطر ده هو اللي بيربط الـ Theme الجديد بالـ Activity
        SplashScreen.installSplashScreen(this); 
        
        super.onCreate(savedInstanceState);
    }
}