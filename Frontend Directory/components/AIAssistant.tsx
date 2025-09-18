import React, { useState, useEffect } from 'react';
import { aiService, useAIService, useTextAnalysis } from '../utils/aiService';
import './AIAssistant.css';

interface AIAssistantProps {
  text: string;
  onSuggestionApply?: (suggestion: string) => void;
  className?: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  text,
  onSuggestionApply,
  className = ''
}) => {
  const { isLoading: aiLoading, error: aiError, isReady } = useAIService();
  const { analysis, loading: analysisLoading, error: analysisError } = useTextAnalysis(text, isReady);
  const [activeTab, setActiveTab] = useState<'insights' | 'suggestions' | 'qa'>('insights');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<any>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [customSuggestions, setCustomSuggestions] = useState<string[]>([]);
  const [suggestionType, setSuggestionType] = useState<'improvement' | 'expansion' | 'simplification'>('improvement');

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !text || questionLoading) return;

    setQuestionLoading(true);
    try {
      const result = await aiService.answerQuestion(question, text);
      setAnswer(result);
    } catch (error) {
      console.error('Question answering failed:', error);
      setAnswer({ error: 'Failed to answer question' });
    } finally {
      setQuestionLoading(false);
    }
  };

  const generateCustomSuggestions = async () => {
    if (!text) return;
    
    try {
      const suggestions = await aiService.generateContentSuggestions(text, suggestionType);
      setCustomSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  };

  const getSentimentColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getReadabilityLevel = (score: number) => {
    if (score >= 90) return { level: 'Very Easy', color: '#10b981' };
    if (score >= 80) return { level: 'Easy', color: '#84cc16' };
    if (score >= 70) return { level: 'Fairly Easy', color: '#eab308' };
    if (score >= 60) return { level: 'Standard', color: '#f97316' };
    if (score >= 50) return { level: 'Fairly Difficult', color: '#ef4444' };
    if (score >= 30) return { level: 'Difficult', color: '#dc2626' };
    return { level: 'Very Difficult', color: '#991b1b' };
  };

  if (aiLoading) {
    return (
      <div className={`ai-assistant loading ${className}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading AI models...</p>
        </div>
      </div>
    );
  }

  if (aiError) {
    return (
      <div className={`ai-assistant error ${className}`}>
        <div className="error-message">
          <h3>AI Assistant Unavailable</h3>
          <p>{aiError}</p>
        </div>
      </div>
    );
  }

  if (!text || text.length < 10) {
    return (
      <div className={`ai-assistant empty ${className}`}>
        <div className="empty-state">
          <div className="ai-icon">🤖</div>
          <h3>AI Assistant</h3>
          <p>Add some text to get AI-powered insights and suggestions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-assistant ${className}`}>
      <div className="ai-header">
        <div className="ai-title">
          <span className="ai-icon">🤖</span>
          <h3>AI Assistant</h3>
        </div>
        <div className="ai-status">
          {isReady && <span className="status-indicator ready">Ready</span>}
        </div>
      </div>

      <div className="ai-tabs">
        <button
          className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          📊 Insights
        </button>
        <button
          className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          💡 Suggestions
        </button>
        <button
          className={`tab-button ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          ❓ Q&A
        </button>
      </div>

      <div className="ai-content">
        {activeTab === 'insights' && (
          <div className="insights-panel">
            {analysisLoading ? (
              <div className="loading-state">
                <div className="spinner small"></div>
                <p>Analyzing document...</p>
              </div>
            ) : analysisError ? (
              <div className="error-state">
                <p>Failed to analyze document: {analysisError}</p>
              </div>
            ) : analysis ? (
              <div className="insights-content">
                {/* Summary */}
                <div className="insight-card">
                  <h4>📝 Summary</h4>
                  <p className="summary-text">{analysis.summary}</p>
                </div>

                {/* Statistics */}
                <div className="insight-card">
                  <h4>📈 Statistics</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">Words</span>
                      <span className="stat-value">{analysis.wordCount.toLocaleString()}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Reading Time</span>
                      <span className="stat-value">{analysis.estimatedReadingTime} min</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Readability</span>
                      <span 
                        className="stat-value"
                        style={{ color: getReadabilityLevel(analysis.readabilityScore).color }}
                      >
                        {getReadabilityLevel(analysis.readabilityScore).level}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sentiment */}
                <div className="insight-card">
                  <h4>😊 Sentiment</h4>
                  <div className="sentiment-info">
                    <span 
                      className="sentiment-label"
                      style={{ color: getSentimentColor(analysis.sentiment.label) }}
                    >
                      {analysis.sentiment.label}
                    </span>
                    <div className="sentiment-bar">
                      <div 
                        className="sentiment-fill"
                        style={{ 
                          width: `${analysis.sentiment.score * 100}%`,
                          backgroundColor: getSentimentColor(analysis.sentiment.label)
                        }}
                      ></div>
                    </div>
                    <span className="sentiment-confidence">
                      {analysis.sentiment.confidence} confidence
                    </span>
                  </div>
                </div>

                {/* Key Phrases */}
                <div className="insight-card">
                  <h4>🔑 Key Phrases</h4>
                  <div className="key-phrases">
                    {analysis.keyPhrases.map((phrase: string, index: number) => (
                      <span key={index} className="key-phrase">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="suggestions-panel">
            <div className="suggestion-controls">
              <label htmlFor="suggestion-type">Suggestion Type:</label>
              <select
                id="suggestion-type"
                value={suggestionType}
                onChange={(e) => setSuggestionType(e.target.value as any)}
              >
                <option value="improvement">Improvement</option>
                <option value="expansion">Expansion</option>
                <option value="simplification">Simplification</option>
              </select>
              <button 
                className="generate-btn"
                onClick={generateCustomSuggestions}
              >
                Generate
              </button>
            </div>

            <div className="suggestions-list">
              {/* Default suggestions from analysis */}
              {analysis?.suggestions?.map((suggestion: string, index: number) => (
                <div key={`default-${index}`} className="suggestion-item">
                  <div className="suggestion-content">
                    <span className="suggestion-icon">💡</span>
                    <p>{suggestion}</p>
                  </div>
                  {onSuggestionApply && (
                    <button
                      className="apply-btn"
                      onClick={() => onSuggestionApply(suggestion)}
                    >
                      Apply
                    </button>
                  )}
                </div>
              ))}

              {/* Custom generated suggestions */}
              {customSuggestions.map((suggestion, index) => (
                <div key={`custom-${index}`} className="suggestion-item custom">
                  <div className="suggestion-content">
                    <span className="suggestion-icon">🎯</span>
                    <p>{suggestion}</p>
                  </div>
                  {onSuggestionApply && (
                    <button
                      className="apply-btn"
                      onClick={() => onSuggestionApply(suggestion)}
                    >
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="qa-panel">
            <form onSubmit={handleQuestionSubmit} className="question-form">
              <div className="question-input">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about the document..."
                  disabled={questionLoading}
                />
                <button 
                  type="submit" 
                  disabled={questionLoading || !question.trim()}
                  className="ask-btn"
                >
                  {questionLoading ? '...' : 'Ask'}
                </button>
              </div>
            </form>

            {answer && (
              <div className="answer-section">
                {answer.error ? (
                  <div className="error-message">
                    <p>{answer.error}</p>
                  </div>
                ) : (
                  <div className="answer-content">
                    <h4>Answer:</h4>
                    <p className="answer-text">{answer.answer}</p>
                    <div className="answer-meta">
                      <span className="confidence">
                        Confidence: {Math.round(answer.score * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="qa-suggestions">
              <h4>Suggested Questions:</h4>
              <div className="suggested-questions">
                <button 
                  className="suggestion-question"
                  onClick={() => setQuestion('What is the main topic of this document?')}
                >
                  What is the main topic?
                </button>
                <button 
                  className="suggestion-question"
                  onClick={() => setQuestion('What are the key points mentioned?')}
                >
                  What are the key points?
                </button>
                <button 
                  className="suggestion-question"
                  onClick={() => setQuestion('What is the conclusion?')}
                >
                  What is the conclusion?
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;