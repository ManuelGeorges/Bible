import subprocess
import sys
import os

def install_requirements():
    """تثبيت المتطلبات تلقائياً"""
    print("📦 تثبيت المكتبات المطلوبة...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def download_nltk_data():
    """تحميل بيانات NLTK"""
    print("📚 تحميل بيانات NLTK...")
    import nltk
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt', quiet=True)

def download_stanza_model():
    """تحميل نموذج Stanza العربي"""
    print("🧠 تحميل نموذج Stanza العربي (قد يستغرق وقتاً)...")
    try:
        import stanza
        stanza.download('ar', verbose=False)
    except Exception as e:
        print(f"⚠️ لم يتم تحميل Stanza: {e}")

def main():
    print("🔧 إعداد بيئة العمل...")
    
    try:
        install_requirements()
        download_nltk_data()
        download_stanza_model()
        
        print("✅ تم الإعداد بنجاح!")
        print("🚀 بدء تشغيل الخدمة...")
        
        # تشغيل التطبيق
        from app import app
        app.run(host='0.0.0.0', port=5000, debug=True)
        
    except Exception as e:
        print(f"❌ خطأ في الإعداد: {e}")

if __name__ == "__main__":
    main()