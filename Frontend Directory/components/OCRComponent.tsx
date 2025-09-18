import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { toast } from 'react-toastify';
import { ocrAPI } from '../services/api';
import './OCRComponent.css';

interface OCRComponentProps {
  onTextExtracted?: (text: string, confidence: number) => void;
  onError?: (error: string) => void;
}

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

const OCRComponent: React.FC<OCRComponentProps> = ({ onTextExtracted, onError }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('eng');
  const [supportedLanguages, setSupportedLanguages] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load supported languages on component mount
  React.useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await ocrAPI.getLanguages();
        setSupportedLanguages(response.languages);
      } catch (error) {
        console.error('Failed to load OCR languages:', error);
      }
    };
    loadLanguages();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, BMP, TIFF, WebP)');
        return;
      }
      
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      setSelectedFile(file);
      setResult(null);
      displayImagePreview(file);
    }
  };

  const displayImagePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Calculate dimensions to fit canvas while maintaining aspect ratio
            const maxWidth = 400;
            const maxHeight = 300;
            let { width, height } = img;
            
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const performOCR = async () => {
    if (!selectedFile) {
      toast.error('Please select an image file first');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const { data } = await Tesseract.recognize(
        selectedFile,
        selectedLanguage,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
          errorHandler: (err) => {
            console.error('Tesseract error:', err);
          }
        }
      );

      const ocrResult: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        words: (data as any).words?.map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })) || []
      };

      setResult(ocrResult);
      onTextExtracted?.(ocrResult.text, ocrResult.confidence);
      
      if (ocrResult.confidence < 60) {
        toast.warning('OCR confidence is low. The extracted text might not be accurate.');
      } else {
        toast.success('Text extracted successfully!');
      }

    } catch (error: any) {
      console.error('OCR processing error:', error);
      const errorMessage = error.message || 'OCR processing failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const copyToClipboard = async () => {
    if (result?.text) {
      try {
        await navigator.clipboard.writeText(result.text);
        toast.success('Text copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy text to clipboard');
      }
    }
  };

  const downloadText = () => {
    if (result?.text) {
      const blob = new Blob([result.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extracted-text-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Text file downloaded!');
    }
  };

  const clearResults = () => {
    setSelectedFile(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="ocr-component">
      <div className="ocr-header">
        <h2>OCR Text Extraction</h2>
        <p>Extract text from images using advanced OCR technology</p>
      </div>

      <div className="ocr-controls">
        <div className="file-input-section">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="file-input"
            id="ocr-file-input"
          />
          <label htmlFor="ocr-file-input" className="file-input-label">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
            Choose Image File
          </label>
        </div>

        <div className="language-selector">
          <label htmlFor="language-select">Language:</label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="language-select"
          >
            {Object.entries(supportedLanguages).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="action-buttons">
          <button
            onClick={performOCR}
            disabled={!selectedFile || processing}
            className="ocr-button primary"
          >
            {processing ? 'Processing...' : 'Extract Text'}
          </button>
          
          <button
            onClick={clearResults}
            className="ocr-button secondary"
          >
            Clear
          </button>
        </div>
      </div>

      {selectedFile && (
        <div className="image-preview">
          <h3>Image Preview</h3>
          <canvas ref={canvasRef} className="preview-canvas" />
          <div className="file-info">
            <span>File: {selectedFile.name}</span>
            <span>Size: {Math.round(selectedFile.size / 1024)} KB</span>
            <span>Type: {selectedFile.type}</span>
          </div>
        </div>
      )}

      {processing && (
        <div className="processing-status">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p>Processing... {progress}%</p>
        </div>
      )}

      {result && (
        <div className="ocr-results">
          <div className="results-header">
            <h3>Extracted Text</h3>
            <div className="confidence-badge">
              Confidence: {Math.round(result.confidence)}%
            </div>
          </div>
          
          <div className="text-output">
            <textarea
              value={result.text}
              readOnly
              className="extracted-text"
              rows={10}
            />
          </div>
          
          <div className="result-actions">
            <button onClick={copyToClipboard} className="action-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
              </svg>
              Copy Text
            </button>
            
            <button onClick={downloadText} className="action-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
              Download
            </button>
          </div>
          
          <div className="word-analysis">
            <h4>Word Analysis ({result.words.length} words detected)</h4>
            <div className="word-list">
              {result.words.slice(0, 20).map((word, index) => (
                <div key={index} className="word-item">
                  <span className="word-text">{word.text}</span>
                  <span className="word-confidence">{Math.round(word.confidence)}%</span>
                </div>
              ))}
              {result.words.length > 20 && (
                <div className="word-item more">... and {result.words.length - 20} more words</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="ocr-info">
        <h4>Supported Features</h4>
        <ul>
          <li>100+ languages supported</li>
          <li>High accuracy text recognition</li>
          <li>Word-level confidence scores</li>
          <li>Support for various image formats</li>
          <li>Client-side processing for privacy</li>
        </ul>
      </div>
    </div>
  );
};

export default OCRComponent;