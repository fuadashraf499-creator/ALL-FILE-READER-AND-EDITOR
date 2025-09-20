# Universal File Reader and Editor Website

A comprehensive web application for reading, editing, and managing various file types including PDFs, Office documents, images, and videos.

## Features

- **Universal File Support**: View and edit 50+ file formats including PDF, DOCX, XLSX, JPEG, PNG, MP4, AVI
- **Real-time Collaboration**: Multi-user editing with live sync and conflict resolution
- **AI-Powered Tools**: Auto-summarization, OCR, and content suggestions
- **Advanced Security**: OWASP-compliant file validation, encryption, and access control
- **Cloud Storage**: AWS S3 integration for scalable file storage
- **Responsive Design**: Mobile-friendly interface with accessibility compliance

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Apryse WebViewer for file rendering
- Tesseract.js for OCR
- Socket.io for real-time features
- Axios for API communication

### Backend
- Node.js 20+ with Express.js
- JWT authentication with RBAC
- Winston logging and Sentry monitoring
- AWS S3 for file storage
- MongoDB for metadata and version control

### Advanced Tools
- ConvertAPI for file format conversion
- FFmpeg.wasm for video processing
- Hugging Face APIs for AI features
- fflate for compression

## Project Structure

```
file-reader-editor/
├── backend/          # Node.js/Express API server
├── frontend/         # React application
├── docs/            # Documentation
└── README.md        # This file
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- AWS account (for S3 storage)
- ConvertAPI account (for file conversion)

### Installation

1. Clone the repository
2. Install backend dependencies: `cd backend && npm install`
3. Install frontend dependencies: `cd frontend && npm install`
4. Configure environment variables
5. Start development servers

### Environment Variables

Create `.env` files in both backend and frontend directories with the required configuration.

## Deployment

The application is designed for deployment on Render with separate services for frontend and backend.

## Security

- File type validation and MIME checking
- Antivirus scanning integration
- HTTPS enforcement
- JWT-based authentication
- Role-based access control
- Input sanitization and validation

## License

MIT License - see LICENSE file for details