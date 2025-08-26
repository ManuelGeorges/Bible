from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from arabic_processor import AdvancedArabicMorphologyProcessor

load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','))

# إنشاء معالج واحد لجميع الطلبات
processor = AdvancedArabicMorphologyProcessor()

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'running',
        'message': 'Arabic NLP API is working!',
        'endpoints': ['/analyze_word', '/search_derivatives', '/batch_analyze']
    })

@app.route('/analyze_word', methods=['POST'])
def analyze_word():
    try:
        data = request.get_json()
        word = data.get('word', '').strip()
        
        if not word:
            return jsonify({'error': 'الكلمة مطلوبة'}), 400
            
        result = processor.get_comprehensive_analysis(word)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('FLASK_RUN_PORT', 5000))
    host = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
    
    print("🚀 بدء تشغيل خدمة معالجة اللغة العربية")
    app.run(host=host, port=port, debug=True)