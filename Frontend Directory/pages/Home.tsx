import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home: React.FC = () => {
  const features = [
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#3B82F6" fillOpacity="0.1"/>
          <path d="M16 20h16v2H16v-2zm0 4h16v2H16v-2zm0 4h12v2H16v-2z" fill="#3B82F6"/>
          <circle cx="32" cy="32" r="6" fill="#10B981"/>
        </svg>
      ),
      title: 'Universal File Support',
      description: 'View and edit 50+ file formats including PDF, DOCX, XLSX, images, and videos with our advanced viewer.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#10B981" fillOpacity="0.1"/>
          <path d="M20 16a4 4 0 11-8 0 4 4 0 018 0zM36 20a3 3 0 11-6 0 3 3 0 016 0zM28 28a6 6 0 00-12 0v4h12v-4zM32 32v-4a7.97 7.97 0 00-1.5-4.65A4 4 0 0136 28v4h-4z" fill="#10B981"/>
        </svg>
      ),
      title: 'Real-time Collaboration',
      description: 'Work together with your team in real-time. Share files, add comments, and edit documents simultaneously.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#8B5CF6" fillOpacity="0.1"/>
          <path d="M24 8l-8 8h6v8h4v-8h6l-8-8zM16 28v8h16v-8h-4v4H20v-4h-4z" fill="#8B5CF6"/>
        </svg>
      ),
      title: 'AI-Powered Tools',
      description: 'Leverage AI for OCR text extraction, auto-summarization, and intelligent content suggestions.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#F59E0B" fillOpacity="0.1"/>
          <path d="M20 12a8 8 0 108 8v-2a6 6 0 10-6-6h-2zm8 8l4-4-4-4v3h-8v2h8v3z" fill="#F59E0B"/>
        </svg>
      ),
      title: 'Format Conversion',
      description: 'Convert between 300+ file formats instantly. Transform PDFs to Word, images to different formats, and more.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#EF4444" fillOpacity="0.1"/>
          <path d="M24 8a3 3 0 00-3 3v1.17A12 12 0 0012 24c0 6.63 5.37 12 12 12s12-5.37 12-12a12 12 0 00-9-11.83V11a3 3 0 00-3-3z" fill="#EF4444"/>
          <path d="M24 16v8l4 4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Enterprise Security',
      description: 'Bank-grade security with encryption, access controls, and compliance with GDPR and other regulations.'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#06B6D4" fillOpacity="0.1"/>
          <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm-4 30l-8-8 2.83-2.83L20 28.34l11.17-11.17L34 20 20 34z" fill="#06B6D4"/>
        </svg>
      ),
      title: 'Cloud Storage',
      description: 'Seamless integration with AWS S3 and other cloud providers. Access your files anywhere, anytime.'
    }
  ];

  const supportedFormats = [
    { category: 'Documents', formats: ['PDF', 'DOCX', 'XLSX', 'PPTX', 'TXT', 'RTF'] },
    { category: 'Images', formats: ['JPEG', 'PNG', 'GIF', 'SVG', 'WEBP', 'TIFF'] },
    { category: 'Videos', formats: ['MP4', 'AVI', 'MOV', 'WMV', 'FLV', 'WEBM'] },
    { category: 'Audio', formats: ['MP3', 'WAV', 'FLAC', 'AAC', 'OGG'] }
  ];

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Free Online File Reader & Editor
              <span className="hero-highlight"> - Read, Edit & Convert Files Instantly</span>
            </h1>
            <p className="hero-description">
              Start reading and editing your files immediately. No downloads, no registration required. 
              Professional file processing with AI-powered tools and real-time collaboration.
            </p>
            
            {/* Primary File Actions - Front and Center */}
             <div className="primary-file-actions">
               <Link to="/reader" className="primary-action-btn upload-btn-hero">
                 📁 Upload & Read File
               </Link>
               <Link to="/reader" className="primary-action-btn sample-btn-hero">
                 📋 Try Sample PDF
               </Link>
               <Link to="/editor" className="primary-action-btn">
                 🎨 Image Editor
               </Link>
               <Link to="/converter" className="primary-action-btn">
                 🔄 File Converter
               </Link>
             </div>
            
            <div className="hero-actions">
                <Link to="/reader" className="btn btn-primary btn-large">
                  Start Reading Files
                </Link>
                <a href="mailto:sales@fileeditor.pro" className="btn btn-outline btn-large">
                  Contact Sales
                </a>
              </div>
              
              {/* Trust Indicators */}
              <div className="trust-indicators">
                <div className="trust-item">
                  <span className="trust-icon">🔒</span>
                  <span>Enterprise Security</span>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">⚡</span>
                  <span>99.9% Uptime</span>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">🌍</span>
                  <span>Global CDN</span>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">📞</span>
                  <span>24/7 Support</span>
                </div>
              </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">50+</span>
                <span className="stat-label">File Formats</span>
              </div>
              <div className="stat">
                <span className="stat-number">100%</span>
                <span className="stat-label">Browser-based</span>
              </div>
              <div className="stat">
                <span className="stat-number">∞</span>
                <span className="stat-label">File Size</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="file-preview">
              <div className="file-item pdf">
                <div className="file-icon">📄</div>
                <span>document.pdf</span>
              </div>
              <div className="file-item image">
                <div className="file-icon">🖼️</div>
                <span>image.jpg</span>
              </div>
              <div className="file-item video">
                <div className="file-icon">🎥</div>
                <span>video.mp4</span>
              </div>
              <div className="file-item doc">
                <div className="file-icon">📝</div>
                <span>report.docx</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* File Reading & Editing Tools - Prominent Section */}
      <section className="reading-editing-tools">
        <div className="container">
          <h2>🚀 Start Reading & Editing Files Now</h2>
          <p className="section-subtitle">Choose your file processing tool or upload directly to begin</p>
          
          <div className="tools-grid-primary">
             <Link to="/reader" className="tool-card-primary">
               <div className="tool-icon-large">📖</div>
               <h3>File Reader</h3>
               <p>Instantly read PDFs, documents, images, and 50+ formats</p>
               <span className="tool-btn-primary">Start Reading</span>
             </Link>
             <Link to="/editor" className="tool-card-primary">
               <div className="tool-icon-large">✏️</div>
               <h3>File Editor</h3>
               <p>Edit PDFs, annotate documents, modify images</p>
               <span className="tool-btn-primary">Start Editing</span>
             </Link>
             <Link to="/converter" className="tool-card-primary">
               <div className="tool-icon-large">🔄</div>
               <h3>File Converter</h3>
               <p>Convert between formats instantly</p>
               <span className="tool-btn-primary">Convert Files</span>
             </Link>
             <Link to="/ocr" className="tool-card-primary">
               <div className="tool-icon-large">🤖</div>
               <h3>AI Analysis</h3>
               <p>Extract text, analyze content with AI</p>
               <span className="tool-btn-primary">Analyze Files</span>
             </Link>
           </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-description">
              Everything you need to manage, edit, and collaborate on files in one platform
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Formats Section */}
      <section className="formats">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Supported File Formats</h2>
            <p className="section-description">
              Work with all your files in one place - no more switching between different apps
            </p>
          </div>
          <div className="formats-grid">
            {supportedFormats.map((category, index) => (
              <div key={index} className="format-category">
                <h3 className="category-title">{category.category}</h3>
                <div className="format-tags">
                  {category.formats.map((format, formatIndex) => (
                    <span key={formatIndex} className="format-tag">
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Transform Your File Management?</h2>
            <p className="cta-description">
              Join thousands of users who trust our platform for their file management needs.
              Start your free account today and experience the future of file handling.
            </p>
            <div className="cta-actions">
              <Link to="/register" className="btn btn-primary btn-large">
                Start Free Trial
              </Link>
              <a href="mailto:sales@fileeditor.pro" className="btn btn-outline btn-large">
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>FileEditor Pro</h3>
              <p>The world's most powerful online file processing platform. Trusted by millions of users worldwide.</p>
              <div className="contact-info">
                <p><strong>📧 Email:</strong> <a href="mailto:support@fileeditor.pro">support@fileeditor.pro</a></p>
                <p><strong>📞 Phone:</strong> <a href="tel:+15553453348">+1-555-FILE-EDIT</a></p>
                <p><strong>📍 Address:</strong> 123 Tech Street, San Francisco, CA 94105</p>
              </div>
            </div>
            
            <div className="footer-section">
              <h4>Products</h4>
              <ul>
                <li><Link to="/reader">File Reader</Link></li>
                <li><Link to="/editor">File Editor</Link></li>
                <li><Link to="/converter">File Converter</Link></li>
                <li><Link to="/ocr">OCR & AI Analysis</Link></li>
                <li><Link to="/collaboration">Real-time Collaboration</Link></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Support</h4>
              <ul>
                <li><a href="mailto:support@fileeditor.pro">Help Center</a></li>
                <li><a href="mailto:support@fileeditor.pro">Documentation</a></li>
                <li><a href="mailto:support@fileeditor.pro">API Reference</a></li>
                <li><a href="mailto:support@fileeditor.pro">Contact Support</a></li>
                <li><a href="tel:+15553453348">24/7 Phone Support</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Company</h4>
              <ul>
                <li><a href="mailto:info@fileeditor.pro">About Us</a></li>
                <li><a href="mailto:careers@fileeditor.pro">Careers</a></li>
                <li><a href="mailto:press@fileeditor.pro">Press</a></li>
                <li><a href="mailto:partners@fileeditor.pro">Partners</a></li>
                <li><a href="mailto:legal@fileeditor.pro">Legal</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Enterprise</h4>
              <ul>
                <li><a href="mailto:sales@fileeditor.pro">Enterprise Sales</a></li>
                <li><a href="mailto:sales@fileeditor.pro">Custom Solutions</a></li>
                <li><a href="mailto:sales@fileeditor.pro">Volume Pricing</a></li>
                <li><a href="mailto:security@fileeditor.pro">Security & Compliance</a></li>
                <li><a href="mailto:sales@fileeditor.pro">White-label Solutions</a></li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <div className="footer-bottom-content">
              <p>&copy; 2024 FileEditor Pro. All rights reserved.</p>
              <div className="footer-links">
                <a href="mailto:legal@fileeditor.pro">Privacy Policy</a>
                <a href="mailto:legal@fileeditor.pro">Terms of Service</a>
                <a href="mailto:legal@fileeditor.pro">Cookie Policy</a>
                <a href="mailto:security@fileeditor.pro">Security</a>
              </div>
              <div className="social-links">
                <a href="mailto:social@fileeditor.pro" aria-label="Twitter">🐦</a>
                <a href="mailto:social@fileeditor.pro" aria-label="LinkedIn">💼</a>
                <a href="mailto:social@fileeditor.pro" aria-label="GitHub">🐙</a>
                <a href="mailto:social@fileeditor.pro" aria-label="YouTube">📺</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;