const express = require('express');
const Joi = require('joi');
const winston = require('winston');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ocr.log' })
  ]
});

// Validation schema
const ocrSchema = Joi.object({
  imageUrl: Joi.string().uri().required(),
  language: Joi.string().default('eng'),
  options: Joi.object({
    psm: Joi.number().min(0).max(13).default(3),
    oem: Joi.number().min(0).max(3).default(3)
  }).default({})
});

// OCR processing endpoint
// Note: This endpoint coordinates OCR but actual processing happens client-side with Tesseract.js
router.post('/extract', optionalAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = ocrSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { imageUrl, language, options } = value;

    // Log OCR request
    logger.info(`OCR request for ${imageUrl} by user ${req.user?.userId || 'anonymous'}`);

    // Return configuration for client-side OCR processing
    res.json({
      success: true,
      message: 'OCR configuration prepared',
      config: {
        imageUrl,
        language,
        options: {
          logger: m => console.log(m),
          ...options
        }
      },
      instructions: {
        note: 'Use Tesseract.js on the client side for actual OCR processing',
        example: `
          import Tesseract from 'tesseract.js';
          
          const { data: { text } } = await Tesseract.recognize(
            '${imageUrl}',
            '${language}',
            {
              logger: m => console.log(m),
              psm: ${options.psm},
              oem: ${options.oem}
            }
          );
        `
      }
    });
  } catch (error) {
    logger.error('OCR endpoint error:', error);
    res.status(500).json({ error: 'OCR processing failed' });
  }
});

// Get supported languages
router.get('/languages', (req, res) => {
  try {
    const supportedLanguages = {
      'afr': 'Afrikaans',
      'amh': 'Amharic',
      'ara': 'Arabic',
      'asm': 'Assamese',
      'aze': 'Azerbaijani',
      'aze_cyrl': 'Azerbaijani - Cyrillic',
      'bel': 'Belarusian',
      'ben': 'Bengali',
      'bod': 'Tibetan',
      'bos': 'Bosnian',
      'bul': 'Bulgarian',
      'cat': 'Catalan; Valencian',
      'ceb': 'Cebuano',
      'ces': 'Czech',
      'chi_sim': 'Chinese - Simplified',
      'chi_tra': 'Chinese - Traditional',
      'chr': 'Cherokee',
      'cym': 'Welsh',
      'dan': 'Danish',
      'deu': 'German',
      'dzo': 'Dzongkha',
      'ell': 'Greek, Modern',
      'eng': 'English',
      'enm': 'English, Middle',
      'epo': 'Esperanto',
      'est': 'Estonian',
      'eus': 'Basque',
      'fas': 'Persian',
      'fin': 'Finnish',
      'fra': 'French',
      'frk': 'German Fraktur',
      'frm': 'French, Middle',
      'gle': 'Irish',
      'glg': 'Galician',
      'grc': 'Greek, Ancient',
      'guj': 'Gujarati',
      'hat': 'Haitian; Haitian Creole',
      'heb': 'Hebrew',
      'hin': 'Hindi',
      'hrv': 'Croatian',
      'hun': 'Hungarian',
      'iku': 'Inuktitut',
      'ind': 'Indonesian',
      'isl': 'Icelandic',
      'ita': 'Italian',
      'ita_old': 'Italian - Old',
      'jav': 'Javanese',
      'jpn': 'Japanese',
      'kan': 'Kannada',
      'kat': 'Georgian',
      'kat_old': 'Georgian - Old',
      'kaz': 'Kazakh',
      'khm': 'Central Khmer',
      'kir': 'Kirghiz; Kyrgyz',
      'kor': 'Korean',
      'kur': 'Kurdish',
      'lao': 'Lao',
      'lat': 'Latin',
      'lav': 'Latvian',
      'lit': 'Lithuanian',
      'mal': 'Malayalam',
      'mar': 'Marathi',
      'mkd': 'Macedonian',
      'mlt': 'Maltese',
      'mon': 'Mongolian',
      'mri': 'Maori',
      'msa': 'Malay',
      'mya': 'Burmese',
      'nep': 'Nepali',
      'nld': 'Dutch; Flemish',
      'nor': 'Norwegian',
      'ori': 'Oriya',
      'pan': 'Panjabi; Punjabi',
      'pol': 'Polish',
      'por': 'Portuguese',
      'pus': 'Pushto; Pashto',
      'ron': 'Romanian; Moldavian; Moldovan',
      'rus': 'Russian',
      'san': 'Sanskrit',
      'sin': 'Sinhala; Sinhalese',
      'slk': 'Slovak',
      'slv': 'Slovenian',
      'spa': 'Spanish; Castilian',
      'spa_old': 'Spanish; Castilian - Old',
      'sqi': 'Albanian',
      'srp': 'Serbian',
      'srp_latn': 'Serbian - Latin',
      'swa': 'Swahili',
      'swe': 'Swedish',
      'syr': 'Syriac',
      'tam': 'Tamil',
      'tel': 'Telugu',
      'tgk': 'Tajik',
      'tgl': 'Tagalog',
      'tha': 'Thai',
      'tir': 'Tigrinya',
      'tur': 'Turkish',
      'uig': 'Uighur; Uyghur',
      'ukr': 'Ukrainian',
      'urd': 'Urdu',
      'uzb': 'Uzbek',
      'uzb_cyrl': 'Uzbek - Cyrillic',
      'vie': 'Vietnamese',
      'yid': 'Yiddish'
    };

    res.json({
      success: true,
      languages: supportedLanguages,
      defaultLanguage: 'eng',
      note: 'Use the language code (key) when making OCR requests'
    });
  } catch (error) {
    logger.error('Get languages error:', error);
    res.status(500).json({ error: 'Failed to get supported languages' });
  }
});

// OCR status and progress tracking
router.get('/status/:jobId', optionalAuth, (req, res) => {
  try {
    const { jobId } = req.params;
    
    // In a real implementation, you would track OCR jobs in a database
    // For now, return a mock response
    res.json({
      success: true,
      jobId,
      status: 'completed',
      progress: 100,
      message: 'OCR processing is handled client-side with Tesseract.js',
      note: 'This endpoint is for future server-side OCR implementation'
    });
  } catch (error) {
    logger.error('OCR status error:', error);
    res.status(500).json({ error: 'Failed to get OCR status' });
  }
});

// OCR configuration endpoint
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        maxImageSize: '10MB',
        supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp'],
        defaultLanguage: 'eng',
        processingMode: 'client-side',
        library: 'Tesseract.js',
        features: {
          multiLanguage: true,
          confidence: true,
          boundingBoxes: true,
          wordLevel: true,
          characterLevel: true
        }
      },
      usage: {
        note: 'OCR is processed client-side for better performance and privacy',
        steps: [
          '1. Upload image using /api/v1/upload/simple',
          '2. Get OCR config from /api/v1/ocr/extract',
          '3. Process with Tesseract.js in browser',
          '4. Extract text and confidence scores'
        ]
      }
    });
  } catch (error) {
    logger.error('OCR config error:', error);
    res.status(500).json({ error: 'Failed to get OCR configuration' });
  }
});

module.exports = router;