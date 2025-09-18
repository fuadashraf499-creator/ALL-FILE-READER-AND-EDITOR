import React from 'react';
import './Dashboard.css';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user.username}!</h1>
        <p>Manage your files and collaborate with your team</p>
      </div>
      
      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📄</div>
            <div className="stat-info">
              <h3>Total Files</h3>
              <p className="stat-number">0</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">☁️</div>
            <div className="stat-info">
              <h3>Storage Used</h3>
              <p className="stat-number">0 MB</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <h3>Shared Files</h3>
              <p className="stat-number">0</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🔄</div>
            <div className="stat-info">
              <h3>Conversions</h3>
              <p className="stat-number">0</p>
            </div>
          </div>
        </div>
        
        <div className="dashboard-sections">
          <div className="section">
            <h2>Recent Files</h2>
            <div className="empty-state">
              <p>No files uploaded yet. Start by uploading your first file!</p>
            </div>
          </div>
          
          <div className="section">
            <h2>Quick Actions</h2>
            <div className="quick-actions">
              <button className="action-btn">Upload File</button>
              <button className="action-btn">Convert File</button>
              <button className="action-btn">OCR Tool</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;