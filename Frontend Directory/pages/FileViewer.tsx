import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import './FileViewer.css';

// Import WebViewer for PDF editing
declare global {
  interface Window {
    WebViewer: any;
  }
}

// File type detection
const getFileType = (file: File | string): string => {
  const fileName = typeof file === 'string' ? file : file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (['pdf'].includes(extension)) return 'pdf';
  if (['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'php', 'rb', 'swift', 'kt', 'scala', 'sh', 'ps1', 'bat', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf'].includes(extension)) return 'text';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) return 'image';
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) return 'audio';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) return 'office';
  return 'unknown';
};

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface FileViewerProps {
  user: User | null;
}

const FileViewer: React.FC<FileViewerProps> = ({ user }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<string>('unknown');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webViewerRef = useRef<HTMLDivElement>(null);
  const [webViewerInstance, setWebViewerInstance] = useState<any>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      readFileContent(file);
    }
  };

  const readFileContent = async (file: File) => {
    setIsLoading(true);
    const type = getFileType(file);
    setFileType(type);
    
    try {
      if (type === 'text') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setFileContent(content);
          setEditedContent(content);
          setFileUrl(null);
          toast.success(`File loaded: ${file.name}`);
        };
        reader.readAsText(file);
      } else if (type === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setFileUrl(dataUrl);
          setFileContent('');
          toast.success(`Image loaded: ${file.name}`);
        };
        reader.readAsDataURL(file);
      } else if (type === 'pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setFileUrl(url);
          setFileContent('');
          initializeWebViewer(url);
          toast.success(`PDF loaded: ${file.name}`);
        };
        reader.readAsArrayBuffer(file);
      } else {
        // For other file types, try to create a URL
        const url = URL.createObjectURL(file);
        setFileUrl(url);
        setFileContent('');
        toast.success(`File loaded: ${file.name}`);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Failed to read file content');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeWebViewer = async (documentUrl: string) => {
    if (webViewerRef.current && window.WebViewer) {
      try {
        const instance = await window.WebViewer({
          path: '/webviewer/lib',
          initialDoc: documentUrl,
          enableRedaction: true,
          enableMeasurement: true,
          enableFilePicker: false,
          fullAPI: true,
        }, webViewerRef.current);
        
        setWebViewerInstance(instance);
        
        const { documentViewer, annotationManager } = instance.Core;
        
        documentViewer.addEventListener('documentLoaded', () => {
          console.log('PDF document loaded in WebViewer');
        });
        
      } catch (error) {
        console.error('Error initializing WebViewer:', error);
        toast.error('Failed to initialize PDF editor');
      }
    }
  };

  const saveEditedContent = () => {
    if (fileType === 'text' && selectedFile) {
      setFileContent(editedContent);
      setIsEditing(false);
      
      // Create a new file with edited content
      const blob = new Blob([editedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('File saved successfully!');
    }
  };

  const loadFileFromPath = async (filePath: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:7834/api/v1/file-loader/load-file?path=${encodeURIComponent(filePath)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load file');
      }
      
      const blob = await response.blob();
      const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || 'unknown';
      const file = new File([blob], fileName, { type: blob.type });
      
      setSelectedFile(file);
      await readFileContent(file);
      
    } catch (error) {
      console.error('Error loading file from path:', error);
      toast.error(`Failed to load file: ${filePath}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Test files from QFL directory
  const testFiles = [
    'E:\\QFL\\execute_deployment.ps1',
    'E:\\QFL\\FRONTEND_BACKEND_GUIDE.md',
    'E:\\QFL\\INTEGRATION_PLAN.md',
    'E:\\QFL\\Key Capabilities for QuwwaForge\'s Ultima.md',
    'E:\\QFL\\QFL_ADVANCED_FEATURES_ANALYSIS.md',
    'E:\\QFL\\QFL_ADVANCED_IMPLEMENTATIONS.md',
    'E:\\QFL\\QFL_CLONING_MECHANISM_TECHNICAL_REPORT.md',
    'E:\\QFL\\QFL_COMPREHENSIVE_FIX_PLAN.md',
    'E:\\QFL\\qfl_product_demo.qfl',
    'E:\\QFL\\README.md',
    'E:\\QFL\\setup_environment.ps1',
    'E:\\QFL\\test_connection.py',
    'E:\\QFL\\test_real_integration.ps1',
    'E:\\QFL\\.env',
    'E:\\QFL\\.env.monitoring',
    'E:\\QFL\\.gitignore',
    'E:\\QFL\\ACRONIS_CYBER_PROTECT_INTEGRATION.md',
    'E:\\QFL\\ACRONIS_DEPLOYMENT_GUIDE.md',
    'E:\\QFL\\ACRONIS_INTEGRATION_README.md',
    'E:\\QFL\\build.rs',
    'E:\\QFL\\Cargo.lock',
    'E:\\QFL\\Cargo.toml',
    'E:\\QFL\\deploy_production.ps1',
    'E:\\QFL\\DISCOVERED_TOOLS_INTEGRATION.md'
  ];

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (user) {
        formData.append('userId', user.id.toString());
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload to backend
      const response = await fetch('http://localhost:7834/api/v1/upload/simple', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const result = await response.json();
        setFileUrl(result.fileUrl || URL.createObjectURL(selectedFile));
        toast.success('File uploaded successfully!');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadSamplePDF = () => {
    setFileUrl('http://localhost:7834/api/v1/sample/pdf');
    setSelectedFile(null);
    toast.info('Loading sample PDF document...');
  };

  return (
    <div className="file-viewer">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-icon">📁</span>
            <span className="logo-text">FileEditor Pro</span>
          </div>
          <div className="nav-links">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#tools">Tools</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </nav>

      {/* MAIN FILE READER & EDITOR SECTION - FRONT AND CENTER */}
      <section className="main-file-section">
        <div className="file-container">
          <div className="file-header">
            <h1 className="main-title">
              🚀 File Reader & Editor
              <span className="subtitle">Read, Edit & Process Files Instantly</span>
            </h1>
          </div>

          {/* File Upload Zone - Primary Interface */}
          <div 
            className="main-upload-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-content">
              <div className="upload-icon">📁</div>
              <h2>Drop Your File Here or Click to Browse</h2>
              <p>Supports 50+ formats • Text, PDF, Images, Code, Documents • Max 1GB</p>
              {selectedFile && (
                <div className="selected-file-info">
                  <span className="file-name">📄 {selectedFile.name}</span>
                  <span className="file-size">({formatFileSize(selectedFile.size)})</span>
                </div>
              )}
            </div>
            
            {uploading && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <span className="progress-text">{uploadProgress}%</span>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept="*/*"
          />



          {/* Quick Action Buttons */}
          <div className="quick-actions-main">
            <button className="action-btn primary" onClick={loadSamplePDF}>
              📋 Try Sample PDF
            </button>
            <button className="action-btn" onClick={() => fileInputRef.current?.click()}>
              📁 Upload File
            </button>
          </div>
        </div>
      </section>

      {/* File Display Section */}
      {(fileUrl || selectedFile || fileContent) ? (
        <div className="viewer-section">
          <div className="viewer-toolbar">
            <button 
              className="toolbar-btn"
              onClick={() => {
                setFileUrl(null);
                setSelectedFile(null);
                setFileContent('');
                setFileType('unknown');
                setIsEditing(false);
              }}
            >
              📤 Upload New File
            </button>
            {fileType === 'text' && (
              <button 
                className="toolbar-btn"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? '👁️ View' : '✏️ Edit'}
              </button>
            )}
            {isEditing && fileType === 'text' && (
              <button 
                className="toolbar-btn primary"
                onClick={saveEditedContent}
              >
                💾 Save
              </button>
            )}
            <button className="toolbar-btn">🔗 Share</button>
            <button className="toolbar-btn">🔄 Convert</button>
          </div>

          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading file content...</p>
            </div>
          )}

          <div className="file-display">
            {selectedFile && (
              <div className="file-info">
                <h3>📄 {selectedFile.name}</h3>
                <p>Type: {fileType.toUpperCase()} | Size: {formatFileSize(selectedFile.size)}</p>
              </div>
            )}
            
            {fileType === 'text' && fileContent && (
              <div className="text-editor">
                {isEditing ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="code-editor"
                    style={{
                      width: '100%',
                      height: '600px',
                      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      padding: '20px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      backgroundColor: '#f8f9fa',
                      resize: 'vertical'
                    }}
                    placeholder="Edit your file content here..."
                  />
                ) : (
                  <pre className="code-display" style={{
                    width: '100%',
                    height: '600px',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    padding: '20px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#f8f9fa',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {fileContent}
                  </pre>
                )}
              </div>
            )}
            
            {fileType === 'pdf' && (
              <div className="pdf-viewer">
                <div 
                  ref={webViewerRef}
                  style={{ width: '100%', height: '700px', border: '1px solid #ddd', borderRadius: '8px' }}
                />
              </div>
            )}
            
            {fileType === 'image' && fileUrl && (
              <div className="image-viewer">
                <img 
                  src={fileUrl} 
                  alt={selectedFile?.name || 'Image'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '600px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}
            
            {fileType === 'video' && fileUrl && (
              <div className="video-viewer">
                <video 
                  src={fileUrl} 
                  controls
                  style={{
                    width: '100%',
                    maxHeight: '600px',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
            
            {fileType === 'audio' && fileUrl && (
              <div className="audio-viewer">
                <audio 
                  src={fileUrl} 
                  controls
                  style={{
                    width: '100%',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            )}
            
            {fileType === 'office' && fileUrl && (
              <div className="office-viewer">
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                  width="100%"
                  height="600px"
                  style={{ border: '1px solid #ddd', borderRadius: '8px' }}
                  title="Office Document Viewer"
                />
              </div>
            )}
            
            {fileType === 'unknown' && fileUrl && (
              <div className="generic-viewer">
                <iframe
                  src={fileUrl}
                  width="100%"
                  height="600px"
                  style={{ border: '1px solid #ddd', borderRadius: '8px' }}
                  title="File Viewer"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
         <div className="homepage-content">
          
           <div className="features-showcase">
             <h2>🚀 Complete File Management Platform</h2>
             <p className="features-subtitle">Everything you need for professional file processing, editing, and collaboration</p>
             
             <div className="features-grid">
               {/* Core Features */}
               <div className="feature-category">
                 <h3>📁 Core Features</h3>
                 <div className="feature-items">
                   <div className="feature-item">
                     <div className="feature-icon">👁️</div>
                     <h4>Universal Viewer</h4>
                     <p>View 50+ file formats including PDF, DOCX, images, videos</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">📤</div>
                     <h4>Smart Upload</h4>
                     <p>Drag & drop, chunked upload, compression support</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">💾</div>
                     <h4>Cloud Storage</h4>
                     <p>Secure file storage with AWS S3 integration</p>
                   </div>
                 </div>
               </div>

               {/* AI & Processing */}
               <div className="feature-category">
                 <h3>🤖 AI & Processing</h3>
                 <div className="feature-items">
                   <div className="feature-item">
                     <div className="feature-icon">🔍</div>
                     <h4>OCR Text Extraction</h4>
                     <p>Extract text from images and scanned documents</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">🧠</div>
                     <h4>AI Document Analysis</h4>
                     <p>Summarization, sentiment analysis, Q&A</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">🔄</div>
                     <h4>Format Conversion</h4>
                     <p>Convert between 14+ file formats seamlessly</p>
                   </div>
                 </div>
               </div>

               {/* Editing & Creation */}
               <div className="feature-category">
                 <h3>✏️ Editing & Creation</h3>
                 <div className="feature-items">
                   <div className="feature-item">
                     <div className="feature-icon">🎨</div>
                     <h4>Image Editor</h4>
                     <p>Advanced image editing with Konva.js</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">🎬</div>
                     <h4>Video Editor</h4>
                     <p>Video processing with FFmpeg integration</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">📝</div>
                     <h4>Document Annotation</h4>
                     <p>Add notes, highlights, and comments</p>
                   </div>
                 </div>
               </div>

               {/* Collaboration */}
               <div className="feature-category">
                 <h3>👥 Collaboration</h3>
                 <div className="feature-items">
                   <div className="feature-item">
                     <div className="feature-icon">⚡</div>
                     <h4>Real-time Collaboration</h4>
                     <p>Live editing with multiple users via WebSocket</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">💬</div>
                     <h4>Comments & Chat</h4>
                     <p>Threaded comments and real-time messaging</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">🔗</div>
                     <h4>File Sharing</h4>
                     <p>Secure sharing with permission controls</p>
                   </div>
                 </div>
               </div>

               {/* Version Control */}
               <div className="feature-category">
                 <h3>📚 Version Control</h3>
                 <div className="feature-items">
                   <div className="feature-item">
                     <div className="feature-icon">🕐</div>
                     <h4>Version History</h4>
                     <p>Track changes with automatic versioning</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">🔄</div>
                     <h4>Rollback & Restore</h4>
                     <p>Easily revert to previous versions</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">📊</div>
                     <h4>Change Tracking</h4>
                     <p>Detailed audit logs and diff visualization</p>
                   </div>
                 </div>
               </div>

               {/* Performance & Security */}
               <div className="feature-category">
                 <h3>🔒 Performance & Security</h3>
                 <div className="feature-items">
                   <div className="feature-item">
                     <div className="feature-icon">🛡️</div>
                     <h4>Enterprise Security</h4>
                     <p>Rate limiting, CSRF protection, secure headers</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">⚡</div>
                     <h4>Performance Optimization</h4>
                     <p>Caching, compression, CDN integration</p>
                   </div>
                   <div className="feature-item">
                     <div className="feature-icon">📈</div>
                     <h4>Monitoring & Analytics</h4>
                     <p>Real-time performance monitoring with Sentry</p>
                   </div>
                 </div>
               </div>
             </div>



             {/* Quick Actions */}
             <div className="quick-actions">
               <h3>🚀 Quick Start</h3>
               <div className="action-buttons">
                 <button className="action-btn primary" onClick={loadSamplePDF}>
                   📋 Try Sample PDF
                 </button>
                 <button className="action-btn" onClick={() => fileInputRef.current?.click()}>
                   📁 Upload Your File
                 </button>
                 <button className="action-btn">
                   🎨 Open Image Editor
                 </button>
                 <button className="action-btn">
                   🤖 AI Document Analysis
                 </button>
               </div>
             </div>

             {/* Stats */}
             <div className="platform-stats">
               <div className="stat-item">
                 <div className="stat-number">50+</div>
                 <div className="stat-label">File Formats</div>
               </div>
               <div className="stat-item">
                 <div className="stat-number">100MB</div>
                 <div className="stat-label">Max File Size</div>
               </div>
               <div className="stat-item">
                 <div className="stat-number">Real-time</div>
                 <div className="stat-label">Collaboration</div>
               </div>
               <div className="stat-item">
                 <div className="stat-number">AI-Powered</div>
                 <div className="stat-label">Processing</div>
               </div>
             </div>
           </div>

           {/* Testimonials Section */}
           <section className="testimonials">
             <div className="container">
               <h2>What Our Users Say</h2>
               <div className="testimonials-grid">
                 <div className="testimonial-card">
                   <p className="testimonial-text">
                     "FileHub Pro has revolutionized our document workflow. The AI-powered analysis saves us hours every day!"
                   </p>
                   <div className="testimonial-author">- Sarah Johnson, Marketing Director</div>
                 </div>
                 <div className="testimonial-card">
                   <p className="testimonial-text">
                     "The real-time collaboration feature is incredible. Our team can work on documents simultaneously without any conflicts."
                   </p>
                   <div className="testimonial-author">- Michael Chen, Project Manager</div>
                 </div>
                 <div className="testimonial-card">
                   <p className="testimonial-text">
                     "Best online file editor I've used. Fast, secure, and supports every format we need for our business."
                   </p>
                   <div className="testimonial-author">- Emily Rodriguez, Small Business Owner</div>
                 </div>
               </div>
             </div>
           </section>

           {/* SEO Content Section */}
           <section className="seo-content">
             <div className="container">
               <h2>Professional File Management Made Simple</h2>
               <div className="seo-text">
                 <p>
                   FileHub Pro is the ultimate online file reader and editor that combines powerful functionality with enterprise-grade security. 
                   Whether you need to edit PDFs, convert documents, or collaborate with your team in real-time, our platform provides 
                   everything you need in one convenient location.
                 </p>
                 <p>
                   Our AI-powered tools can extract text from images, analyze document sentiment, and provide intelligent summaries. 
                   With support for over 50 file formats and advanced features like version control and secure sharing, 
                   FileHub Pro is trusted by thousands of professionals worldwide.
                 </p>
                 <p>
                   Experience the future of file management with our free online tools. No downloads required, 
                   GDPR compliant, and your files are automatically deleted after processing for maximum security.
                 </p>
               </div>
             </div>
           </section>
        </div>
       )}

       {/* Sidebar Ad */}
       <div className="sidebar-ad">
         <span>📢 Ad Space</span>
         <div>160x600 Skyscraper</div>
       </div>

       {/* Footer */}
       <footer className="footer">
         <div className="footer-content">
           <div className="footer-section">
             <h3>FileHub Pro</h3>
             <p>The ultimate online file reader and editor. Process 50+ file formats with AI-powered tools, real-time collaboration, and enterprise security.</p>
           </div>
           <div className="footer-section">
             <h3>Tools</h3>
             <ul>
               <li><a href="#pdf-editor">PDF Editor</a></li>
               <li><a href="#image-editor">Image Editor</a></li>
               <li><a href="#document-viewer">Document Viewer</a></li>
               <li><a href="#file-converter">File Converter</a></li>
               <li><a href="#ocr-tool">OCR Tool</a></li>
             </ul>
           </div>
           <div className="footer-section">
             <h3>Features</h3>
             <ul>
               <li><a href="#ai-analysis">AI Document Analysis</a></li>
               <li><a href="#collaboration">Real-time Collaboration</a></li>
               <li><a href="#version-control">Version Control</a></li>
               <li><a href="#security">Enterprise Security</a></li>
               <li><a href="#api">Developer API</a></li>
             </ul>
           </div>
           <div className="footer-section">
             <h3>Company</h3>
             <ul>
               <li><a href="#about">About Us</a></li>
               <li><a href="#pricing">Pricing</a></li>
               <li><a href="#blog">Blog</a></li>
               <li><a href="#contact">Contact</a></li>
               <li><a href="#careers">Careers</a></li>
             </ul>
           </div>
           <div className="footer-section">
             <h3>Legal</h3>
             <ul>
               <li><a href="#privacy">Privacy Policy</a></li>
               <li><a href="#terms">Terms of Service</a></li>
               <li><a href="#gdpr">GDPR Compliance</a></li>
               <li><a href="#security">Security</a></li>
               <li><a href="#cookies">Cookie Policy</a></li>
             </ul>
           </div>
         </div>
         <div className="footer-bottom">
           <p>&copy; 2024 FileHub Pro. All rights reserved. | Free Online File Reader and Editor | Edit PDFs, Docs & More</p>
         </div>
       </footer>
     </div>
   );
 };

 export default FileViewer;