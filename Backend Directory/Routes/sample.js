const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Serve sample documents for testing
router.get('/pdf', (req, res) => {
  try {
    // Set proper headers for PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="sample.pdf"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Check if sample PDF file exists
    const samplePdfPath = path.join(__dirname, '../../test-sample.pdf');
    
    if (fs.existsSync(samplePdfPath)) {
      // Serve the actual sample PDF file
      res.sendFile(path.resolve(samplePdfPath));
    } else {
      // Create a proper PDF content for testing
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 85
>>
stream
BT
/F1 12 Tf
100 700 Td
(FileEditor Pro - Sample Document) Tj
0 -20 Td
(This is a sample PDF for testing file reading capabilities.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000411 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
498
%%EOF`;
      
      res.send(Buffer.from(pdfContent));
    }
  } catch (error) {
    console.error('Error serving sample PDF:', error);
    res.status(500).json({ error: 'Failed to serve sample PDF' });
  }
});

// Serve sample text document
router.get('/text', (req, res) => {
  const textContent = `Sample Text Document

This is a sample text document for testing the file reader and editor.

Features:
- Universal file support
- Real-time collaboration
- AI-powered tools
- Format conversion
- Secure file handling

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

End of document.`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'inline; filename="sample.txt"');
  res.send(textContent);
});

// List available sample files
router.get('/list', (req, res) => {
  const samples = [
    {
      id: 'sample-pdf',
      name: 'Sample PDF Document',
      filename: 'sample.pdf',
      type: 'application/pdf',
      url: '/api/v1/sample/pdf',
      description: 'A simple PDF document for testing'
    },
    {
      id: 'sample-text',
      name: 'Sample Text Document',
      filename: 'sample.txt',
      type: 'text/plain',
      url: '/api/v1/sample/text',
      description: 'A plain text document for testing'
    }
  ];

  res.json({
    success: true,
    samples
  });
});

module.exports = router;