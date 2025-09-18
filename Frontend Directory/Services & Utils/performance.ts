import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

// Web Vitals monitoring
export class WebVitalsMonitor {
  private metrics: Map<string, Metric> = new Map();
  private callbacks: Array<(metric: Metric) => void> = [];

  constructor() {
    this.initializeWebVitals();
  }

  private initializeWebVitals() {
    // Cumulative Layout Shift
    getCLS((metric) => {
      this.handleMetric(metric);
    });

    // First Input Delay
    getFID((metric) => {
      this.handleMetric(metric);
    });

    // First Contentful Paint
    getFCP((metric) => {
      this.handleMetric(metric);
    });

    // Largest Contentful Paint
    getLCP((metric) => {
      this.handleMetric(metric);
    });

    // Time to First Byte
    getTTFB((metric) => {
      this.handleMetric(metric);
    });
  }

  private handleMetric(metric: Metric) {
    this.metrics.set(metric.name, metric);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric);
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(metric);
    }

    // Call registered callbacks
    this.callbacks.forEach(callback => callback(metric));
  }

  private sendToAnalytics(metric: Metric) {
    // Send to your analytics service
    // Example: Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // Example: Custom analytics endpoint
    fetch('/api/v1/analytics/web-vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        delta: metric.delta,
        rating: this.getRating(metric),
        url: window.location.href,
        timestamp: Date.now(),
      }),
    }).catch(error => {
      console.warn('Failed to send Web Vitals to analytics:', error);
    });
  }

  private getRating(metric: Metric): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      CLS: [0.1, 0.25],
      FID: [100, 300],
      FCP: [1800, 3000],
      LCP: [2500, 4000],
      TTFB: [800, 1800],
    };

    const [good, poor] = thresholds[metric.name as keyof typeof thresholds] || [0, 0];
    
    if (metric.value <= good) return 'good';
    if (metric.value <= poor) return 'needs-improvement';
    return 'poor';
  }

  public onMetric(callback: (metric: Metric) => void) {
    this.callbacks.push(callback);
  }

  public getMetrics() {
    return Array.from(this.metrics.values());
  }

  public getMetric(name: string) {
    return this.metrics.get(name);
  }
}

// Lazy loading utilities
export class LazyLoader {
  private observer: IntersectionObserver;
  private loadedElements = new Set<Element>();

  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: '50px',
        threshold: 0.1,
        ...options,
      }
    );
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting && !this.loadedElements.has(entry.target)) {
        this.loadElement(entry.target);
        this.loadedElements.add(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  private loadElement(element: Element) {
    // Handle images
    if (element instanceof HTMLImageElement) {
      const dataSrc = element.getAttribute('data-src');
      if (dataSrc) {
        element.src = dataSrc;
        element.removeAttribute('data-src');
      }
    }

    // Handle background images
    const dataBg = element.getAttribute('data-bg');
    if (dataBg) {
      (element as HTMLElement).style.backgroundImage = `url(${dataBg})`;
      element.removeAttribute('data-bg');
    }

    // Handle custom load events
    const loadEvent = new CustomEvent('lazyload', { detail: { element } });
    element.dispatchEvent(loadEvent);
  }

  public observe(element: Element) {
    this.observer.observe(element);
  }

  public unobserve(element: Element) {
    this.observer.unobserve(element);
    this.loadedElements.delete(element);
  }

  public disconnect() {
    this.observer.disconnect();
    this.loadedElements.clear();
  }
}

// Image optimization utilities
export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  public static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  public async compressImage(
    file: File,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: string;
    } = {}
  ): Promise<Blob> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight
          );

          // Set canvas size
          this.canvas.width = width;
          this.canvas.height = height;

          // Draw and compress
          this.ctx.drawImage(img, 0, 0, width, height);
          
          this.canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            format,
            quality
          );
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    // Calculate scaling factor
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio, 1);

    width *= ratio;
    height *= ratio;

    return { width: Math.round(width), height: Math.round(height) };
  }

  public generateResponsiveImageSrcSet(
    baseUrl: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): string {
    return sizes
      .map(size => `${baseUrl}?w=${size} ${size}w`)
      .join(', ');
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private marks = new Map<string, number>();
  private measures = new Map<string, number>();

  public mark(name: string) {
    const timestamp = performance.now();
    this.marks.set(name, timestamp);
    
    if (performance.mark) {
      performance.mark(name);
    }
  }

  public measure(name: string, startMark?: string, endMark?: string) {
    let duration: number;

    if (startMark && this.marks.has(startMark)) {
      const startTime = this.marks.get(startMark)!;
      const endTime = endMark && this.marks.has(endMark) 
        ? this.marks.get(endMark)! 
        : performance.now();
      
      duration = endTime - startTime;
    } else {
      duration = performance.now();
    }

    this.measures.set(name, duration);

    if (performance.measure && startMark) {
      try {
        performance.measure(name, startMark, endMark);
      } catch (error) {
        console.warn('Performance measure failed:', error);
      }
    }

    return duration;
  }

  public getMeasure(name: string): number | undefined {
    return this.measures.get(name);
  }

  public getAllMeasures(): Record<string, number> {
    return Object.fromEntries(this.measures);
  }

  public clearMarks() {
    this.marks.clear();
    if (performance.clearMarks) {
      performance.clearMarks();
    }
  }

  public clearMeasures() {
    this.measures.clear();
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }

  public getNavigationTiming() {
    if (!performance.getEntriesByType) return null;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return null;

    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ssl: navigation.secureConnectionStart > 0 
        ? navigation.connectEnd - navigation.secureConnectionStart 
        : 0,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domParsing: navigation.domContentLoadedEventStart - navigation.responseEnd,
      resourceLoading: navigation.loadEventStart - navigation.domContentLoadedEventStart,
      total: navigation.loadEventEnd - navigation.navigationStart,
    };
  }
}

// Resource loading utilities
export class ResourceLoader {
  private static loadedResources = new Set<string>();
  private static loadingPromises = new Map<string, Promise<any>>();

  public static async loadScript(src: string): Promise<void> {
    if (this.loadedResources.has(src)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => {
        this.loadedResources.add(src);
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error(`Failed to load script: ${src}`));
      };
      
      document.head.appendChild(script);
    });

    this.loadingPromises.set(src, promise);
    
    try {
      await promise;
    } finally {
      this.loadingPromises.delete(src);
    }
  }

  public static async loadCSS(href: string): Promise<void> {
    if (this.loadedResources.has(href)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(href)) {
      return this.loadingPromises.get(href)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      link.onload = () => {
        this.loadedResources.add(href);
        resolve();
      };
      
      link.onerror = () => {
        reject(new Error(`Failed to load CSS: ${href}`));
      };
      
      document.head.appendChild(link);
    });

    this.loadingPromises.set(href, promise);
    
    try {
      await promise;
    } finally {
      this.loadingPromises.delete(href);
    }
  }

  public static preloadResource(href: string, as: string = 'fetch') {
    if (this.loadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    
    document.head.appendChild(link);
    this.loadedResources.add(href);
  }

  public static prefetchResource(href: string) {
    if (this.loadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    
    document.head.appendChild(link);
    this.loadedResources.add(href);
  }
}

// Bundle splitting and code splitting utilities
export const loadComponent = async <T>(importFn: () => Promise<{ default: T }>): Promise<T> => {
  try {
    const module = await importFn();
    return module.default;
  } catch (error) {
    console.error('Failed to load component:', error);
    throw error;
  }
};

// Memory management utilities
export class MemoryManager {
  private static observers = new Set<() => void>();

  public static addMemoryPressureObserver(callback: () => void) {
    this.observers.add(callback);
  }

  public static removeMemoryPressureObserver(callback: () => void) {
    this.observers.delete(callback);
  }

  public static checkMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usageRatio > 0.8) {
        console.warn('High memory usage detected:', {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          ratio: usageRatio
        });
        
        // Notify observers
        this.observers.forEach(callback => callback());
      }
      
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        ratio: usageRatio
      };
    }
    
    return null;
  }

  public static requestIdleCallback(callback: () => void, timeout = 5000) {
    if ('requestIdleCallback' in window) {
      return (window as any).requestIdleCallback(callback, { timeout });
    } else {
      return setTimeout(callback, 1);
    }
  }
}

// Initialize performance monitoring
export const webVitalsMonitor = new WebVitalsMonitor();
export const performanceMonitor = new PerformanceMonitor();
export const lazyLoader = new LazyLoader();

// Export utilities
export {
  WebVitalsMonitor,
  LazyLoader,
  ImageOptimizer,
  PerformanceMonitor,
  ResourceLoader,
  MemoryManager
};