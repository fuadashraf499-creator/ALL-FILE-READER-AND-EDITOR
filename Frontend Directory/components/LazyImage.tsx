import React, { useState, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  blurDataURL?: string;
  width?: number;
  height?: number;
  sizes?: string;
  srcSet?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: (error: Event) => void;
  threshold?: number;
  rootMargin?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  style = {},
  placeholder,
  blurDataURL,
  width,
  height,
  sizes,
  srcSet,
  loading = 'lazy',
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | undefined>(loading === 'eager' ? src : undefined);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: true,
    skip: loading === 'eager'
  });

  useEffect(() => {
    if (inView && !imageSrc && loading === 'lazy') {
      setImageSrc(src);
    }
  }, [inView, src, imageSrc, loading]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsError(true);
    onError?.(event.nativeEvent);
  };

  const imageStyle: React.CSSProperties = {
    ...style,
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0,
  };

  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
    pointerEvents: 'none',
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    overflow: 'hidden',
    width: width || '100%',
    height: height || 'auto',
  };

  return (
    <div ref={ref} style={containerStyle} className={`lazy-image-container ${className}`}>
      {/* Blur placeholder */}
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          style={{
            ...placeholderStyle,
            filter: 'blur(10px)',
            transform: 'scale(1.1)',
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Color placeholder */}
      {!blurDataURL && !isLoaded && (
        <div style={placeholderStyle}>
          {placeholder ? (
            <span style={{ color: '#999', fontSize: '14px' }}>{placeholder}</span>
          ) : (
            <div
              style={
                {
                  width: '40px',
                  height: '40px',
                  border: '3px solid #f3f3f3',
                  borderTop: '3px solid #3498db',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }
              }
            />
          )}
        </div>
      )}
      
      {/* Error state */}
      {isError && (
        <div style={placeholderStyle}>
          <span style={{ color: '#e74c3c', fontSize: '14px' }}>Failed to load image</span>
        </div>
      )}
      
      {/* Main image */}
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          style={imageStyle}
          width={width}
          height={height}
          sizes={sizes}
          srcSet={srcSet}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
        />
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LazyImage;

// Higher-order component for lazy loading any component
export function withLazyLoading<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    threshold?: number;
    rootMargin?: string;
    placeholder?: React.ComponentType;
  } = {}
) {
  const LazyComponent: React.FC<P> = (props) => {
    const { threshold = 0.1, rootMargin = '50px', placeholder: Placeholder } = options;
    const { ref, inView } = useInView({
      threshold,
      rootMargin,
      triggerOnce: true,
    });

    return (
      <div ref={ref}>
        {inView ? (
          <Component {...props} />
        ) : (
          Placeholder ? <Placeholder /> : <div style={{ minHeight: '200px' }} />
        )}
      </div>
    );
  };

  LazyComponent.displayName = `withLazyLoading(${Component.displayName || Component.name})`;
  return LazyComponent;
}

// Hook for lazy loading data
export function useLazyData<T>(
  fetchFn: () => Promise<T>,
  options: {
    threshold?: number;
    rootMargin?: string;
    enabled?: boolean;
  } = {}
) {
  const { threshold = 0.1, rootMargin = '50px', enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: true,
    skip: !enabled,
  });

  useEffect(() => {
    if (inView && enabled && !data && !loading) {
      setLoading(true);
      setError(null);
      
      fetchFn()
        .then(setData)
        .catch(setError)
        .finally(() => setLoading(false));
    }
  }, [inView, enabled, data, loading, fetchFn]);

  return {
    ref,
    data,
    loading,
    error,
    inView,
  };
}