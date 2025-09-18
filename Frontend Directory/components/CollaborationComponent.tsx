import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import './CollaborationComponent.css';

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  color?: string;
}

interface Cursor {
  userId: string;
  position: number;
  selection?: {
    start: number;
    end: number;
  };
  user?: User;
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  content: string;
  position: number;
  createdAt: string;
  resolved: boolean;
  replies?: Comment[];
}

interface Operation {
  type: 'insert' | 'delete' | 'retain';
  content?: string;
  length?: number;
  position: number;
}

interface CollaborationComponentProps {
  documentId: string;
  user: User;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onError?: (error: string) => void;
}

const CollaborationComponent: React.FC<CollaborationComponentProps> = ({
  documentId,
  user,
  initialContent = '',
  onContentChange,
  onError
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [users, setUsers] = useState<User[]>([]);
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedText, setSelectedText] = useState<{ start: number; end: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastContentRef = useRef(content);
  const operationQueueRef = useRef<Operation[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate user color
  const getUserColor = useCallback((userId: string) => {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
    ];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      transports: ['websocket'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      setConnected(true);
      toast.success('Connected to collaboration server');
      
      // Join document
      newSocket.emit('join-document', {
        docId: documentId,
        user: {
          ...user,
          color: getUserColor(user.id)
        }
      });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      toast.warning('Disconnected from collaboration server');
    });

    newSocket.on('document-state', (data) => {
      setContent(data.content || '');
      setUsers(data.users || []);
      setCursors(data.cursors || []);
      setComments(data.comments || []);
      lastContentRef.current = data.content || '';
    });

    newSocket.on('user-joined', (data) => {
      setUsers(data.users);
      toast.info(`${data.user.username} joined the document`);
    });

    newSocket.on('user-left', (data) => {
      setUsers(data.users);
      setCursors(prev => prev.filter(cursor => cursor.userId !== data.userId));
    });

    newSocket.on('operation', (data) => {
      if (data.source !== newSocket.id) {
        applyOperation(data.op);
      }
    });

    newSocket.on('cursor-update', (data) => {
      if (data.userId !== newSocket.id) {
        setCursors(prev => {
          const filtered = prev.filter(cursor => cursor.userId !== data.userId);
          return [...filtered, {
            userId: data.userId,
            position: data.cursor.position,
            selection: data.cursor.selection,
            user: users.find(u => u.id === data.userId)
          }];
        });
      }
    });

    newSocket.on('comment-added', (comment) => {
      setComments(prev => [...prev, comment]);
      toast.info(`New comment from ${comment.username}`);
    });

    newSocket.on('comment-updated', (updatedComment) => {
      setComments(prev => prev.map(comment => 
        comment.id === updatedComment.id ? updatedComment : comment
      ));
    });

    newSocket.on('operation-error', (data) => {
      console.error('Operation error:', data.error);
      onError?.(data.error);
    });

    newSocket.on('error', (data) => {
      console.error('Socket error:', data.message);
      onError?.(data.message);
      toast.error(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [documentId, user, getUserColor, onError]);

  // Apply operation to content
  const applyOperation = useCallback((op: Operation[]) => {
    setContent(prevContent => {
      let newContent = prevContent;
      let offset = 0;

      for (const operation of op) {
        if (operation.type === 'insert' && operation.content) {
          newContent = newContent.slice(0, operation.position + offset) + 
                      operation.content + 
                      newContent.slice(operation.position + offset);
          offset += operation.content.length;
        } else if (operation.type === 'delete' && operation.length) {
          newContent = newContent.slice(0, operation.position + offset) + 
                      newContent.slice(operation.position + offset + operation.length);
          offset -= operation.length;
        }
      }

      lastContentRef.current = newContent;
      onContentChange?.(newContent);
      return newContent;
    });
  }, [onContentChange]);

  // Generate operation from content change
  const generateOperation = useCallback((oldContent: string, newContent: string, cursorPos: number): Operation[] => {
    const operations: Operation[] = [];
    
    // Simple diff algorithm - in production, use a proper diff library
    if (newContent.length > oldContent.length) {
      // Insert operation
      const insertedText = newContent.slice(cursorPos - (newContent.length - oldContent.length), cursorPos);
      operations.push({
        type: 'insert',
        content: insertedText,
        position: cursorPos - insertedText.length
      });
    } else if (newContent.length < oldContent.length) {
      // Delete operation
      const deletedLength = oldContent.length - newContent.length;
      operations.push({
        type: 'delete',
        length: deletedLength,
        position: cursorPos
      });
    }

    return operations;
  }, []);

  // Handle text change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(newContent);
    onContentChange?.(newContent);

    if (socket && connected) {
      const operations = generateOperation(lastContentRef.current, newContent, cursorPos);
      
      if (operations.length > 0) {
        socket.emit('operation', {
          docId: documentId,
          op: operations
        });
      }

      // Update cursor position
      socket.emit('cursor-update', {
        docId: documentId,
        cursor: {
          position: cursorPos,
          selection: e.target.selectionStart !== e.target.selectionEnd ? {
            start: e.target.selectionStart,
            end: e.target.selectionEnd
          } : undefined
        }
      });

      // Handle typing indicator
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 1000);
    }

    lastContentRef.current = newContent;
  }, [socket, connected, documentId, generateOperation, onContentChange]);

  // Handle text selection for comments
  const handleTextSelect = useCallback(() => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      
      if (start !== end) {
        setSelectedText({ start, end });
      } else {
        setSelectedText(null);
      }
    }
  }, []);

  // Add comment
  const addComment = useCallback(() => {
    if (!socket || !connected || !selectedText || !newComment.trim()) return;

    socket.emit('add-comment', {
      docId: documentId,
      comment: {
        userId: user.id,
        username: user.username,
        content: newComment.trim(),
        position: selectedText.start,
        selection: selectedText
      }
    });

    setNewComment('');
    setSelectedText(null);
  }, [socket, connected, documentId, user, selectedText, newComment]);

  // Resolve comment
  const resolveComment = useCallback((commentId: string) => {
    if (!socket || !connected) return;

    socket.emit('update-comment', {
      docId: documentId,
      commentId,
      updates: { resolved: true }
    });
  }, [socket, connected, documentId]);

  return (
    <div className="collaboration-component">
      <div className="collaboration-header">
        <div className="document-info">
          <h2>Collaborative Document</h2>
          <div className="connection-status">
            <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></div>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        
        <div className="collaboration-controls">
          <button 
            className={`comments-toggle ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.678 11.894a1 1 0 01.287.801 10.97 10.97 0 01-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 01.71-.074A8.06 8.06 0 008 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894z"/>
            </svg>
            Comments ({comments.filter(c => !c.resolved).length})
          </button>
        </div>
      </div>

      <div className="collaboration-content">
        <div className="editor-section">
          <div className="users-bar">
            <div className="active-users">
              <span className="users-label">Active users:</span>
              {users.map(u => (
                <div 
                  key={u.id} 
                  className="user-avatar"
                  style={{ backgroundColor: u.color || getUserColor(u.id) }}
                  title={u.username}
                >
                  {u.username.charAt(0).toUpperCase()}
                </div>
              ))}
              {users.length === 0 && <span className="no-users">No other users</span>}
            </div>
            
            {isTyping && (
              <div className="typing-indicator">
                <span>Someone is typing...</span>
              </div>
            )}
          </div>

          <div className="editor-container">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              onSelect={handleTextSelect}
              className="collaborative-editor"
              placeholder="Start typing to collaborate..."
              disabled={!connected}
            />
            
            {/* Cursor overlays */}
            <div className="cursor-overlays">
              {cursors.map(cursor => (
                <div
                  key={cursor.userId}
                  className="remote-cursor"
                  style={{
                    left: `${(cursor.position % 80) * 8}px`, // Approximate character width
                    top: `${Math.floor(cursor.position / 80) * 20}px`, // Approximate line height
                    borderColor: cursor.user?.color || getUserColor(cursor.userId)
                  }}
                >
                  <div 
                    className="cursor-label"
                    style={{ backgroundColor: cursor.user?.color || getUserColor(cursor.userId) }}
                  >
                    {cursor.user?.username || 'Anonymous'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedText && (
            <div className="comment-input">
              <div className="selected-text">
                Selected: "{content.slice(selectedText.start, selectedText.end)}"
              </div>
              <div className="comment-form">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="comment-input-field"
                  onKeyPress={(e) => e.key === 'Enter' && addComment()}
                />
                <button onClick={addComment} className="add-comment-btn">
                  Add Comment
                </button>
              </div>
            </div>
          )}
        </div>

        {showComments && (
          <div className="comments-panel">
            <div className="comments-header">
              <h3>Comments</h3>
              <button 
                className="close-comments"
                onClick={() => setShowComments(false)}
              >
                ×
              </button>
            </div>
            
            <div className="comments-list">
              {comments.filter(c => !c.resolved).map(comment => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <strong>{comment.username}</strong>
                    <span className="comment-time">
                      {new Date(comment.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="comment-content">{comment.content}</div>
                  <div className="comment-actions">
                    <button 
                      onClick={() => resolveComment(comment.id)}
                      className="resolve-btn"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
              
              {comments.filter(c => !c.resolved).length === 0 && (
                <div className="no-comments">
                  No active comments. Select text to add a comment.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollaborationComponent;