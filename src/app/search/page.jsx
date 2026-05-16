      geminiCache[term] = currentInfo;

      // بادجة سرية: كاسر المنطق (استخدام NLP للبحث ٣ مرات)
      const nlpCount = parseInt(localStorage.getItem('nlp_search_count') || '0') + 1;
      localStorage.setItem('nlp_search_count', nlpCount.toString());
      if (nlpCount >= 3) {
        await unlockBadge('logic_breaker');
      }

      return currentInfo;

    } catch (e) {
      console.error("Gemini Error:", e);
      toast.error(navigator.onLine ? "حدث خطأ في الاتصال بالذكاء الاصطناعي" : "تأكد من اتصالك بالإنترنت");
      const fallback = { derivatives: [normalizeArabicText(term)], root: 'غير معروف' };
      setSearchInfo(fallback);
      setSelectedDerivatives(fallback.derivatives);
      return fallback;
    }
  };

  const handleSemanticSearch = async (term) => {
    const lastSearch = localStorage.getItem('last_gemini_search');
    const now = Date.now();
    if (lastSearch && now - parseInt(lastSearch) < 60000) return null;

    try {
      const allowedBooks = bookNamesData?.ar?.map(b => b.name).join(', ') || '';
      const filterContext = `
        ${selectedTestament ? `العهد المطلوب البحث فيه: ${selectedTestament === 'OT' ? 'العهد القديم' : 'العهد الجديد'}` : ''}
        ${selectedBookIndex !== '' ? `السفر المطلوب البحث فيه: ${bookNamesData.ar[parseInt(selectedBookIndex)].name}` : ''}
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const prompt = `أنت محرك بحث لاهوتي ذكي ومفسر للكتاب المقدس لتطبيق "أجيوس". مهمتك هي فهم "المعنى" العميق وراء بحث المستخدم واستخراج شواهد مرتبطة به.

### [سؤال المستخدم]
"${term}"

### [سياق الفلترة]
${filterContext}

### [المطلوب]
استخراج أهم 5-7 مراجع دقيقة جداً (قصص، أمثال، أو آيات مباشرة) تشرح أو ترتبط بالمعنى المطلوب.

### [قواعد الاستجابة]
1. الرد JSON فقط بهذا التنسيق:
{
  "results": [
    {
      "book": "اسم السفر",
      "chapter": رقم الأصحاح,
      "verses": [رقم الآية, رقم الآية],
      "title": "عنوان قصير للمقطع (مثلاً: مثل السامري الصالح)",
      "reason": "لماذا هذا شاهد مرتبط ببحث المستخدم؟ (جملة واحدة ملهمة)"
    }
  ]
}

2. الالتزام بأسماء الأسفار من القائمة المتاحة حصراً: [${allowedBooks}]
3. إذا كان البحث عن صفة (مثل التواضع)، ابحث عن آيات مباشرة وعن قصص تجسد الصفة (مثل غسل الأرجل، ميلاد المسيح).
4. تأكد تماماً من صحة أرقام الآيات والأصحاحات ومناسبتها للسفر.`;

      const result = await model.generateContent(prompt);
      localStorage.setItem('last_gemini_search', Date.now().toString());
      setTimeLeft(60);

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid Format");

      const data = JSON.parse(jsonMatch[0]);

      const enriched = data.results.map(ref => {
        const bookIdx = bookNamesData.ar.findIndex(b => b.name === ref.book);
        if (bookIdx === -1) return null;

        const bookData = bibleData[bookIdx];
        if (!bookData || !bookData.chapters[ref.chapter - 1]) return null;

        const chapter = bookData.chapters[ref.chapter - 1];
        const versesContent = ref.verses.map(vNum => ({
          verse: vNum - 1,
          chapter: ref.chapter - 1,
          book_index: bookIdx,
          book: ref.book,
          number: vNum,
          text: chapter[vNum - 1]
        })).filter(v => v.text);

        if (versesContent.length === 0) return null;

        return {
          ...ref,
          bookIndex: bookIdx,
          versesContent,
          book: bookNamesData.ar[bookIdx].name // ضمان تطابق الاسم
        };
      }).filter(r => r !== null);

      setSemanticResults(enriched);
      return enriched;
    } catch (e) {
      console.error("Semantic Error:", e);
      toast.error("حدث خطأ في البحث الذكي، حاول مرة أخرى.");
      return null;
    }
  };

  const handleSearchPoints = () => {
    if (!user) return;
    const today = new Date().toLocaleDateString();
    const storageKey = `search_points_${user.uid}`;
    const searchData = JSON.parse(localStorage.getItem(storageKey) || '{"date":"","count":0}');

    if (searchData.date !== today) {
      updateUserPoints(5, "البحث عن آية/كلمة");
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: 1 }));
    } else if (searchData.count < 5) {
      updateUserPoints(5, "البحث عن آية/كلمة");
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: searchData.count + 1 }));
    }
  };

  const performSearch = async () => {
    if (allVerses.length === 0) return;
    const currentQuery = inputTerm.trim();
    const isFilterActive = selectedTestament !== '' || selectedBookIndex !== '' || selectedChapter !== '';

    if (!currentQuery && !isFilterActive) {
      setSearchResults([]);
      setSemanticResults([]);
      setSearchQuery('');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    setShowDerivatives(false);
    setSearchQuery(currentQuery);

    if (currentQuery && currentQuery.length >= 2) {
      handleSearchPoints();
      if (searchType === 'derivatives') {
        setSemanticResults([]);
        await searchWithGeminiDerivatives(currentQuery);
      } else if (searchType === 'semantic') {
        setSearchResults([]);
        await handleSemanticSearch(currentQuery);
      } else {
        setSemanticResults([]);
        const normQuery = normalizeArabicText(currentQuery);
        let filtered = allVerses;
        if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
        if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
        if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

        filtered = filtered.filter(v => normalizeArabicText(v.text).includes(normQuery));
        setSearchResults(filtered);
        setSearchInfo(null);
        setSelectedDerivatives([]);
      }
    } else {
      // في حالة وجود فلاتر بدون نص بحث، أو نص قصير جداً
      setSemanticResults([]);
      let filtered = allVerses;
      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

      setSearchResults(filtered);
      setSearchInfo(null);
      setSelectedDerivatives([]);
    }
    setIsLoading(false);
  };
