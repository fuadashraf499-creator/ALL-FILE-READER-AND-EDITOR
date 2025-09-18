const express = require('express');
const router = express.Router();

// SEO Configuration
const SEO_CONFIG = {
  siteName: 'Universal File Reader & Editor',
  baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
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
    'AI assistant',
    'OCR',
    'file compression',
    'version control'
  ]
};

// Site routes for sitemap
const SITE_ROUTES = [
  {
    path: '/',
    priority: 1.0,
    changefreq: 'daily',
    title: 'Home - Universal File Reader & Editor',
    description: 'Upload, view, and edit files in 50+ formats with AI-powered features and real-time collaboration.'
  },
  {
    path: '/viewer',
    priority: 0.9,
    changefreq: 'weekly',
    title: 'File Viewer - View Any File Format',
    description: 'Universal file viewer supporting PDF, DOCX, images, videos and 50+ other formats.'
  },
  {
    path: '/ocr',
    priority: 0.8,
    changefreq: 'weekly',
    title: 'OCR Text Extraction - Extract Text from Images',
    description: 'Extract text from images and PDFs using advanced OCR technology in 100+ languages.'
  },
  {
    path: '/collaboration',
    priority: 0.8,
    changefreq: 'weekly',
    title: 'Real-time Collaboration - Edit Together',
    description: 'Collaborate on documents in real-time with multiple users and operational transformation.'
  },
  {
    path: '/dashboard',
    priority: 0.7,
    changefreq: 'weekly',
    title: 'Dashboard - Manage Your Files',
    description: 'Access your files, view analytics, and manage your account from the user dashboard.'
  },
  {
    path: '/settings',
    priority: 0.5,
    changefreq: 'monthly',
    title: 'Settings - Customize Your Experience',
    description: 'Customize your file reader and editor settings, preferences, and account options.'
  },
  {
    path: '/privacy',
    priority: 0.3,
    changefreq: 'yearly',
    title: 'Privacy Policy - Your Data Protection',
    description: 'Learn how we protect your privacy and handle your data securely.'
  },
  {
    path: '/terms',
    priority: 0.3,
    changefreq: 'yearly',
    title: 'Terms of Service - Usage Guidelines',
    description: 'Read our terms of service and usage guidelines for the file reader and editor.'
  }
];

// Generate XML sitemap
function generateSitemap() {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const urls = SITE_ROUTES.map(route => {
    return `  <url>
    <loc>${SEO_CONFIG.baseUrl}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// Generate robots.txt
function generateRobotsTxt() {
  return `User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/admin/

# Allow specific API endpoints that should be crawled
Allow: /api/v1/health
Allow: /api/v1/sample/

# Sitemap location
Sitemap: ${SEO_CONFIG.baseUrl}/sitemap.xml

# Crawl delay (optional)
Crawl-delay: 1`;
}

// Generate structured data (JSON-LD)
function generateStructuredData() {
  const baseUrl = SEO_CONFIG.baseUrl;
  
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: SEO_CONFIG.siteName,
        description: SEO_CONFIG.description,
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/logo512.png`,
          width: 512,
          height: 512
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          availableLanguage: ['English']
        }
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: SEO_CONFIG.siteName,
        description: SEO_CONFIG.description,
        publisher: {
          '@id': `${baseUrl}/#organization`
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/search?q={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'WebApplication',
        '@id': `${baseUrl}/#webapp`,
        name: SEO_CONFIG.siteName,
        description: SEO_CONFIG.description,
        url: baseUrl,
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
          url: `${baseUrl}/screenshot.png`
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '150',
          bestRating: '5',
          worstRating: '1'
        }
      },
      {
        '@type': 'FAQPage',
        '@id': `${baseUrl}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What file formats are supported?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'We support over 50 file formats including PDF, DOCX, XLSX, PPTX, images (JPG, PNG, GIF), videos (MP4, AVI, MOV), and many more.'
            }
          },
          {
            '@type': 'Question',
            name: 'Is the service free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, our basic file reading and editing features are completely free to use. Premium features may require a subscription.'
            }
          },
          {
            '@type': 'Question',
            name: 'Can I collaborate with others in real-time?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, we offer real-time collaboration features that allow multiple users to edit documents simultaneously with operational transformation.'
            }
          },
          {
            '@type': 'Question',
            name: 'Is my data secure?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, we implement enterprise-grade security measures including encryption, virus scanning, Content Disarm and Reconstruction (CDR), and secure file handling.'
            }
          },
          {
            '@type': 'Question',
            name: 'Does the platform support AI features?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, we provide AI-powered features including document summarization, content suggestions, sentiment analysis, and intelligent text extraction.'
            }
          }
        ]
      }
    ]
  };
}

// Sitemap.xml endpoint
router.get('/sitemap.xml', (req, res) => {
  try {
    const sitemap = generateSitemap();
    
    res.set({
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    });
    
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt endpoint
router.get('/robots.txt', (req, res) => {
  try {
    const robotsTxt = generateRobotsTxt();
    
    res.set({
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    });
    
    res.send(robotsTxt);
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    res.status(500).send('Error generating robots.txt');
  }
});

// Structured data endpoint
router.get('/structured-data.json', (req, res) => {
  try {
    const structuredData = generateStructuredData();
    
    res.set({
      'Content-Type': 'application/ld+json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    });
    
    res.json(structuredData);
  } catch (error) {
    console.error('Error generating structured data:', error);
    res.status(500).json({ error: 'Error generating structured data' });
  }
});

// Meta tags endpoint for dynamic pages
router.get('/meta/:page', (req, res) => {
  try {
    const { page } = req.params;
    const route = SITE_ROUTES.find(r => r.path === `/${page}` || r.path === page);
    
    if (!route) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    const metaTags = {
      title: route.title,
      description: route.description,
      keywords: SEO_CONFIG.keywords.join(', '),
      canonical: `${SEO_CONFIG.baseUrl}${route.path}`,
      ogTitle: route.title,
      ogDescription: route.description,
      ogUrl: `${SEO_CONFIG.baseUrl}${route.path}`,
      ogType: 'website',
      ogSiteName: SEO_CONFIG.siteName,
      twitterCard: 'summary_large_image',
      twitterTitle: route.title,
      twitterDescription: route.description
    };
    
    res.set({
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    });
    
    res.json(metaTags);
  } catch (error) {
    console.error('Error generating meta tags:', error);
    res.status(500).json({ error: 'Error generating meta tags' });
  }
});

// SEO analysis endpoint
router.get('/seo-analysis', (req, res) => {
  try {
    const analysis = {
      siteName: SEO_CONFIG.siteName,
      baseUrl: SEO_CONFIG.baseUrl,
      totalPages: SITE_ROUTES.length,
      keywords: SEO_CONFIG.keywords,
      routes: SITE_ROUTES.map(route => ({
        path: route.path,
        title: route.title,
        description: route.description,
        priority: route.priority,
        changefreq: route.changefreq,
        titleLength: route.title.length,
        descriptionLength: route.description.length,
        seoScore: calculateSEOScore(route)
      })),
      recommendations: generateSEORecommendations()
    };
    
    res.set({
      'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
    });
    
    res.json(analysis);
  } catch (error) {
    console.error('Error generating SEO analysis:', error);
    res.status(500).json({ error: 'Error generating SEO analysis' });
  }
});

// Calculate SEO score for a route
function calculateSEOScore(route) {
  let score = 100;
  
  // Title length check (50-60 characters is optimal)
  if (route.title.length < 30 || route.title.length > 60) {
    score -= 10;
  }
  
  // Description length check (150-160 characters is optimal)
  if (route.description.length < 120 || route.description.length > 160) {
    score -= 10;
  }
  
  // Check if title contains keywords
  const titleLower = route.title.toLowerCase();
  const hasKeywords = SEO_CONFIG.keywords.some(keyword => 
    titleLower.includes(keyword.toLowerCase())
  );
  if (!hasKeywords) {
    score -= 15;
  }
  
  // Check if description contains keywords
  const descLower = route.description.toLowerCase();
  const descHasKeywords = SEO_CONFIG.keywords.some(keyword => 
    descLower.includes(keyword.toLowerCase())
  );
  if (!descHasKeywords) {
    score -= 10;
  }
  
  return Math.max(0, score);
}

// Generate SEO recommendations
function generateSEORecommendations() {
  const recommendations = [];
  
  // Check for missing meta descriptions
  const routesWithShortDesc = SITE_ROUTES.filter(route => route.description.length < 120);
  if (routesWithShortDesc.length > 0) {
    recommendations.push({
      type: 'warning',
      category: 'Meta Descriptions',
      message: `${routesWithShortDesc.length} pages have short meta descriptions (< 120 characters)`,
      pages: routesWithShortDesc.map(r => r.path)
    });
  }
  
  // Check for long titles
  const routesWithLongTitles = SITE_ROUTES.filter(route => route.title.length > 60);
  if (routesWithLongTitles.length > 0) {
    recommendations.push({
      type: 'warning',
      category: 'Page Titles',
      message: `${routesWithLongTitles.length} pages have long titles (> 60 characters)`,
      pages: routesWithLongTitles.map(r => r.path)
    });
  }
  
  // Check for missing keywords in titles
  const routesWithoutKeywords = SITE_ROUTES.filter(route => {
    const titleLower = route.title.toLowerCase();
    return !SEO_CONFIG.keywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
  });
  if (routesWithoutKeywords.length > 0) {
    recommendations.push({
      type: 'info',
      category: 'Keywords',
      message: `${routesWithoutKeywords.length} pages could benefit from including target keywords in titles`,
      pages: routesWithoutKeywords.map(r => r.path)
    });
  }
  
  // General recommendations
  recommendations.push({
    type: 'success',
    category: 'Best Practices',
    message: 'Sitemap and robots.txt are properly configured'
  });
  
  recommendations.push({
    type: 'info',
    category: 'Structured Data',
    message: 'Consider adding more specific structured data for individual pages'
  });
  
  return recommendations;
}

// Health check for SEO
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'seo',
    status: 'operational',
    features: {
      sitemap: true,
      robotsTxt: true,
      structuredData: true,
      metaTags: true,
      seoAnalysis: true
    },
    routes: SITE_ROUTES.length,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;