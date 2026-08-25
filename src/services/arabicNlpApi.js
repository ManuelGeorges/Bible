import { fetchWithTimeout } from '../lib/utils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class ArabicNlpApi {
  async analyzeWord(word) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/analyze_word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word }),
        timeout: 10000 // 10 ثوانٍ كحد أقصى للعمليات المعقدة
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error analyzing word (Connection slow?):', error);
      throw error;
    }
  }

  async searchDerivatives(searchTerm, textCorpus) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/search_derivatives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          search_term: searchTerm, 
          text_corpus: textCorpus 
        }),
        timeout: 15000 // البحث قد يستغرق وقتاً أطول قليلاً
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error searching derivatives:', error);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/`, { timeout: 5000 });
      return await response.json();
    } catch (error) {
      console.error('API health check failed:', error);
      throw error;
    }
  }
}

export default new ArabicNlpApi();
