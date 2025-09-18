import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  compressFile,
  estimateCompressionBenefit,
  createCompressedBlob,
  formatFileSize,
  shouldCompressFileType,
  CompressionOptions,
  CompressionResult
} from '../utils/compression';
import './CompressionComponent.css';

interface CompressionComponentProps {
  onCompressionComplete?: (result: CompressionResult & { originalFile: File }) => void;
  onError?: (error: string) => void;
}

const CompressionComponent: React.FC<CompressionComponentProps> = ({
  onCompressionComplete,
  onError
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [results, setResults] = useState<Array<CompressionResult & { originalFile: File }>>([]);
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    level: 6,
    algorithm: 'gzip'
  });
  const [estimates, setEstimates] = useState<Record<string, {
    estimatedRatio: number;
    worthCompressing: boolean;
    algorithm: 'gzip' | 'deflate';
  }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file sizes (max 100MB per file)
    const oversizedFiles = files.filter(file => file.size > 100 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files are too large (max 100MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setSelectedFiles(files);
    setResults([]);
    setEstimates({});

    // Estimate compression benefits for each file
    toast.info('Analyzing files for compression potential...');
    const newEstimates: typeof estimates = {};
    
    for (const file of files) {
      try {
        const estimate = await estimateCompressionBenefit(file);
        newEstimates[file.name] = estimate;
      } catch (error) {
        console.error(`Failed to estimate compression for ${file.name}:`, error);
      }
    }
    
    setEstimates(newEstimates);
  };

  const handleCompress = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to compress');
      return;
    }

    setCompressing(true);
    const newResults: Array<CompressionResult & { originalFile: File }> = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        try {
          toast.info(`Compressing ${file.name}... (${i + 1}/${selectedFiles.length})`);
          
          // Use estimated algorithm if available
          const estimate = estimates[file.name];
          const options = {
            ...compressionOptions,
            algorithm: estimate?.algorithm || compressionOptions.algorithm
          };
          
          const result = await compressFile(file, options);
          newResults.push(result);
          onCompressionComplete?.(result);
          
          toast.success(
            `${file.name} compressed: ${formatFileSize(result.originalSize)} → ` +
            `${formatFileSize(result.compressedSize)} (${result.compressionRatio.toFixed(1)}% reduction)`
          );
        } catch (error: any) {
          console.error(`Failed to compress ${file.name}:`, error);
          toast.error(`Failed to compress ${file.name}: ${error.message}`);
          onError?.(error.message);
        }
      }
      
      setResults(newResults);
      
      if (newResults.length > 0) {
        const totalOriginal = newResults.reduce((sum, r) => sum + r.originalSize, 0);
        const totalCompressed = newResults.reduce((sum, r) => sum + r.compressedSize, 0);
        const overallRatio = ((totalOriginal - totalCompressed) / totalOriginal) * 100;
        
        toast.success(
          `Compression complete! Overall: ${formatFileSize(totalOriginal)} → ` +
          `${formatFileSize(totalCompressed)} (${overallRatio.toFixed(1)}% reduction)`
        );
      }
    } catch (error: any) {
      console.error('Compression error:', error);
      toast.error(`Compression failed: ${error.message}`);
      onError?.(error.message);
    } finally {
      setCompressing(false);
    }
  };

  const downloadCompressed = (result: CompressionResult & { originalFile: File }) => {
    const blob = createCompressedBlob(result, result.originalFile.name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.originalFile.name}.${result.algorithm === 'gzip' ? 'gz' : 'deflate'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Compressed file downloaded!');
  };

  const downloadAllCompressed = () => {
    if (results.length === 0) return;
    
    results.forEach(result => {
      setTimeout(() => downloadCompressed(result), 100 * results.indexOf(result));
    });
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setResults([]);
    setEstimates({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCompressionRecommendation = (file: File) => {
    const estimate = estimates[file.name];
    if (!estimate) return null;
    
    if (!shouldCompressFileType(file.type)) {
      return {
        type: 'warning',
        message: 'This file type is already compressed'
      };
    }
    
    if (estimate.worthCompressing) {
      return {
        type: 'success',
        message: `Good candidate (~${estimate.estimatedRatio.toFixed(1)}% reduction expected)`
      };
    } else {
      return {
        type: 'info',
        message: 'Limited compression benefit expected'
      };
    }
  };

  return (
    <div className="compression-component">
      <div className="compression-header">
        <h2>File Compression</h2>
        <p>Reduce file sizes using advanced compression algorithms</p>
      </div>

      <div className="compression-controls">
        <div className="file-input-section">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="file-input"
            id="compression-file-input"
          />
          <label htmlFor="compression-file-input" className="file-input-label">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
            Select Files to Compress
          </label>
        </div>

        <div className="compression-options">
          <div className="option-group">
            <label htmlFor="algorithm-select">Algorithm:</label>
            <select
              id="algorithm-select"
              value={compressionOptions.algorithm}
              onChange={(e) => setCompressionOptions(prev => ({
                ...prev,
                algorithm: e.target.value as 'gzip' | 'deflate'
              }))}
              className="algorithm-select"
            >
              <option value="gzip">Gzip (recommended)</option>
              <option value="deflate">Deflate</option>
            </select>
          </div>

          <div className="option-group">
            <label htmlFor="level-select">Compression Level:</label>
            <select
              id="level-select"
              value={compressionOptions.level}
              onChange={(e) => setCompressionOptions(prev => ({
                ...prev,
                level: parseInt(e.target.value)
              }))}
              className="level-select"
            >
              <option value={1}>1 - Fastest</option>
              <option value={3}>3 - Fast</option>
              <option value={6}>6 - Balanced</option>
              <option value={9}>9 - Best Compression</option>
            </select>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleCompress}
            disabled={selectedFiles.length === 0 || compressing}
            className="compress-button primary"
          >
            {compressing ? 'Compressing...' : 'Compress Files'}
          </button>
          
          <button
            onClick={clearFiles}
            className="clear-button secondary"
          >
            Clear
          </button>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="file-list">
          <h3>Selected Files ({selectedFiles.length})</h3>
          <div className="files-grid">
            {selectedFiles.map((file, index) => {
              const recommendation = getCompressionRecommendation(file);
              return (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <div className="file-icon">📄</div>
                    <div className="file-details">
                      <h4>{file.name}</h4>
                      <p>{formatFileSize(file.size)} • {file.type || 'Unknown type'}</p>
                      {recommendation && (
                        <div className={`recommendation ${recommendation.type}`}>
                          {recommendation.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="compression-results">
          <div className="results-header">
            <h3>Compression Results</h3>
            <button
              onClick={downloadAllCompressed}
              className="download-all-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
              Download All
            </button>
          </div>
          
          <div className="results-grid">
            {results.map((result, index) => (
              <div key={index} className="result-item">
                <div className="result-info">
                  <h4>{result.originalFile.name}</h4>
                  <div className="size-comparison">
                    <div className="size-item">
                      <span className="label">Original:</span>
                      <span className="value">{formatFileSize(result.originalSize)}</span>
                    </div>
                    <div className="size-item">
                      <span className="label">Compressed:</span>
                      <span className="value">{formatFileSize(result.compressedSize)}</span>
                    </div>
                    <div className="size-item reduction">
                      <span className="label">Reduction:</span>
                      <span className="value">{result.compressionRatio.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="algorithm-info">
                    Algorithm: {result.algorithm.toUpperCase()}
                  </div>
                </div>
                
                <button
                  onClick={() => downloadCompressed(result)}
                  className="download-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                  </svg>
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="compression-info">
        <h4>Compression Benefits</h4>
        <div className="benefits-grid">
          <div className="benefit-item">
            <div className="benefit-icon">💾</div>
            <h5>Reduce Storage</h5>
            <p>Save disk space and reduce storage costs</p>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon">⚡</div>
            <h5>Faster Transfers</h5>
            <p>Upload and download files faster</p>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon">💰</div>
            <h5>Lower Bandwidth</h5>
            <p>Reduce bandwidth usage and costs</p>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon">🔒</div>
            <h5>Client-Side</h5>
            <p>Compression happens in your browser for privacy</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompressionComponent;