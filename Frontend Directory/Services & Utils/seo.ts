import { Helmet } from 'react-helmet-async';

// SEO Configuration
export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  author?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product' | 'profile';
  siteName?: string;
  locale?: string;
  alternateLocales?: string[];
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  noIndex?: boolean;
  noFollow?: boolean;
  canonical?: string;
}

// Default SEO configuration
const DEFAULT_SEO: SEOConfig = {
  title: 'Universal File Reader & Editor',
  description: 'A comprehensive file reader and editor supporting 50+ file formats with AI-powered features, real-time collaboration, and advanced editing tools.',
  keywords: [
    'file reader',
    'file editor',
    'document viewer',
    'PDF editor',
    'universal file viewer',
    'file converter',
    'online editor',
    'collaboration',
    'AI assistant'
  ],
  author: 'File Reader Team',
  type: 'website',
  siteName: 'Universal File Reader & Editor',
  locale: 'en_US',
  url: typeof window !== 'undefined' ? window.location.origin : '',
};

// SEO Manager class
export class SEOManager {
  private static instance: SEOManager;
  private currentConfig: SEOConfig;

  private constructor() {
    this.currentConfig = { ...DEFAULT_SEO };
  }

  public static getInstance(): SEOManager {
    if (!SEOManager.instance) {
      SEOManager.instance = new SEOManager();
    }
    return SEOManager.instance;
  }

  // Update SEO configuration
  public updateSEO(config: Partial<SEOConfig>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...config
    };
  }

  // Get current SEO configuration
  public getCurrentConfig(): SEOConfig {
    return { ...this.currentConfig };
  }

  // Generate meta tags
  public generateMetaTags(): JSX.Element {
    const config = this.currentConfig;
    const fullTitle = config.title;
    const fullUrl = config.url || (typeof window !== 'undefined' ? window.location.href : '');
    const imageUrl = config.image ? (config.image.startsWith('http') ? config.image : `${config.url}${config.image}`) : undefined;

    return (
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{fullTitle}</title>
        <meta name="description" content={config.description} />
        {config.keywords && (
          <meta name="keywords" content={config.keywords.join(', ')} />
        )}
        {config.author && <meta name="author" content={config.author} />}
        
        {/* Robots Meta Tags */}
        <meta 
          name="robots" 
          content={`${
            config.noIndex ? 'noindex' : 'index'
          }, ${
            config.noFollow ? 'nofollow' : 'follow'
          }`} 
        />
        
        {/* Canonical URL */}
        {config.canonical && <link rel="canonical" href={config.canonical} />}
        
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={config.description} />
        <meta property="og:type" content={config.type || 'website'} />
        <meta property="og:url" content={fullUrl} />
        {config.siteName && <meta property="og:site_name" content={config.siteName} />}
        {config.locale && <meta property="og:locale" content={config.locale} />}
        {config.alternateLocales?.map((locale: string) => (
          <meta key={locale} property="og:locale:alternate" content={locale} />
        ))}
        {imageUrl && (
          <>
            <meta property="og:image" content={imageUrl} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={config.title} />
          </>
        )}
        
        {/* Article specific meta tags */}
        {config.type === 'article' && (
          <>
            {config.publishedTime && (
              <meta property="article:published_time" content={config.publishedTime} />
            )}
            {config.modifiedTime && (
              <meta property="article:modified_time" content={config.modifiedTime} />
            )}
            {config.section && (
              <meta property="article:section" content={config.section} />
            )}
            {config.tags?.map((tag: string) => (
              <meta key={tag} property="article:tag" content={tag} />
            ))}
            {config.author && (
              <meta property="article:author" content={config.author} />
            )}
          </>
        )}
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={config.description} />
        {imageUrl && <meta name="twitter:image" content={imageUrl} />}
        
        {/* Additional Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Favicon and App Icons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Theme Color */}
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
      </Helmet>
    );
  }
}

// Schema.org structured data generator
export class SchemaGenerator {
  // Generate Organization schema
  public static generateOrganizationSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Universal File Reader & Editor',
      description: 'A comprehensive file reader and editor supporting 50+ file formats',
      url: typeof window !== 'undefined' ? window.location.origin : '',
      logo: {
        '@type': 'ImageObject',
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/logo512.png`,
        width: 512,
        height: 512
      },
      sameAs: [
        // Add social media URLs here
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['English']
      }
    };
  }

  // Generate WebApplication schema
  public static generateWebApplicationSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Universal File Reader & Editor',
      description: 'A comprehensive file reader and editor supporting 50+ file formats with AI-powered features',
      url: typeof window !== 'undefined' ? window.location.origin : '',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      featureList: [
        'Universal file viewing (50+ formats)',
        'Real-time collaboration',
        'AI-powered content analysis',
        'File format conversion',
        'OCR text extraction',
        'Version control',
        'Advanced editing tools',
        'File compression',
        'Security scanning'
      ],
      screenshot: {
        '@type': 'ImageObject',
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/screenshot.png`
      }
    };
  }

  // Generate SoftwareApplication schema
  public static generateSoftwareApplicationSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Universal File Reader & Editor',
      description: 'A comprehensive file reader and editor supporting 50+ file formats',
      applicationCategory: 'Productivity',
      operatingSystem: 'Web Browser',
      softwareVersion: '1.0.0',
      datePublished: '2024-01-01',
      author: {
        '@type': 'Organization',
        name: 'File Reader Team'
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '150',
        bestRating: '5',
        worstRating: '1'
      }
    };
  }

  // Generate FAQ schema
  public static generateFAQSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What file formats are supported?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We support over 50 file formats including PDF, DOCX, XLSX, PPTX, images, videos, and many more.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is the service free to use?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, our basic file reading and editing features are completely free to use.'
          }
        },
        {
          '@type': 'Question',
          name: 'Can I collaborate with others in real-time?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, we offer real-time collaboration features that allow multiple users to edit documents simultaneously.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is my data secure?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, we implement enterprise-grade security measures including encryption, virus scanning, and secure file handling.'
          }
        }
      ]
    };
  }

  // Generate BreadcrumbList schema
  public static generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url
      }))
    };
  }
}

// Sitemap generator
export class SitemapGenerator {
  private static routes = [
    { path: '/', priority: 1.0, changefreq: 'daily' },
    { path: '/viewer', priority: 0.9, changefreq: 'weekly' },
    { path: '/ocr', priority: 0.8, changefreq: 'weekly' },
    { path: '/collaboration', priority: 0.8, changefreq: 'weekly' },
    { path: '/dashboard', priority: 0.7, changefreq: 'weekly' },
    { path: '/settings', priority: 0.5, changefreq: 'monthly' },
    { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
    { path: '/terms', priority: 0.3, changefreq: 'yearly' },
  ];

  public static generateSitemap(baseUrl: string): string {
    const urls = this.routes.map(route => {
      const lastmod = new Date().toISOString().split('T')[0];
      return `
  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
  }

  public static generateRobotsTxt(baseUrl: string): string {
    return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
  }
}

// Core Web Vitals monitoring
export class CoreWebVitalsMonitor {
  private static metrics: Map<string, number> = new Map();

  public static recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
    
    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', name, {
        event_category: 'Core Web Vitals',
        value: Math.round(value),
        non_interaction: true,
      });
    }
  }

  public static getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  public static getPerformanceScore(): number {
    const cls = this.metrics.get('CLS') || 0;
    const fid = this.metrics.get('FID') || 0;
    const lcp = this.metrics.get('LCP') || 0;

    // Simple scoring algorithm (0-100)
    let score = 100;
    
    // CLS penalty (0.1 = good, 0.25 = poor)
    if (cls > 0.25) score -= 30;
    else if (cls > 0.1) score -= 15;
    
    // FID penalty (100ms = good, 300ms = poor)
    if (fid > 300) score -= 30;
    else if (fid > 100) score -= 15;
    
    // LCP penalty (2.5s = good, 4s = poor)
    if (lcp > 4000) score -= 40;
    else if (lcp > 2500) score -= 20;
    
    return Math.max(0, score);
  }
}

// SEO utility functions
export const seoUtils = {
  // Generate page title with site name
  generateTitle: (pageTitle: string, siteName: string = 'Universal File Reader & Editor'): string => {
    return pageTitle === siteName ? siteName : `${pageTitle} | ${siteName}`;
  },

  // Generate meta description
  generateDescription: (content: string, maxLength: number = 160): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3).trim() + '...';
  },

  // Extract keywords from content
  extractKeywords: (content: string, maxKeywords: number = 10): string[] => {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  },

  // Generate canonical URL
  generateCanonicalUrl: (path: string, baseUrl?: string): string => {
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  },

  // Check if URL is valid
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

// Export singleton instance
export const seoManager = SEOManager.getInstance();

// React hook for SEO
export function useSEO(config: Partial<SEOConfig>) {
  React.useEffect(() => {
    seoManager.updateSEO(config);
  }, [config]);

  return {
    updateSEO: (newConfig: Partial<SEOConfig>) => seoManager.updateSEO(newConfig),
    getCurrentConfig: () => seoManager.getCurrentConfig(),
    generateMetaTags: () => seoManager.generateMetaTags()
  };
}

// Import React for hooks
import React from 'react';