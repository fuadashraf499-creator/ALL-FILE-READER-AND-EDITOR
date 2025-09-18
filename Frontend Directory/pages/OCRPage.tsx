import React, { useState } from 'react';
import OCRComponent from '../components/OCRComponent';
import './OCRPage.css';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface OCRPageProps {
  user?: User;
}

const OCRPage: React.FC<OCRPageProps> = ({ user }) => {
  const [extractedTexts, setExtractedTexts] = useState<Array<{
    id: string;
    text: string;
    confidence: number;
    timestamp: string;
    filename?: string;
  }>>([]);

  const handleTextExtracted = (text: string, confidence: number) => {
    const newExtraction = {
      id: Date.now().toString(),
      text,
      confidence,
      timestamp: new Date().toLocaleString(),
      filename: `extraction-${Date.now()}.txt`
    };
    
    setExtractedTexts(prev => [newExtraction, ...prev.slice(0, 9)]); // Keep last 10 extractions
  };

  const handleError = (error: string) => {
    console.error('OCR Error:', error);
  };

  const downloadAllTexts = () => {
    if (extractedTexts.length === 0) return;
    
    const allTexts = extractedTexts.map((item, index) => 
      `=== Extraction ${index + 1} (${item.timestamp}) ===\n` +
      `Confidence: ${Math.round(item.confidence)}%\n\n` +
      item.text + '\n\n'
    ).join('');
    
    const blob = new Blob([allTexts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-extractions-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    setExtractedTexts([]);
  };

  return (
    <div className="ocr-page">
      <div className="page-header">
        <h1>OCR Text Extraction</h1>
        <p>Extract text from images using advanced Optical Character Recognition</p>
      </div>

      <div className="page-content">
        <div className="main-section">
          <OCRComponent 
            onTextExtracted={handleTextExtracted}
            onError={handleError}
          />
        </div>

        {extractedTexts.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <h2>Extraction History</h2>
              <div className="history-actions">
                <button 
                  onClick={downloadAllTexts}
                  className="history-btn primary"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                  </svg>
                  Download All
                </button>
                <button 
                  onClick={clearHistory}
                  className="history-btn secondary"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                  </svg>
                  Clear History
                </button>
              </div>
            </div>

            <div className="history-list">
              {extractedTexts.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="item-header">
                    <div className="item-info">
                      <span className="timestamp">{item.timestamp}</span>
                      <span className="confidence">Confidence: {Math.round(item.confidence)}%</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(item.text);
                      }}
                      className="copy-btn"
                      title="Copy to clipboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                      </svg>
                    </button>
                  </div>
                  <div className="item-text">
                    {item.text.length > 200 
                      ? item.text.substring(0, 200) + '...' 
                      : item.text
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="features-section">
        <h2>OCR Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🌍</div>
            <h3>100+ Languages</h3>
            <p>Support for over 100 languages including English, Spanish, French, German, Chinese, Japanese, and many more.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>High Accuracy</h3>
            <p>Advanced machine learning algorithms provide high accuracy text recognition with confidence scores.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Privacy First</h3>
            <p>All OCR processing happens in your browser. Your images never leave your device.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Fast Processing</h3>
            <p>Optimized for speed with real-time progress tracking and efficient processing.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Multiple Formats</h3>
            <p>Support for JPEG, PNG, BMP, TIFF, WebP and other common image formats.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Detailed Analysis</h3>
            <p>Word-level confidence scores and bounding box information for detailed analysis.</p>
          </div>
        </div>
      </div>

      <div className="tips-section">
        <h2>Tips for Better OCR Results</h2>
        <div className="tips-list">
          <div className="tip-item">
            <div className="tip-icon">💡</div>
            <div className="tip-content">
              <h4>High Quality Images</h4>
              <p>Use high-resolution images with clear, sharp text for best results.</p>
            </div>
          </div>
          
          <div className="tip-item">
            <div className="tip-icon">🔆</div>
            <div className="tip-content">
              <h4>Good Lighting</h4>
              <p>Ensure good lighting and contrast between text and background.</p>
            </div>
          </div>
          
          <div className="tip-item">
            <div className="tip-icon">📐</div>
            <div className="tip-content">
              <h4>Straight Text</h4>
              <p>Keep text horizontal and avoid skewed or rotated images when possible.</p>
            </div>
          </div>
          
          <div className="tip-item">
            <div className="tip-icon">🎨</div>
            <div className="tip-content">
              <h4>Simple Fonts</h4>
              <p>Simple, standard fonts work better than decorative or handwritten text.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRPage;