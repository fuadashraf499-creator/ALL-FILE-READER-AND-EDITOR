import { pipeline, Pipeline } from '@xenova/transformers';

// AI Service class for handling various AI operations
export class AIService {
  private static instance: AIService;
  private summarizationPipeline: Pipeline | null = null;
  private sentimentPipeline: Pipeline | null = null;
  private questionAnsweringPipeline: Pipeline | null = null;
  private textClassificationPipeline: Pipeline | null = null;
  private translationPipeline: Pipeline | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  // Initialize AI models
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.loadModels();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  private async loadModels(): Promise<void> {
    try {
      console.log('Loading AI models...');
      
      // Load summarization model
      this.summarizationPipeline = await pipeline(
        'summarization',
        'Xenova/distilbart-cnn-6-6'
      );
      
      // Load sentiment analysis model
      this.sentimentPipeline = await pipeline(
        'sentiment-analysis',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
      );
      
      // Load question answering model
      this.questionAnsweringPipeline = await pipeline(
        'question-answering',
        'Xenova/distilbert-base-cased-distilled-squad'
      );
      
      // Load text classification model
      this.textClassificationPipeline = await pipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased'
      );
      
      console.log('AI models loaded successfully');
    } catch (error) {
      console.error('Failed to load AI models:', error);
      throw error;
    }
  }

  // Text summarization
  public async summarizeText(
    text: string,
    options: {
      maxLength?: number;
      minLength?: number;
      doSample?: boolean;
    } = {}
  ): Promise<string> {
    await this.initialize();
    
    if (!this.summarizationPipeline) {
      throw new Error('Summarization model not loaded');
    }

    const {
      maxLength = 150,
      minLength = 30,
      doSample = false
    } = options;

    try {
      // Split long text into chunks if necessary
      const chunks = this.splitTextIntoChunks(text, 1000);
      const summaries: string[] = [];

      for (const chunk of chunks) {
        const result = await this.summarizationPipeline(chunk, {
          max_length: maxLength,
          min_length: minLength,
          do_sample: doSample
        });
        
        summaries.push(result[0].summary_text);
      }

      // If multiple chunks, summarize the summaries
      if (summaries.length > 1) {
        const combinedSummary = summaries.join(' ');
        const finalResult = await this.summarizationPipeline(combinedSummary, {
          max_length: maxLength,
          min_length: minLength,
          do_sample: doSample
        });
        return finalResult[0].summary_text;
      }

      return summaries[0];
    } catch (error) {
      console.error('Summarization error:', error);
      throw new Error('Failed to summarize text');
    }
  }

  // Sentiment analysis
  public async analyzeSentiment(text: string): Promise<{
    label: string;
    score: number;
    confidence: 'high' | 'medium' | 'low';
  }> {
    await this.initialize();
    
    if (!this.sentimentPipeline) {
      throw new Error('Sentiment analysis model not loaded');
    }

    try {
      const result = await this.sentimentPipeline(text);
      const { label, score } = result[0];
      
      let confidence: 'high' | 'medium' | 'low';
      if (score > 0.8) confidence = 'high';
      else if (score > 0.6) confidence = 'medium';
      else confidence = 'low';

      return { label, score, confidence };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      throw new Error('Failed to analyze sentiment');
    }
  }

  // Question answering
  public async answerQuestion(
    question: string,
    context: string
  ): Promise<{
    answer: string;
    score: number;
    start: number;
    end: number;
  }> {
    await this.initialize();
    
    if (!this.questionAnsweringPipeline) {
      throw new Error('Question answering model not loaded');
    }

    try {
      const result = await this.questionAnsweringPipeline({
        question,
        context
      });

      return {
        answer: result.answer,
        score: result.score,
        start: result.start,
        end: result.end
      };
    } catch (error) {
      console.error('Question answering error:', error);
      throw new Error('Failed to answer question');
    }
  }

  // Text classification
  public async classifyText(text: string): Promise<{
    label: string;
    score: number;
  }[]> {
    await this.initialize();
    
    if (!this.textClassificationPipeline) {
      throw new Error('Text classification model not loaded');
    }

    try {
      const result = await this.textClassificationPipeline(text);
      return result.map((item: any) => ({
        label: item.label,
        score: item.score
      }));
    } catch (error) {
      console.error('Text classification error:', error);
      throw new Error('Failed to classify text');
    }
  }

  // Generate content suggestions
  public async generateContentSuggestions(
    text: string,
    type: 'improvement' | 'expansion' | 'simplification' = 'improvement'
  ): Promise<string[]> {
    await this.initialize();

    try {
      const suggestions: string[] = [];
      
      // Analyze sentiment to understand tone
      const sentiment = await this.analyzeSentiment(text);
      
      // Generate different types of suggestions based on type
      switch (type) {
        case 'improvement':
          suggestions.push(...await this.generateImprovementSuggestions(text, sentiment));
          break;
        case 'expansion':
          suggestions.push(...await this.generateExpansionSuggestions(text));
          break;
        case 'simplification':
          suggestions.push(...await this.generateSimplificationSuggestions(text));
          break;
      }

      return suggestions;
    } catch (error) {
      console.error('Content suggestion error:', error);
      throw new Error('Failed to generate content suggestions');
    }
  }

  // Generate key phrases from text
  public async extractKeyPhrases(text: string): Promise<string[]> {
    try {
      // Simple keyword extraction using TF-IDF-like approach
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);
      
      // Count word frequencies
      const wordFreq = new Map<string, number>();
      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
      
      // Sort by frequency and return top phrases
      const sortedWords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
      
      return sortedWords;
    } catch (error) {
      console.error('Key phrase extraction error:', error);
      return [];
    }
  }

  // Generate document insights
  public async generateDocumentInsights(text: string): Promise<{
    summary: string;
    sentiment: { label: string; score: number; confidence: string };
    keyPhrases: string[];
    readabilityScore: number;
    wordCount: number;
    estimatedReadingTime: number;
    suggestions: string[];
  }> {
    try {
      const [summary, sentiment, keyPhrases, suggestions] = await Promise.all([
        this.summarizeText(text, { maxLength: 100 }),
        this.analyzeSentiment(text),
        this.extractKeyPhrases(text),
        this.generateContentSuggestions(text)
      ]);

      const wordCount = text.split(/\s+/).length;
      const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute
      const readabilityScore = this.calculateReadabilityScore(text);

      return {
        summary,
        sentiment,
        keyPhrases,
        readabilityScore,
        wordCount,
        estimatedReadingTime,
        suggestions
      };
    } catch (error) {
      console.error('Document insights error:', error);
      throw new Error('Failed to generate document insights');
    }
  }

  // Helper methods
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    const sentences = text.split(/[.!?]+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      currentChunk += sentence + '. ';
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  private async generateImprovementSuggestions(
    text: string,
    sentiment: { label: string; score: number }
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Basic improvement suggestions based on text analysis
    if (text.length < 100) {
      suggestions.push('Consider expanding your content with more details and examples.');
    }
    
    if (sentiment.label === 'NEGATIVE' && sentiment.score > 0.7) {
      suggestions.push('Consider using more positive language to improve reader engagement.');
    }
    
    const sentences = text.split(/[.!?]+/);
    const avgSentenceLength = text.length / sentences.length;
    
    if (avgSentenceLength > 25) {
      suggestions.push('Consider breaking down long sentences for better readability.');
    }
    
    if (avgSentenceLength < 10) {
      suggestions.push('Consider combining short sentences to improve flow.');
    }
    
    return suggestions;
  }

  private async generateExpansionSuggestions(text: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    suggestions.push('Add specific examples to illustrate your points.');
    suggestions.push('Include relevant statistics or data to support your arguments.');
    suggestions.push('Consider adding a conclusion that summarizes key takeaways.');
    suggestions.push('Expand on the implications or consequences of your main points.');
    
    return suggestions;
  }

  private async generateSimplificationSuggestions(text: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    suggestions.push('Replace complex words with simpler alternatives.');
    suggestions.push('Break down complex concepts into smaller, digestible parts.');
    suggestions.push('Use bullet points or numbered lists for better organization.');
    suggestions.push('Add headings and subheadings to improve structure.');
    
    return suggestions;
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified Flesch Reading Ease score
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const syllables = this.countSyllables(text);
    
    if (sentences === 0 || words === 0) return 0;
    
    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(text: string): number {
    // Simple syllable counting algorithm
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    let syllableCount = 0;
    
    words.forEach(word => {
      const vowels = word.match(/[aeiouy]+/g) || [];
      syllableCount += vowels.length;
      
      // Adjust for silent 'e'
      if (word.endsWith('e')) {
        syllableCount--;
      }
      
      // Ensure at least one syllable per word
      if (syllableCount === 0) {
        syllableCount = 1;
      }
    });
    
    return syllableCount;
  }

  // Check if models are loaded
  public isReady(): boolean {
    return this.isInitialized;
  }

  // Get loading status
  public getLoadingStatus(): {
    summarization: boolean;
    sentiment: boolean;
    questionAnswering: boolean;
    textClassification: boolean;
  } {
    return {
      summarization: !!this.summarizationPipeline,
      sentiment: !!this.sentimentPipeline,
      questionAnswering: !!this.questionAnsweringPipeline,
      textClassification: !!this.textClassificationPipeline
    };
  }
}

// Export singleton instance
export const aiService = AIService.getInstance();

// React hook for AI service
export function useAIService() {
  const [isLoading, setIsLoading] = React.useState(!aiService.isReady());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!aiService.isReady()) {
      aiService.initialize()
        .then(() => {
          setIsLoading(false);
          setError(null);
        })
        .catch((err) => {
          setIsLoading(false);
          setError(err.message);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  return {
    aiService,
    isLoading,
    error,
    isReady: aiService.isReady()
  };
}

// AI-powered text analysis hook
export function useTextAnalysis(text: string, enabled = true) {
  const [analysis, setAnalysis] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { aiService, isReady } = useAIService();

  React.useEffect(() => {
    if (!enabled || !isReady || !text || text.length < 10) {
      return;
    }

    setLoading(true);
    setError(null);

    aiService.generateDocumentInsights(text)
      .then(setAnalysis)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [text, enabled, isReady, aiService]);

  return { analysis, loading, error };
}

// Import React for hooks
import React from 'react';