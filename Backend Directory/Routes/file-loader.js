const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const logger = require('../utils/monitoring').logger;

// Load file from local path
router.get('/load-file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Security check - only allow files from QFL directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith('E:\\QFL\\') && !normalizedPath.startsWith('E:/QFL/')) {
      return res.status(403).json({ error: 'Access denied - only QFL directory files allowed' });
    }
    
    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    const mimeTypes = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-chdr',
      '.rs': 'text/x-rustsrc',
      '.go': 'text/x-go',
      '.php': 'text/x-php',
      '.rb': 'text/x-ruby',
      '.swift': 'text/x-swift',
      '.kt': 'text/x-kotlin',
      '.scala': 'text/x-scala',
      '.sh': 'text/x-shellscript',
      '.ps1': 'text/x-powershell',
      '.bat': 'text/x-msdos-batch',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.toml': 'text/x-toml',
      '.ini': 'text/plain',
      '.cfg': 'text/plain',
      '.conf': 'text/plain',
      '.env': 'text/plain',
      '.gitignore': 'text/plain',
      '.qfl': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    
    contentType = mimeTypes[ext] || contentType;
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(normalizedPath)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Stream the file
    const fileStream = fs.createReadStream(normalizedPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      logger.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
    logger.info(`File served: ${normalizedPath}`);
    
  } catch (error) {
    logger.error('File loading error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List files in QFL directory
router.get('/list-qfl-files', async (req, res) => {
  try {
    const qflPath = 'E:\\QFL';
    
    if (!fs.existsSync(qflPath)) {
      return res.status(404).json({ error: 'QFL directory not found' });
    }
    
    const files = fs.readdirSync(qflPath)
      .filter(file => {
        const filePath = path.join(qflPath, file);
        return fs.statSync(filePath).isFile();
      })
      .map(file => {
        const filePath = path.join(qflPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(file).toLowerCase()
        };
      });
    
    res.json({ files });
    
  } catch (error) {
    logger.error('Error listing QFL files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

module.exports = router;