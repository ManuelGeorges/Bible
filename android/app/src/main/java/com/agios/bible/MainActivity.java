package com.agios.bible; // تأكد إن ده اسم الباكيدج بتاعك

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // مش محتاج تضيف كود لـ Firebase هنا، الـ Plugin بيعمل ده لوحده 
        // بس تأكد إن الـ BridgeActivity موجودة صح
    }
}