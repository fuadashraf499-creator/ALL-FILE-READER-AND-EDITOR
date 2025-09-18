import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { toast } from 'react-toastify';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    const { response } = error;
    
    if (response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      toast.error('Session expired. Please login again.');
    } else if (response?.status === 429) {
      toast.error('Too many requests. Please try again later.');
    } else if (response?.status && response.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.');
    }
    
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface FileInfo {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  url: string;
  uploadedAt: string;
}

export interface UploadResponse {
  success: boolean;
  file: FileInfo;
}

export interface ConversionRequest {
  fileUrl: string;
  fromFormat: string;
  toFormat: string;
  options?: {
    quality?: number;
    width?: number;
    height?: number;
    dpi?: number;
    pageRange?: string;
    password?: string;
  };
}

export interface ConversionResponse {
  success: boolean;
  conversion: {
    fromFormat: string;
    toFormat: string;
    originalUrl: string;
    convertedUrl: string;
    fileName: string;
    fileSize: number;
    options: any;
    convertedAt: string;
  };
  note: string;
}

export interface OCRRequest {
  imageUrl: string;
  language?: string;
  options?: {
    psm?: number;
    oem?: number;
  };
}

// Auth API
export const authAPI = {
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  verify: async (): Promise<{ valid: boolean; user: User }> => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// Upload API
export const uploadAPI = {
  simple: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload/simple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        console.log(`Upload Progress: ${percentCompleted}%`);
      },
    });
    
    return response.data;
  },

  chunk: async (file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload/chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        onProgress?.(percentCompleted);
      },
    });
    
    return response.data;
  },

  getInfo: async (fileId: string): Promise<{ success: boolean; file: FileInfo }> => {
    const response = await api.get(`/upload/info/${fileId}`);
    return response.data;
  },

  getSignedUrl: async (
    fileId: string,
    action: string = 'getObject',
    expires: number = 3600
  ): Promise<{ success: boolean; signedUrl: string; expiresIn: number }> => {
    const response = await api.get(`/upload/signed-url/${fileId}`, {
      params: { action, expires },
    });
    return response.data;
  },
};

// Conversion API
export const conversionAPI = {
  convert: async (request: ConversionRequest): Promise<ConversionResponse> => {
    const response = await api.post('/convert/convert', request);
    return response.data;
  },

  getFormats: async (): Promise<{
    success: boolean;
    supportedConversions: Record<string, string[]>;
    totalFormats: number;
    categories: Record<string, string[]>;
  }> => {
    const response = await api.get('/convert/formats');
    return response.data;
  },

  checkSupport: async (
    fromFormat: string,
    toFormat: string
  ): Promise<{
    success: boolean;
    fromFormat: string;
    toFormat: string;
    supported: boolean;
    alternatives: string[];
  }> => {
    const response = await api.get(`/convert/check/${fromFormat}/${toFormat}`);
    return response.data;
  },

  batchConvert: async (conversions: ConversionRequest[]): Promise<{
    success: boolean;
    results: any[];
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> => {
    const response = await api.post('/convert/batch', { conversions });
    return response.data;
  },
};

// OCR API
export const ocrAPI = {
  extract: (data: { fileUrl: string; language?: string }) =>
    api.post('/ocr/extract', data),
  
  getLanguages: () => {
    // Return common languages for Tesseract.js
    return Promise.resolve({
      languages: {
        'eng': 'English',
        'spa': 'Spanish',
        'fra': 'French',
        'deu': 'German',
        'ita': 'Italian',
        'por': 'Portuguese',
        'rus': 'Russian',
        'chi_sim': 'Chinese (Simplified)',
        'chi_tra': 'Chinese (Traditional)',
        'jpn': 'Japanese',
        'kor': 'Korean',
        'ara': 'Arabic',
        'hin': 'Hindi',
        'tha': 'Thai',
        'vie': 'Vietnamese',
        'nld': 'Dutch',
        'swe': 'Swedish',
        'dan': 'Danish',
        'nor': 'Norwegian',
        'fin': 'Finnish'
      }
    });
  },
  
  getStatus: (jobId: string) => api.get(`/ocr/status/${jobId}`),
  
  getConfig: () => api.get('/ocr/config')
};

// Health check
export const healthAPI = {
  check: async (): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
  }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

// Utility functions
export const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export default api;