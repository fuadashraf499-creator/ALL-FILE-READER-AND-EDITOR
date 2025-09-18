import React, { useRef, useEffect, useState } from 'react';
import WebViewer from '@pdftron/webviewer';
import './WebViewerComponent.css';

interface WebViewerComponentProps {
  fileUrl?: string;
  fileName?: string;
  onError?: (error: string) => void;
  onDocumentLoaded?: () => void;
}

const WebViewerComponent: React.FC<WebViewerComponentProps> = ({
  fileUrl,
  fileName,
  onError,
  onDocumentLoaded
}) => {
  const viewer = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (viewer.current && !instance) {
      WebViewer(
        {
          path: '/webviewer',
          licenseKey: 'demo:1234567890', // Replace with your license key
          initialDoc: fileUrl,
          filename: fileName,
          extension: fileName ? fileName.split('.').pop() : undefined,
          enableRedaction: true,
          enableMeasurement: true,
          enableFilePicker: true,
          fullAPI: true,
          disabledElements: [
            // Customize which elements to disable
          ],
          css: `
            .HeaderItems {
              background-color: #3b82f6;
            }
            .Button {
              border-radius: 4px;
            }
          `
        },
        viewer.current
      ).then((webViewerInstance) => {
        setInstance(webViewerInstance);
        const { documentViewer, annotationManager } = webViewerInstance.Core;
        const { UI } = webViewerInstance;

        // Document loaded event
        documentViewer.addEventListener('documentLoaded', () => {
          setLoading(false);
          onDocumentLoaded?.();
          console.log('Document loaded successfully');
        });

        // Document load error event
        documentViewer.addEventListener('documentLoadError', (error: any) => {
          setLoading(false);
          const errorMessage = error?.message || 'Failed to load document';
          onError?.(errorMessage);
          console.error('Document load error:', error);
        });

        // Annotation events
        annotationManager.addEventListener('annotationChanged', (annotations: any, action: string) => {
          console.log('Annotation changed:', action, annotations);
          // Here you can save annotations to your backend
        });

        // Custom toolbar buttons
        UI.setHeaderItems((header: any) => {
          header.push({
            type: 'actionButton',
            img: '<svg>...</svg>',
            onClick: () => {
              // Custom action
              console.log('Custom button clicked');
            },
            title: 'Custom Action'
          });
        });

        // Enable features
        UI.enableFeatures([UI.Feature.Redaction]);
        UI.enableFeatures([UI.Feature.FilePicker]);
        UI.enableFeatures([UI.Feature.LocalStorage]);
        UI.enableFeatures([UI.Feature.NotesPanel]);
        
        // Set theme
        UI.setTheme(UI.Theme.LIGHT);
      }).catch((error) => {
        console.error('WebViewer initialization error:', error);
        onError?.('Failed to initialize document viewer');
      });
    }
  }, [instance]);

  useEffect(() => {
    if (instance && fileUrl) {
      setLoading(true);
      const { documentViewer } = instance.Core;
      
      documentViewer.loadDocument(fileUrl, {
        filename: fileName,
        extension: fileName ? fileName.split('.').pop() : undefined
      });
    }
  }, [instance, fileUrl, fileName]);

  const downloadDocument = () => {
    if (instance) {
      instance.UI.downloadPdf({
        filename: fileName || 'document.pdf',
        includeAnnotations: true
      });
    }
  };

  const printDocument = () => {
    if (instance) {
      instance.UI.print();
    }
  };

  const saveAnnotations = async () => {
    if (instance) {
      const { annotationManager } = instance.Core;
      const annotations = annotationManager.getAnnotationsList();
      
      // Convert annotations to XFDF format
      const xfdfString = await annotationManager.exportAnnotations();
      
      // Here you would save the annotations to your backend
      console.log('Annotations XFDF:', xfdfString);
      
      // Example: Save to backend
      // await saveAnnotationsToBackend(fileUrl, xfdfString);
    }
  };

  const loadAnnotations = async (xfdfString: string) => {
    if (instance) {
      const { annotationManager } = instance.Core;
      await annotationManager.importAnnotations(xfdfString);
    }
  };

  return (
    <div className="webviewer-container">
      {loading && (
        <div className="webviewer-loading">
          <div className="loading-spinner"></div>
          <p>Loading document...</p>
        </div>
      )}
      
      {fileUrl && (
        <div className="webviewer-toolbar">
          <button 
            className="toolbar-btn"
            onClick={downloadDocument}
            title="Download Document"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12l-4-4h3V4h2v4h3l-4 4z"/>
              <path d="M2 14h12v2H2v-2z"/>
            </svg>
            Download
          </button>
          
          <button 
            className="toolbar-btn"
            onClick={printDocument}
            title="Print Document"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2v2H2a2 2 0 00-2 2v4a2 2 0 002 2h2v2a2 2 0 002 2h4a2 2 0 002-2v-2h2a2 2 0 002-2V6a2 2 0 00-2-2h-2V2a2 2 0 00-2-2H6a2 2 0 00-2 2zm8 10v2H4v-2h8zm0-8V2H4v2h8z"/>
            </svg>
            Print
          </button>
          
          <button 
            className="toolbar-btn"
            onClick={saveAnnotations}
            title="Save Annotations"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.5-11L9 7.5 6.5 5 5 6.5 7.5 9 5 11.5 6.5 13 9 10.5 11.5 13 13 11.5 10.5 9 13 6.5 11.5 5z"/>
            </svg>
            Save
          </button>
        </div>
      )}
      
      <div 
        className="webviewer" 
        ref={viewer}
        style={{ 
          height: fileUrl ? 'calc(100vh - 200px)' : '500px',
          width: '100%'
        }}
      >
        {!fileUrl && (
          <div className="webviewer-placeholder">
            <div className="placeholder-content">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect width="64" height="64" rx="16" fill="#e5e7eb"/>
                <path d="M20 24h24v2H20v-2zm0 6h24v2H20v-2zm0 6h16v2H20v-2z" fill="#9ca3af"/>
              </svg>
              <h3>No Document Selected</h3>
              <p>Upload a file to start viewing and editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebViewerComponent;