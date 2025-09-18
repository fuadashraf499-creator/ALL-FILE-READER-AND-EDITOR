import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import CollaborationComponent from '../components/CollaborationComponent';
import api from '../services/api';
import './CollaborationPage.css';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface CollaborationPageProps {
  user: User | null;
}

interface Document {
  id: string;
  title: string;
  type: string;
  isPublic: boolean;
  owner: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

const CollaborationPage: React.FC<CollaborationPageProps> = ({ user }) => {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('text');
  const [newDocPublic, setNewDocPublic] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);

  // Load document if docId is provided
  useEffect(() => {
    if (docId) {
      loadDocument(docId);
    } else {
      loadRecentDocuments();
      setLoading(false);
    }
  }, [docId]);

  const loadDocument = async (documentId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/collaboration/documents/${documentId}`);
      
      if (response.data.success) {
        setDocument(response.data.document);
        setError(null);
      } else {
        setError(response.data.error || 'Failed to load document');
      }
    } catch (error: any) {
      console.error('Error loading document:', error);
      const message = error.response?.data?.error || 'Failed to load document';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentDocuments = async () => {
    try {
      const response = await api.get('/collaboration/documents?limit=10');
      
      if (response.data.success) {
        setRecentDocuments(response.data.documents);
      }
    } catch (error: any) {
      console.error('Error loading recent documents:', error);
    }
  };

  const createDocument = async () => {
    if (!newDocTitle.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    try {
      const response = await api.post('/collaboration/documents', {
        title: newDocTitle.trim(),
        type: newDocType,
        isPublic: newDocPublic,
        content: ''
      });

      if (response.data.success) {
        const newDoc = response.data.document;
        toast.success('Document created successfully!');
        navigate(`/collaboration/${newDoc.id}`);
        setShowCreateModal(false);
        setNewDocTitle('');
        setNewDocType('text');
        setNewDocPublic(false);
      } else {
        toast.error(response.data.error || 'Failed to create document');
      }
    } catch (error: any) {
      console.error('Error creating document:', error);
      const message = error.response?.data?.error || 'Failed to create document';
      toast.error(message);
    }
  };

  const handleContentChange = (content: string) => {
    // Content is automatically synced through the collaboration component
    console.log('Content updated:', content.length, 'characters');
  };

  const handleCollaborationError = (errorMessage: string) => {
    setError(errorMessage);
    toast.error(errorMessage);
  };

  if (loading) {
    return (
      <div className="collaboration-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error && docId) {
    return (
      <div className="collaboration-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Document Error</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button 
              onClick={() => navigate('/collaboration')}
              className="btn btn-primary"
            >
              Back to Documents
            </button>
            <button 
              onClick={() => loadDocument(docId!)}
              className="btn btn-secondary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Document list view
  if (!docId) {
    return (
      <div className="collaboration-page">
        <div className="page-header">
          <div className="header-content">
            <h1>Collaborative Documents</h1>
            <p>Create and edit documents in real-time with your team</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
            </svg>
            New Document
          </button>
        </div>

        <div className="documents-grid">
          {recentDocuments.length > 0 ? (
            recentDocuments.map(doc => (
              <div 
                key={doc.id} 
                className="document-card"
                onClick={() => navigate(`/collaboration/${doc.id}`)}
              >
                <div className="document-header">
                  <h3>{doc.title}</h3>
                  <div className="document-type">{doc.type.toUpperCase()}</div>
                </div>
                <div className="document-meta">
                  <div className="document-owner">
                    <span className="owner-avatar">
                      {doc.owner.username.charAt(0).toUpperCase()}
                    </span>
                    <span>{doc.owner.username}</span>
                  </div>
                  <div className="document-date">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="document-status">
                  {doc.isPublic ? (
                    <span className="status-badge public">Public</span>
                  ) : (
                    <span className="status-badge private">Private</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No documents yet</h3>
              <p>Create your first collaborative document to get started</p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                Create Document
              </button>
            </div>
          )}
        </div>

        {/* Create Document Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Document</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="doc-title">Document Title</label>
                  <input
                    id="doc-title"
                    type="text"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="Enter document title..."
                    className="form-input"
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="doc-type">Document Type</label>
                  <select
                    id="doc-type"
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                    className="form-select"
                  >
                    <option value="text">Plain Text</option>
                    <option value="rich-text">Rich Text</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newDocPublic}
                      onChange={(e) => setNewDocPublic(e.target.checked)}
                      className="checkbox"
                    />
                    <span>Make document public</span>
                  </label>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={createDocument}
                  className="btn btn-primary"
                >
                  Create Document
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="features-section">
          <h2>Collaboration Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-time Editing</h3>
              <p>See changes from other users instantly as they type</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>User Presence</h3>
              <p>See who's online and where they're working in the document</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Comments & Feedback</h3>
              <p>Add comments and collaborate on specific parts of the document</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Operational Transform</h3>
              <p>Advanced conflict resolution ensures data consistency</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Document editor view
  return (
    <div className="collaboration-page">
      <div className="document-header">
        <div className="document-info">
          <button 
            onClick={() => navigate('/collaboration')}
            className="back-btn"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>
          <div className="document-details">
            <h1>{document?.title}</h1>
            <div className="document-meta">
              <span>by {document?.owner.username}</span>
              <span>•</span>
              <span>{document?.type.toUpperCase()}</span>
              <span>•</span>
              <span>{document?.isPublic ? 'Public' : 'Private'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="collaboration-editor">
        <CollaborationComponent
          documentId={docId!}
          user={{
            id: user.id.toString(),
            username: user.username,
            email: user.email
          }}
          onContentChange={handleContentChange}
          onError={handleCollaborationError}
        />
      </div>
    </div>
  );
};

export default CollaborationPage;