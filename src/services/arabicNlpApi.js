const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class ArabicNlpApi {
  async analyzeWord(word) {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze_word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error analyzing word:', error);
      throw error;
    }
  }

  async searchDerivatives(searchTerm, textCorpus) {
    try {
      const response = await fetch(`${API_BASE_URL}/search_derivatives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          search_term: searchTerm, 
          text_corpus: textCorpus 
        })
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
      const response = await fetch(`${API_BASE_URL}/`);
      return await response.json();
    } catch (error) {
      console.error('API health check failed:', error);
      throw error;
    }
  }
}

export default new ArabicNlpApi();