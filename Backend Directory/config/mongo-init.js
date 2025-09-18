// MongoDB initialization script for Docker setup

// Switch to the application database
db = db.getSiblingDB('fileReaderDB');

// Create application user
db.createUser({
  user: 'fileReaderUser',
  pwd: 'fileReaderPass123',
  roles: [
    {
      role: 'readWrite',
      db: 'fileReaderDB'
    }
  ]
});

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 50,
          description: 'Username must be a string between 3-50 characters'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Email must be a valid email address'
        },
        password: {
          bsonType: 'string',
          minLength: 60,
          maxLength: 60,
          description: 'Password must be a bcrypt hash'
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin', 'moderator'],
          description: 'Role must be one of: user, admin, moderator'
        },
        isActive: {
          bsonType: 'bool',
          description: 'User active status'
        },
        createdAt: {
          bsonType: 'date',
          description: 'User creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'User last update timestamp'
        }
      }
    }
  }
});

db.createCollection('files', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['filename', 'originalName', 'mimeType', 'size', 'uploadedBy'],
      properties: {
        filename: {
          bsonType: 'string',
          description: 'Stored filename'
        },
        originalName: {
          bsonType: 'string',
          description: 'Original filename'
        },
        mimeType: {
          bsonType: 'string',
          description: 'File MIME type'
        },
        size: {
          bsonType: 'long',
          minimum: 0,
          description: 'File size in bytes'
        },
        uploadedBy: {
          bsonType: 'objectId',
          description: 'User ID who uploaded the file'
        },
        s3Key: {
          bsonType: 'string',
          description: 'S3 object key'
        },
        s3Bucket: {
          bsonType: 'string',
          description: 'S3 bucket name'
        },
        isPublic: {
          bsonType: 'bool',
          description: 'File public access status'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'File tags'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional file metadata'
        },
        createdAt: {
          bsonType: 'date',
          description: 'File upload timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'File last update timestamp'
        }
      }
    }
  }
});

db.createCollection('documents', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'type', 'owner'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Document title'
        },
        type: {
          bsonType: 'string',
          enum: ['text', 'json', 'rich-text'],
          description: 'Document type'
        },
        content: {
          bsonType: 'string',
          description: 'Document content'
        },
        owner: {
          bsonType: 'objectId',
          description: 'Document owner user ID'
        },
        collaborators: {
          bsonType: 'array',
          items: {
            bsonType: 'objectId'
          },
          description: 'Collaborator user IDs'
        },
        isPublic: {
          bsonType: 'bool',
          description: 'Document public access status'
        },
        version: {
          bsonType: 'int',
          minimum: 0,
          description: 'Document version number'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Document creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Document last update timestamp'
        }
      }
    }
  }
});

db.createCollection('sessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['sessionId', 'userId', 'expiresAt'],
      properties: {
        sessionId: {
          bsonType: 'string',
          description: 'Session identifier'
        },
        userId: {
          bsonType: 'objectId',
          description: 'User ID'
        },
        data: {
          bsonType: 'object',
          description: 'Session data'
        },
        expiresAt: {
          bsonType: 'date',
          description: 'Session expiration timestamp'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Session creation timestamp'
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });

db.files.createIndex({ uploadedBy: 1 });
db.files.createIndex({ mimeType: 1 });
db.files.createIndex({ createdAt: 1 });
db.files.createIndex({ s3Key: 1 }, { unique: true, sparse: true });
db.files.createIndex({ tags: 1 });

db.documents.createIndex({ owner: 1 });
db.documents.createIndex({ collaborators: 1 });
db.documents.createIndex({ type: 1 });
db.documents.createIndex({ isPublic: 1 });
db.documents.createIndex({ createdAt: 1 });
db.documents.createIndex({ updatedAt: 1 });

db.sessions.createIndex({ sessionId: 1 }, { unique: true });
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Insert default admin user
db.users.insertOne({
  username: 'admin',
  email: 'admin@fileReader.com',
  password: '$2b$10$rQZ8kHWKtGY5uFQQvQQQQeQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', // Change this!
  role: 'admin',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Database initialization completed successfully!');
print('Collections created: users, files, documents, sessions');
print('Indexes created for optimal performance');
print('Default admin user created (email: admin@fileReader.com)');
print('IMPORTANT: Change the default admin password in production!');