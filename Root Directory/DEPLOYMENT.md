# Deployment Guide - Universal File Reader and Editor

This guide covers multiple deployment options for the Universal File Reader and Editor application.

## 🚀 Quick Start Options

### Option 1: Render Platform (Recommended)
### Option 2: Docker Deployment
### Option 3: Manual VPS Deployment
### Option 4: Local Development

---

## 🌐 Option 1: Render Platform Deployment

### Prerequisites
- GitHub repository with your code
- Render account
- Environment variables configured

### Steps

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables**
   Set these in Render dashboard:
   ```
   # Required
   JWT_SECRET=your-super-secret-jwt-key-256-bits-minimum
   
   # AWS S3 (Optional but recommended)
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   
   # ConvertAPI (Optional)
   CONVERTAPI_SECRET=your-convertapi-secret
   
   # MongoDB (Auto-configured by Render)
   MONGODB_URI=auto-generated-by-render
   ```

4. **Deploy**
   - Click "Apply" in Render
   - Wait for deployment to complete
   - Access your app at the provided URL

### Render Configuration Details

- **Backend**: Node.js service with health checks
- **Frontend**: Static site with build optimization
- **Database**: MongoDB with automatic backups
- **Redis**: Session storage and caching
- **SSL**: Automatic HTTPS certificates
- **CDN**: Global content delivery

---

## 🐳 Option 2: Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- 4GB+ RAM recommended
- 10GB+ disk space

### Development Environment

1. **Clone and setup**
   ```bash
   git clone <your-repo>
   cd file-reader-editor
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. **Configure environment**
   Edit `backend/.env`:
   ```env
   NODE_ENV=development
   JWT_SECRET=your-development-secret-key
   MONGODB_URI=mongodb://admin:password123@mongodb:27017/fileReaderDB?authSource=admin
   REDIS_URL=redis://redis:6379
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Access application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MongoDB: localhost:27017
   - Redis: localhost:6379

### Production Environment

1. **Build production images**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

2. **Configure SSL**
   - Place SSL certificates in `nginx/ssl/`
   - Update domain in nginx configuration

3. **Scale services**
   ```bash
   docker-compose up -d --scale backend=3 --scale worker=2
   ```

### Docker Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart backend

# Update and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Database backup
docker exec file-reader-mongodb mongodump --out /backup

# Clean up
docker-compose down -v
docker system prune -a
```

---

## 🖥️ Option 3: Manual VPS Deployment

### Prerequisites
- Ubuntu 20.04+ or CentOS 8+ VPS
- 2GB+ RAM, 20GB+ disk
- Root or sudo access

### Server Setup

1. **Update system**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y curl wget git nginx certbot python3-certbot-nginx
   ```

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **Install MongoDB**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt update
   sudo apt install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

4. **Install Redis**
   ```bash
   sudo apt install -y redis-server
   sudo systemctl start redis
   sudo systemctl enable redis
   ```

### Application Deployment

1. **Clone repository**
   ```bash
   cd /opt
   sudo git clone <your-repo> file-reader-editor
   sudo chown -R $USER:$USER file-reader-editor
   cd file-reader-editor
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm ci --production
   
   # Frontend
   cd ../frontend
   npm ci
   npm run build
   ```

3. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with production values
   ```

4. **Setup PM2 (Process Manager)**
   ```bash
   sudo npm install -g pm2
   cd backend
   pm2 start server.js --name "file-reader-backend"
   pm2 startup
   pm2 save
   ```

5. **Configure Nginx**
   ```bash
   sudo cp nginx/nginx.conf /etc/nginx/sites-available/file-reader
   sudo ln -s /etc/nginx/sites-available/file-reader /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

6. **Setup SSL**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Maintenance Commands

```bash
# View application logs
pm2 logs file-reader-backend

# Restart application
pm2 restart file-reader-backend

# Update application
cd /opt/file-reader-editor
git pull
cd backend && npm ci --production
cd ../frontend && npm ci && npm run build
pm2 restart file-reader-backend
sudo systemctl reload nginx

# Monitor resources
pm2 monit
htop
```

---

## 💻 Option 4: Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or cloud)
- Redis (optional)

### Setup

1. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Start services**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend
   npm start
   ```

4. **Access application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

---

## 🔧 Environment Variables Reference

### Backend (.env)
```env
# Application
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-url.com

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-256-bits
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Database
MONGODB_URI=mongodb://username:password@host:port/database
REDIS_URL=redis://host:port

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# External APIs
CONVERTAPI_SECRET=your-convertapi-secret

# Logging
LOG_LEVEL=info
LOG_FILE=logs/combined.log
```

### Frontend (.env)
```env
# API Configuration
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_ENVIRONMENT=production

# Build Configuration
GENERATE_SOURCEMAP=false
REACT_APP_VERSION=$npm_package_version
```

---

## 🔒 Security Checklist

### Pre-deployment
- [ ] Change default passwords
- [ ] Generate strong JWT secret
- [ ] Configure HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Set secure headers
- [ ] Enable audit logging

### Post-deployment
- [ ] Test all endpoints
- [ ] Verify file uploads work
- [ ] Check real-time collaboration
- [ ] Test authentication flows
- [ ] Monitor error logs
- [ ] Set up backup procedures
- [ ] Configure monitoring alerts

---

## 📊 Monitoring and Maintenance

### Health Checks
- Backend: `GET /api/v1/health`
- Database: MongoDB connection status
- Redis: Cache connectivity
- File Storage: S3 bucket access

### Log Locations
- Application: `backend/logs/`
- Nginx: `/var/log/nginx/`
- MongoDB: `/var/log/mongodb/`
- PM2: `~/.pm2/logs/`

### Backup Strategy
```bash
# Database backup
mongodump --uri="$MONGODB_URI" --out=/backup/$(date +%Y%m%d)

# File backup (if using local storage)
tar -czf /backup/files-$(date +%Y%m%d).tar.gz backend/uploads/

# Configuration backup
cp backend/.env /backup/env-$(date +%Y%m%d).backup
```

---

## 🆘 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   sudo lsof -i :5000
   sudo kill -9 <PID>
   ```

2. **MongoDB connection failed**
   ```bash
   sudo systemctl status mongod
   sudo systemctl restart mongod
   ```

3. **File upload fails**
   - Check disk space: `df -h`
   - Verify permissions: `ls -la backend/uploads/`
   - Check AWS credentials

4. **Frontend build fails**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

5. **SSL certificate issues**
   ```bash
   sudo certbot renew --dry-run
   sudo nginx -t
   ```

### Performance Optimization

1. **Enable caching**
   - Redis for sessions
   - CDN for static assets
   - Browser caching headers

2. **Database optimization**
   - Create proper indexes
   - Monitor slow queries
   - Regular maintenance

3. **File storage**
   - Use S3 for production
   - Enable compression
   - Implement cleanup jobs

---

## 📞 Support

For deployment issues:
1. Check logs first
2. Verify environment variables
3. Test individual components
4. Review security settings
5. Monitor resource usage

**Remember**: Always test deployments in a staging environment first!