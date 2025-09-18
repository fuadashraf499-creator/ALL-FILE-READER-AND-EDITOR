import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import FileViewer from './pages/FileViewer';
import Settings from './pages/Settings';
import OCRPage from './pages/OCRPage';
import CollaborationPage from './pages/CollaborationPage';

// Services
import { authAPI, isAuthenticated } from './services/api';

// Types
interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        try {
          const response = await authAPI.verify();
          if (response.valid) {
            setUser(response.user);
            localStorage.setItem('user', JSON.stringify(response.user));
          }
        } catch (error) {
          console.error('Auth verification failed:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Header 
          user={user} 
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <div className="app-content">
          {user && (
            <Sidebar 
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          )}
          
          <main className={`main-content ${user ? 'with-sidebar' : ''}`}>
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
                } 
              />
              <Route 
                path="/register" 
                element={
                  user ? <Navigate to="/dashboard" /> : <Register onLogin={handleLogin} />
                } 
              />
              <Route path="/" element={<Home />} />
              
              {/* Public Routes - File Processing */}
              <Route 
                path="/viewer/:fileId?" 
                element={<FileViewer user={user} />}
              />
              <Route 
                path="/reader" 
                element={<FileViewer user={user} />}
              />
              <Route 
                path="/editor" 
                element={<FileViewer user={user} />}
              />
              <Route 
                path="/converter" 
                element={<FileViewer user={user} />}
              />
              <Route 
                path="/ocr" 
                element={<OCRPage user={user} />}
              />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  user ? <Dashboard user={user} /> : <Navigate to="/login" />
                } 
              />
              <Route 
                path="/collaboration" 
                element={<CollaborationPage user={user} />}
              />
              <Route 
                path="/collaboration/:docId" 
                element={<CollaborationPage user={user} />}
              />
              <Route 
                path="/settings" 
                element={
                  user ? <Settings user={user} /> : <Navigate to="/login" />
                } 
              />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
        
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </Router>
  );
}

export default App;
