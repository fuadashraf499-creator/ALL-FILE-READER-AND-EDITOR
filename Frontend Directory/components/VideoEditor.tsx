import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import './VideoEditor.css';

interface VideoEditorProps {
  videoFile: File;
  onSave?: (processedFile: File) => void;
  onClose?: () => void;
  className?: string;
}

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  format: string;
  size: number;
}

interface ProcessingOptions {
  startTime: number;
  endTime: number;
  width?: number;
  height?: number;
  quality: 'low' | 'medium' | 'high';
  format: 'mp4' | 'webm' | 'avi';
  removeAudio: boolean;
}

const VideoEditor: React.FC<VideoEditorProps> = ({
  videoFile,
  onSave,
  onClose,
  className = ''
}) => {
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [options, setOptions] = useState<ProcessingOptions>({
    startTime: 0,
    endTime: 0,
    quality: 'medium',
    format: 'mp4',
    removeAudio: false
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize FFmpeg
  useEffect(() => {
    const initFFmpeg = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const ffmpegInstance = new FFmpeg();
        
        // Load FFmpeg with progress callback
        ffmpegInstance.on('progress', ({ progress }) => {
          setProgress(Math.round(progress * 100));
        });
        
        ffmpegInstance.on('log', ({ message }) => {
          console.log('FFmpeg log:', message);
        });
        
        // Load FFmpeg core
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpegInstance.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        setFFmpeg(ffmpegInstance);
        
        // Load video file
        await loadVideoFile(ffmpegInstance);
        
      } catch (error) {
        console.error('Failed to initialize FFmpeg:', error);
        setError('Failed to initialize video editor. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    initFFmpeg();
  }, [videoFile]);

  // Load video file and extract info
  const loadVideoFile = async (ffmpegInstance: FFmpeg) => {
    try {
      // Write video file to FFmpeg filesystem
      await ffmpegInstance.writeFile('input.mp4', await fetchFile(videoFile));
      
      // Get video information using ffprobe
      await ffmpegInstance.exec([
        '-i', 'input.mp4',
        '-f', 'null', '-'
      ]);
      
      // Create video URL for preview
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      
      // Extract video metadata (simplified)
      const info: VideoInfo = {
        duration: 0, // Will be set when video loads
        width: 0,
        height: 0,
        fps: 30,
        format: videoFile.type,
        size: videoFile.size
      };
      
      setVideoInfo(info);
      
    } catch (error) {
      console.error('Failed to load video:', error);
      setError('Failed to load video file.');
    }
  };

  // Handle video metadata loaded
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const videoDuration = video.duration;
      
      setDuration(videoDuration);
      setOptions(prev => ({
        ...prev,
        endTime: videoDuration
      }));
      
      if (videoInfo) {
        setVideoInfo({
          ...videoInfo,
          duration: videoDuration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      }
    }
  };

  // Handle video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Play/pause video
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Seek to specific time
  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Set start time
  const setStartTime = () => {
    setOptions(prev => ({ ...prev, startTime: currentTime }));
  };

  // Set end time
  const setEndTime = () => {
    setOptions(prev => ({ ...prev, endTime: currentTime }));
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get quality settings
  const getQualitySettings = (quality: string) => {
    switch (quality) {
      case 'low':
        return { crf: '28', preset: 'fast' };
      case 'medium':
        return { crf: '23', preset: 'medium' };
      case 'high':
        return { crf: '18', preset: 'slow' };
      default:
        return { crf: '23', preset: 'medium' };
    }
  };

  // Process video
  const processVideo = async () => {
    if (!ffmpeg || !videoInfo) {
      setError('Video editor not ready');
      return;
    }

    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);

      const { startTime, endTime, width, height, quality, format, removeAudio } = options;
      const { crf, preset } = getQualitySettings(quality);
      
      // Build FFmpeg command
      const command = [
        '-i', 'input.mp4',
        '-ss', startTime.toString(),
        '-t', (endTime - startTime).toString(),
        '-c:v', 'libx264',
        '-crf', crf,
        '-preset', preset
      ];

      // Add audio options
      if (removeAudio) {
        command.push('-an');
      } else {
        command.push('-c:a', 'aac', '-b:a', '128k');
      }

      // Add resize if specified
      if (width && height) {
        command.push('-vf', `scale=${width}:${height}`);
      }

      // Add output format
      const outputFile = `output.${format}`;
      command.push(outputFile);

      // Execute FFmpeg command
      await ffmpeg.exec(command);

      // Read the output file
      const data = await ffmpeg.readFile(outputFile);
      const blob = new Blob([data], { type: `video/${format}` });
      const processedFile = new File([blob], `processed_video.${format}`, {
        type: `video/${format}`
      });

      // Call onSave callback
      onSave?.(processedFile);

    } catch (error) {
      console.error('Video processing failed:', error);
      setError('Failed to process video. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Extract frame at current time
  const extractFrame = async () => {
    if (!ffmpeg) return;

    try {
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', currentTime.toString(),
        '-vframes', '1',
        '-f', 'image2',
        'frame.png'
      ]);

      const data = await ffmpeg.readFile('frame.png');
      const blob = new Blob([data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      
      // Download the frame
      const a = document.createElement('a');
      a.href = url;
      a.download = `frame_${formatTime(currentTime)}.png`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Frame extraction failed:', error);
      setError('Failed to extract frame.');
    }
  };

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && duration > 0) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;
      seekTo(Math.max(0, Math.min(duration, newTime)));
    }
  };

  if (isLoading) {
    return (
      <div className={`video-editor loading ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>Loading Video Editor...</h3>
          <p>Initializing FFmpeg and loading your video file.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`video-editor error ${className}`}>
        <div className="error-container">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-editor ${className}`}>
      {/* Header */}
      <div className="editor-header">
        <h2>Video Editor</h2>
        <div className="header-actions">
          {onClose && (
            <button onClick={onClose} className="close-btn">
              ✕ Close
            </button>
          )}
        </div>
      </div>

      <div className="editor-content">
        {/* Video Preview */}
        <div className="video-preview">
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={handleVideoLoaded}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            controls={false}
            className="preview-video"
          />
          
          {/* Video Controls */}
          <div className="video-controls">
            <button onClick={togglePlayback} className="play-btn">
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            
            <button onClick={extractFrame} className="extract-btn">
              📷 Extract Frame
            </button>
          </div>
          
          {/* Timeline */}
          <div 
            className="timeline"
            ref={timelineRef}
            onClick={handleTimelineClick}
          >
            <div className="timeline-track">
              <div 
                className="timeline-progress"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              
              {/* Start/End markers */}
              <div 
                className="timeline-marker start"
                style={{ left: `${(options.startTime / duration) * 100}%` }}
              />
              <div 
                className="timeline-marker end"
                style={{ left: `${(options.endTime / duration) * 100}%` }}
              />
              
              {/* Selection range */}
              <div 
                className="timeline-selection"
                style={{
                  left: `${(options.startTime / duration) * 100}%`,
                  width: `${((options.endTime - options.startTime) / duration) * 100}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Editing Panel */}
        <div className="editing-panel">
          {/* Video Info */}
          {videoInfo && (
            <div className="info-section">
              <h3>Video Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Duration:</label>
                  <span>{formatTime(videoInfo.duration)}</span>
                </div>
                <div className="info-item">
                  <label>Resolution:</label>
                  <span>{videoInfo.width} × {videoInfo.height}</span>
                </div>
                <div className="info-item">
                  <label>Size:</label>
                  <span>{(videoInfo.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="info-item">
                  <label>Format:</label>
                  <span>{videoInfo.format}</span>
                </div>
              </div>
            </div>
          )}

          {/* Trim Section */}
          <div className="trim-section">
            <h3>Trim Video</h3>
            <div className="trim-controls">
              <div className="time-input">
                <label>Start Time:</label>
                <input
                  type="number"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={options.startTime.toFixed(1)}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    startTime: Math.max(0, parseFloat(e.target.value))
                  }))}
                />
                <button onClick={setStartTime} className="set-btn">
                  Set Current
                </button>
              </div>
              
              <div className="time-input">
                <label>End Time:</label>
                <input
                  type="number"
                  min={options.startTime}
                  max={duration}
                  step="0.1"
                  value={options.endTime.toFixed(1)}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    endTime: Math.min(duration, parseFloat(e.target.value))
                  }))}
                />
                <button onClick={setEndTime} className="set-btn">
                  Set Current
                </button>
              </div>
            </div>
            
            <div className="trim-info">
              <span>Selected Duration: {formatTime(options.endTime - options.startTime)}</span>
            </div>
          </div>

          {/* Quality Settings */}
          <div className="quality-section">
            <h3>Output Settings</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <label>Quality:</label>
                <select
                  value={options.quality}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    quality: e.target.value as any
                  }))}
                >
                  <option value="low">Low (Fast)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (Slow)</option>
                </select>
              </div>
              
              <div className="setting-item">
                <label>Format:</label>
                <select
                  value={options.format}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    format: e.target.value as any
                  }))}
                >
                  <option value="mp4">MP4</option>
                  <option value="webm">WebM</option>
                  <option value="avi">AVI</option>
                </select>
              </div>
              
              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={options.removeAudio}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      removeAudio: e.target.checked
                    }))}
                  />
                  Remove Audio
                </label>
              </div>
            </div>
          </div>

          {/* Resize Section */}
          <div className="resize-section">
            <h3>Resize (Optional)</h3>
            <div className="resize-controls">
              <div className="size-input">
                <label>Width:</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Original"
                  value={options.width || ''}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    width: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                />
              </div>
              
              <div className="size-input">
                <label>Height:</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Original"
                  value={options.height || ''}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    height: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                />
              </div>
            </div>
            
            <div className="preset-buttons">
              <button onClick={() => setOptions(prev => ({ ...prev, width: 1920, height: 1080 }))}>
                1080p
              </button>
              <button onClick={() => setOptions(prev => ({ ...prev, width: 1280, height: 720 }))}>
                720p
              </button>
              <button onClick={() => setOptions(prev => ({ ...prev, width: 854, height: 480 }))}>
                480p
              </button>
              <button onClick={() => setOptions(prev => ({ ...prev, width: undefined, height: undefined }))}>
                Original
              </button>
            </div>
          </div>

          {/* Process Button */}
          <div className="process-section">
            <button
              onClick={processVideo}
              disabled={isProcessing || options.startTime >= options.endTime}
              className="process-btn"
            >
              {isProcessing ? (
                <>
                  <div className="processing-spinner"></div>
                  Processing... {progress}%
                </>
              ) : (
                '🎬 Process Video'
              )}
            </button>
            
            {isProcessing && (
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;