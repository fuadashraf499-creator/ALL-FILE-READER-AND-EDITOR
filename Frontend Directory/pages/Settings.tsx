import React, { useState } from 'react';
import './Settings.css';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface SettingsProps {
  user: User;
}

const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSave: true,
    compression: true
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'billing', label: 'Billing', icon: '💳' }
  ];

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account and application preferences</p>
      </div>

      <div className="settings-content">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-main">
          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>Profile Information</h2>
              <div className="profile-form">
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" value={user.username} readOnly />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={user.email} readOnly />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input type="text" value={user.role} readOnly />
                </div>
                <button className="btn btn-primary">Update Profile</button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-section">
              <h2>Application Preferences</h2>
              <div className="preferences-form">
                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Email Notifications</h4>
                    <p>Receive email notifications for file activities</p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Dark Mode</h4>
                    <p>Use dark theme for the interface</p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.darkMode}
                      onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Auto-save</h4>
                    <p>Automatically save changes while editing</p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <h4>File Compression</h4>
                    <p>Compress files before upload to save space</p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.compression}
                      onChange={(e) => handleSettingChange('compression', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-section">
              <h2>Security Settings</h2>
              <div className="security-form">
                <div className="security-item">
                  <h4>Change Password</h4>
                  <p>Update your account password</p>
                  <button className="btn btn-outline">Change Password</button>
                </div>

                <div className="security-item">
                  <h4>Two-Factor Authentication</h4>
                  <p>Add an extra layer of security to your account</p>
                  <button className="btn btn-outline">Enable 2FA</button>
                </div>

                <div className="security-item">
                  <h4>Active Sessions</h4>
                  <p>Manage your active login sessions</p>
                  <button className="btn btn-outline">View Sessions</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="settings-section">
              <h2>Billing & Usage</h2>
              <div className="billing-info">
                <div className="plan-info">
                  <h4>Current Plan: Free</h4>
                  <p>You're currently on the free plan</p>
                </div>

                <div className="usage-stats">
                  <div className="usage-item">
                    <span className="usage-label">Storage Used</span>
                    <span className="usage-value">0 MB / 1 GB</span>
                  </div>
                  <div className="usage-item">
                    <span className="usage-label">Files Uploaded</span>
                    <span className="usage-value">0 / 100</span>
                  </div>
                  <div className="usage-item">
                    <span className="usage-label">Conversions</span>
                    <span className="usage-value">0 / 10</span>
                  </div>
                </div>

                <button className="btn btn-primary">Upgrade Plan</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;