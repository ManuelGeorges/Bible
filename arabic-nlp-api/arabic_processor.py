# نظام استخراج الجذور والاشتقاقات الأوتوماتيكي بالكامل
# تنصيب المكتبات المطلوبة:
# pip install camel-tools qalsadi nltk stanza torch transformers flask flask-cors

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
from typing import List, Dict, Set
import re

# === CAMeL Tools - الأقوى للجذور والتصريف ===
try:
    from camel_tools.morphology.database import MorphologyDB
    from camel_tools.morphology.analyzer import Analyzer
    from camel_tools.morphology.generator import Generator
    from camel_tools.utils.normalize import normalize_alef_maksura_ar, normalize_alef_ar, normalize_teh_marbuta_ar
    from camel_tools.tokenizers.word import simple_word_tokenize
    
    # تحميل قاعدة البيانات
    db = MorphologyDB.builtin_db()
    analyzer = Analyzer(db)
    generator = Generator(db)
    CAMEL_AVAILABLE = True
    print("✅ CAMeL Tools محمل ومتاح")
    
except ImportError as e:
    print(f"❌ CAMeL Tools غير متوفر: {e}")
    CAMEL_AVAILABLE = False

# === Qalsadi - للتحليل الصرفي المتقدم ===
try:
    import qalsadi.lemmatizer as lemmatizer
    from qalsadi.stem_noun import StemNoun  
    from qalsadi.stem_verb import StemVerb
    import qalsadi.analex as analex
    
    lemmer = lemmatizer.Lemmatizer()
    noun_stemmer = StemNoun()
    verb_stemmer = StemVerb()
    analyzer_qalsadi = analex.Analex()
    QALSADI_AVAILABLE = True
    print("✅ Qalsadi محمل ومتاح")
    
except ImportError as e:
    print(f"❌ Qalsadi غير متوفر: {e}")
    QALSADI_AVAILABLE = False

# === NLTK للمعالجة التكميلية ===
try:
    import nltk
    from nltk.corpus import stopwords
    
    # تحميل البيانات المطلوبة
    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        nltk.download('stopwords')
    
    arabic_stopwords = set(stopwords.words('arabic'))
    NLTK_AVAILABLE = True
    print("✅ NLTK محمل ومتاح")
    
except ImportError as e:
    print(f"❌ NLTK غير متوفر: {e}")
    NLTK_AVAILABLE = False

# === Stanza للتحليل العميق ===
try:
    import stanza
    
    # تحميل النموذج العربي (يتم تحميله مرة واحدة فقط)
    try:
        nlp_stanza = stanza.Pipeline('ar', processors='tokenize,mwt,pos,lemma,depparse')
        STANZA_AVAILABLE = True
        print("✅ Stanza محمل ومتاح")
    except Exception as e:
        print(f"❌ Stanza غير متاح: {e}")
        STANZA_AVAILABLE = False
        
except ImportError as e:
    print(f"❌ Stanza غير متوفر: {e}")
    STANZA_AVAILABLE = False

app = Flask(__name__)
CORS(app)

class AdvancedArabicMorphologyProcessor:
    def __init__(self):
        self.setup_logging()
        self.cache = {}  # كاش للنتائج المحسوبة مسبقاً
        
    def setup_logging(self):
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def normalize_arabic_text(self, text: str) -> str:
        """تطبيع النص العربي باستخدام CAMeL Tools"""
        if not text:
            return ""
            
        if CAMEL_AVAILABLE:
            text = normalize_alef_ar(text)
            text = normalize_alef_maksura_ar(text) 
            text = normalize_teh_marbuta_ar(text)
            # إزالة التشكيل
            text = re.sub(r'[\u064B-\u0652]', '', text)
            return text.strip()
        
        # تطبيع يدوي كبديل
        text = re.sub(r'[\u064B-\u0652]', '', text)  # إزالة التشكيل
        text = re.sub(r'[أآإ]', 'ا', text)  # توحيد الألف
        text = re.sub(r'ى', 'ي', text)  # توحيد الياء
        text = re.sub(r'ة', 'ه', text)  # توحيد التاء المربوطة
        return text.strip()

    def extract_roots_camel(self, word: str) -> Dict:
        """استخراج الجذور باستخدام CAMeL Tools - الأكثر دقة"""
        if not CAMEL_AVAILABLE:
            return {'root': None, 'lemma': None, 'pos': None, 'features': {}}
            
        try:
            # تحليل الكلمة
            analyses = analyzer.analyze(word)
            
            if not analyses:
                return {'root': None, 'lemma': None, 'pos': None, 'features': {}}
            
            # أخذ أفضل تحليل (الأول عادة هو الأفضل)
            best_analysis = analyses[0]
            
            root = best_analysis.get('root', '')
            lemma = best_analysis.get('lex', '')
            pos = best_analysis.get('pos', '')
            
            # استخراج المعلومات الصرفية
            features = {
                'aspect': best_analysis.get('asp', ''),
                'mood': best_analysis.get('mod', ''),
                'person': best_analysis.get('per', ''),
                'number': best_analysis.get('num', ''),
                'gender': best_analysis.get('gen', ''),
                'voice': best_analysis.get('vox', ''),
                'case': best_analysis.get('cas', ''),
                'state': best_analysis.get('stt', '')
            }
            
            # تنظيف الجذر
            if root and root != 'NOAN' and root != 'NOUN_PROP':
                root = self.normalize_arabic_text(root)
            else:
                root = None
                
            return {
                'root': root,
                'lemma': self.normalize_arabic_text(lemma) if lemma else None,
                'pos': pos,
                'features': features,
                'confidence': 'high'
            }
            
        except Exception as e:
            self.logger.error(f"خطأ في CAMeL Tools: {e}")
            return {'root': None, 'lemma': None, 'pos': None, 'features': {}}

    def extract_roots_qalsadi(self, word: str) -> Dict:
        """استخراج الجذور باستخدام Qalsadi"""
        if not QALSADI_AVAILABLE:
            return {'root': None, 'lemma': None, 'pos': None}
            
        try:
            # تحليل شامل للكلمة
            analysis_results = analyzer_qalsadi.check_word(word)
            
            if analysis_results:
                # أخذ أول نتيجة
                result = analysis_results[0]
                root = result.get('root', '')
                lemma = result.get('vocalized', '') or result.get('unvocalized', '')
                word_type = result.get('type', '')
                
                return {
                    'root': self.normalize_arabic_text(root) if root else None,
                    'lemma': self.normalize_arabic_text(lemma) if lemma else None, 
                    'pos': word_type,
                    'confidence': 'medium'
                }
                
            # محاولة التحليل كاسم
            noun_results = noun_stemmer.stemming_noun(word)
            if noun_results:
                result = noun_results[0]
                return {
                    'root': result.get('root'),
                    'lemma': result.get('lemma', word),
                    'pos': 'noun',
                    'confidence': 'medium'
                }
                
            # محاولة التحليل كفعل
            verb_results = verb_stemmer.stemming_verb(word)
            if verb_results:
                result = verb_results[0]
                return {
                    'root': result.get('root'),
                    'lemma': result.get('lemma', word),
                    'pos': 'verb', 
                    'confidence': 'medium'
                }
                
        except Exception as e:
            self.logger.error(f"خطأ في Qalsadi: {e}")
            
        return {'root': None, 'lemma': None, 'pos': None}

    def extract_roots_stanza(self, word: str) -> Dict:
        """استخراج الجذور باستخدام Stanza"""
        if not STANZA_AVAILABLE:
            return {'root': None, 'lemma': None, 'pos': None}
            
        try:
            doc = nlp_stanza(word)
            
            if doc.sentences and doc.sentences[0].words:
                word_info = doc.sentences[0].words[0]
                return {
                    'root': None,  # Stanza لا يستخرج الجذور مباشرة
                    'lemma': self.normalize_arabic_text(word_info.lemma),
                    'pos': word_info.upos,
                    'confidence': 'medium'
                }
                
        except Exception as e:
            self.logger.error(f"خطأ في Stanza: {e}")
            
        return {'root': None, 'lemma': None, 'pos': None}

    def generate_derivatives_automatic(self, root: str, pos_hint: str = None) -> List[str]:
        """توليد المشتقات أوتوماتيكياً باستخدام CAMeL Tools Generator"""
        if not CAMEL_AVAILABLE or not root or len(root) < 2:
            return []
            
        try:
            derivatives = set()
            
            # توليد تصريفات مختلفة للجذر
            # محاولة توليد أفعال
            verb_specs = [
                {'pos': 'verb', 'asp': 'perf', 'per': '3', 'num': 'sg', 'gen': 'm'},
                {'pos': 'verb', 'asp': 'imperf', 'per': '3', 'num': 'sg', 'gen': 'm'},
                {'pos': 'verb', 'asp': 'perf', 'per': '1', 'num': 'sg'},
                {'pos': 'verb', 'asp': 'imperf', 'per': '1', 'num': 'sg'},
            ]
            
            # محاولة توليد أسماء
            noun_specs = [
                {'pos': 'noun', 'num': 'sg', 'gen': 'm', 'cas': 'nom'},
                {'pos': 'noun', 'num': 'pl', 'gen': 'm', 'cas': 'nom'},
                {'pos': 'noun', 'num': 'sg', 'gen': 'f', 'cas': 'nom'},
            ]
            
            # محاولة توليد صفات
            adj_specs = [
                {'pos': 'adj', 'num': 'sg', 'gen': 'm', 'cas': 'nom'},
                {'pos': 'adj', 'num': 'sg', 'gen': 'f', 'cas': 'nom'},
            ]
            
            all_specs = verb_specs + noun_specs + adj_specs
            
            for spec in all_specs:
                try:
                    spec['root'] = root
                    generated = generator.generate(spec)
                    
                    for generation in generated:
                        word = generation.get('diac', '') or generation.get('form', '')
                        if word:
                            # إزالة التشكيل وإضافة للمشتقات
                            clean_word = re.sub(r'[\u064B-\u0652]', '', word)
                            if len(clean_word) >= 2:
                                derivatives.add(clean_word)
                                
                except Exception as e:
                    continue
                    
            return list(derivatives)[:50]  # حدود معقولة
            
        except Exception as e:
            self.logger.error(f"خطأ في توليد المشتقات: {e}")
            return []

    def get_comprehensive_analysis(self, word: str) -> Dict:
        """تحليل شامل للكلمة باستخدام جميع المكتبات المتاحة"""
        word = self.normalize_arabic_text(word)
        
        # التحقق من الكاش
        if word in self.cache:
            return self.cache[word]
        
        # تحليل باستخدام CAMeL Tools (الأولوية الأولى)
        camel_result = self.extract_roots_camel(word)
        
        # تحليل باستخدام Qalsadi (كدعم إضافي)
        qalsadi_result = self.extract_roots_qalsadi(word)
        
        # تحليل باستخدام Stanza (للمعلومات النحوية)
        stanza_result = self.extract_roots_stanza(word)
        
        # دمج النتائج بذكاء
        final_root = camel_result.get('root') or qalsadi_result.get('root')
        final_lemma = camel_result.get('lemma') or qalsadi_result.get('lemma') or stanza_result.get('lemma')
        final_pos = camel_result.get('pos') or qalsadi_result.get('pos') or stanza_result.get('pos')
        
        # توليد المشتقات أوتوماتيكياً
        derivatives = []
        if final_root:
            derivatives = self.generate_derivatives_automatic(final_root, final_pos)
        
        result = {
            'word': word,
            'root': final_root,
            'lemma': final_lemma,
            'pos': final_pos,
            'derivatives': derivatives,
            'morphological_features': camel_result.get('features', {}),
            'analysis_sources': {
                'camel_available': CAMEL_AVAILABLE,
                'qalsadi_available': QALSADI_AVAILABLE,
                'stanza_available': STANZA_AVAILABLE
            },
            'confidence': camel_result.get('confidence', 'low')
        }
        
        # حفظ في الكاش
        self.cache[word] = result
        return result

# إنشاء معالج عالمي
processor = AdvancedArabicMorphologyProcessor()

@app.route('/analyze_word', methods=['POST'])
def analyze_word():
    """تحليل كلمة واحدة"""
    try:
        data = request.get_json()
        word = data.get('word', '').strip()
        
        if not word:
            return jsonify({'error': 'الكلمة مطلوبة'}), 400
            
        result = processor.get_comprehensive_analysis(word)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search_derivatives', methods=['POST'])
def search_derivatives():
    """البحث بالمشتقات الأوتوماتيكية"""
    try:
        data = request.get_json()
        search_term = data.get('search_term', '').strip()
        text_corpus = data.get('text_corpus', [])
        
        if not search_term:
            return jsonify({'error': 'مصطلح البحث مطلوب'}), 400
        
        # تحليل مصطلح البحث
        analysis = processor.get_comprehensive_analysis(search_term)
        
        # البحث في النصوص
        search_results = []
        if text_corpus and analysis.get('derivatives'):
            # إنشاء نمط البحث من المشتقات
            derivatives_pattern = '|'.join([re.escape(d) for d in analysis['derivatives'][:30]])
            search_regex = re.compile(f'({derivatives_pattern})', re.IGNORECASE)
            
            for i, text_item in enumerate(text_corpus):
                text = text_item.get('text', '')
                normalized_text = processor.normalize_arabic_text(text)
                
                if search_regex.search(normalized_text):
                    # إبراز الكلمات المطابقة
                    highlighted_text = search_regex.sub(r'<mark>\1</mark>', text)
                    
                    search_results.append({
                        'index': i,
                        'original_text': text,
                        'highlighted_text': highlighted_text,
                        'matches': search_regex.findall(normalized_text),
                        **text_item
                    })
        
        return jsonify({
            'search_term': search_term,
            'analysis': analysis,
            'results_count': len(search_results),
            'results': search_results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/batch_analyze', methods=['POST'])
def batch_analyze():
    """تحليل دفعة من الكلمات"""
    try:
        data = request.get_json()
        words = data.get('words', [])
        
        if not words:
            return jsonify({'error': 'قائمة الكلمات مطلوبة'}), 400
        
        results = {}
        for word in words[:100]:  # حد أقصى 100 كلمة
            if word.strip():
                results[word] = processor.get_comprehensive_analysis(word.strip())
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """فحص حالة الخدمة"""
    return jsonify({
        'status': 'running',
        'libraries': {
            'camel_tools': CAMEL_AVAILABLE,
            'qalsadi': QALSADI_AVAILABLE,
            'stanza': STANZA_AVAILABLE,
            'nltk': NLTK_AVAILABLE
        },
        'cache_size': len(processor.cache)
    })

if __name__ == '__main__':
    print("🚀 بدء تشغيل خدمة معالجة اللغة العربية الأوتوماتيكية")
    print("📚 المكتبات المتاحة:")
    print(f"   - CAMeL Tools: {'✅' if CAMEL_AVAILABLE else '❌'}")
    print(f"   - Qalsadi: {'✅' if QALSADI_AVAILABLE else '❌'}")
    print(f"   - Stanza: {'✅' if STANZA_AVAILABLE else '❌'}")
    print(f"   - NLTK: {'✅' if NLTK_AVAILABLE else '❌'}")
    
    app.run(host='0.0.0.0', port=5000, debug=False)