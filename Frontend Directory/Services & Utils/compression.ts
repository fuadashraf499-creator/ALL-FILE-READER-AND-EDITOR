import { gzip, gunzip, deflate, inflate, strToU8, strFromU8, AsyncGzipOptions } from 'fflate';

export interface CompressionResult {
  compressedData: Uint8Array;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: 'gzip' | 'deflate';
}

export interface DecompressionResult {
  decompressedData: Uint8Array;
  originalSize: number;
  decompressedSize: number;
  algorithm: 'gzip' | 'deflate';
}

export interface CompressionOptions {
  level?: number; // 0-9, higher = better compression but slower
  algorithm?: 'gzip' | 'deflate';
  chunkSize?: number;
}

// Convert File to Uint8Array
export const fileToUint8Array = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

// Convert string to Uint8Array
export const stringToUint8Array = (str: string): Uint8Array => {
  return strToU8(str);
};

// Convert Uint8Array to string
export const uint8ArrayToString = (data: Uint8Array): string => {
  return strFromU8(data);
};

// Compress data using gzip
export const compressGzip = async (
  data: Uint8Array,
  options: CompressionOptions = {}
): Promise<CompressionResult> => {
  const { level = 6 } = options;
  
  return new Promise((resolve, reject) => {
    const gzipOptions: AsyncGzipOptions = {
      level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
      mem: level >= 7 ? 12 : 8 // Higher memory for better compression
    };
    
    gzip(data, gzipOptions, (err, compressed) => {
      if (err) {
        reject(new Error(`Gzip compression failed: ${err.message}`));
        return;
      }
      
      const result: CompressionResult = {
        compressedData: compressed,
        originalSize: data.length,
        compressedSize: compressed.length,
        compressionRatio: (1 - compressed.length / data.length) * 100,
        algorithm: 'gzip'
      };
      
      resolve(result);
    });
  });
};

// Decompress gzip data
export const decompressGzip = async (data: Uint8Array): Promise<DecompressionResult> => {
  return new Promise((resolve, reject) => {
    gunzip(data, (err, decompressed) => {
      if (err) {
        reject(new Error(`Gzip decompression failed: ${err.message}`));
        return;
      }
      
      const result: DecompressionResult = {
        decompressedData: decompressed,
        originalSize: data.length,
        decompressedSize: decompressed.length,
        algorithm: 'gzip'
      };
      
      resolve(result);
    });
  });
};

// Compress data using deflate
export const compressDeflate = async (
  data: Uint8Array,
  options: CompressionOptions = {}
): Promise<CompressionResult> => {
  const { level = 6 } = options;
  
  return new Promise((resolve, reject) => {
    deflate(data, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }, (err, compressed) => {
      if (err) {
        reject(new Error(`Deflate compression failed: ${err.message}`));
        return;
      }
      
      const result: CompressionResult = {
        compressedData: compressed,
        originalSize: data.length,
        compressedSize: compressed.length,
        compressionRatio: (1 - compressed.length / data.length) * 100,
        algorithm: 'deflate'
      };
      
      resolve(result);
    });
  });
};

// Decompress deflate data
export const decompressDeflate = async (data: Uint8Array): Promise<DecompressionResult> => {
  return new Promise((resolve, reject) => {
    inflate(data, (err, decompressed) => {
      if (err) {
        reject(new Error(`Deflate decompression failed: ${err.message}`));
        return;
      }
      
      const result: DecompressionResult = {
        decompressedData: decompressed,
        originalSize: data.length,
        decompressedSize: decompressed.length,
        algorithm: 'deflate'
      };
      
      resolve(result);
    });
  });
};

// Generic compression function
export const compressData = async (
  data: Uint8Array,
  options: CompressionOptions = {}
): Promise<CompressionResult> => {
  const { algorithm = 'gzip' } = options;
  
  switch (algorithm) {
    case 'gzip':
      return compressGzip(data, options);
    case 'deflate':
      return compressDeflate(data, options);
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
};

// Generic decompression function
export const decompressData = async (
  data: Uint8Array,
  algorithm: 'gzip' | 'deflate'
): Promise<DecompressionResult> => {
  switch (algorithm) {
    case 'gzip':
      return decompressGzip(data);
    case 'deflate':
      return decompressDeflate(data);
    default:
      throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
  }
};

// Compress a file
export const compressFile = async (
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult & { originalFile: File }> => {
  const data = await fileToUint8Array(file);
  const result = await compressData(data, options);
  
  return {
    ...result,
    originalFile: file
  };
};

// Create a compressed file blob
export const createCompressedBlob = (
  result: CompressionResult,
  originalFileName: string
): Blob => {
  const extension = result.algorithm === 'gzip' ? '.gz' : '.deflate';
  const blob = new Blob([result.compressedData], {
    type: 'application/octet-stream'
  });
  
  // Add metadata as a property (not standard but useful)
  (blob as any).metadata = {
    originalFileName,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    compressionRatio: result.compressionRatio,
    algorithm: result.algorithm
  };
  
  return blob;
};

// Estimate compression benefit
export const estimateCompressionBenefit = async (
  file: File,
  sampleSize: number = 1024 * 10 // 10KB sample
): Promise<{
  estimatedRatio: number;
  worthCompressing: boolean;
  algorithm: 'gzip' | 'deflate';
}> => {
  try {
    // Read a sample of the file
    const data = await fileToUint8Array(file);
    const sample = data.slice(0, Math.min(sampleSize, data.length));
    
    // Test both algorithms on the sample
    const [gzipResult, deflateResult] = await Promise.all([
      compressGzip(sample, { level: 6 }),
      compressDeflate(sample, { level: 6 })
    ]);
    
    // Choose the better algorithm
    const bestResult = gzipResult.compressionRatio > deflateResult.compressionRatio 
      ? gzipResult 
      : deflateResult;
    
    return {
      estimatedRatio: bestResult.compressionRatio,
      worthCompressing: bestResult.compressionRatio > 10, // Worth it if >10% reduction
      algorithm: bestResult.algorithm
    };
  } catch (error) {
    console.error('Error estimating compression benefit:', error);
    return {
      estimatedRatio: 0,
      worthCompressing: false,
      algorithm: 'gzip'
    };
  }
};

// Utility to format file sizes
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Check if file type benefits from compression
export const shouldCompressFileType = (mimeType: string): boolean => {
  // File types that typically don't benefit from compression
  const alreadyCompressed = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mp3',
    'audio/aac',
    'audio/ogg',
    'application/zip',
    'application/gzip',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ];
  
  return !alreadyCompressed.some(type => mimeType.includes(type));
};

// Batch compression for multiple files
export const compressMultipleFiles = async (
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<Array<CompressionResult & { originalFile: File }>> => {
  const results: Array<CompressionResult & { originalFile: File }> = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const result = await compressFile(file, options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to compress file ${file.name}:`, error);
      // Continue with other files
    }
    
    onProgress?.(i + 1, files.length);
  }
  
  return results;
};