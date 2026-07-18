# قواعد حماية وتصغير الكود (ProGuard/R8) لتطبيق Agios Bible

# Capacitor Core
-keep class com.getcapacitor.** { *; }
-keep  class * extends com.getcapacitor.Plugin
-keep  class * extends com.getcapacitor.Bridge
-keep  class * extends com.getcapacitor.BridgeActivity
-keep  class * extends com.getcapacitor.MessageHandler

# Firebase & Google Services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Facebook SDK (Optional dependency for Firebase Auth plugin)
-dontwarn com.facebook.**

# الحفاظ على واجهات البرمجة الخاصة بالـ WebView
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keep class com.agios.bible.** {
    @android.webkit.JavascriptInterface <methods>;
}

# تشفير أسماء الملفات الأصلية مع الإبقاء على أرقام الأسطر لـ Crashlytics
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# تقليل حجم الكود وتحسينه
-optimizationpasses 5
-allowaccessmodification
-mergeinterfacesaggressively

# منع حذف الأكواد المتعلقة بـ Native Settings Plugins
-keep class com.cyphrbits.native_settings.** { *; }
