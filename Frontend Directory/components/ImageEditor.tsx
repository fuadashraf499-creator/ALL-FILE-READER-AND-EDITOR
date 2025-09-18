import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Circle, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import './ImageEditor.css';

interface ImageEditorProps {
  imageUrl: string;
  onSave?: (dataUrl: string) => void;
  onClose?: () => void;
  className?: string;
}

interface DrawingTool {
  id: string;
  type: 'pen' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser';
  name: string;
  icon: string;
}

interface DrawingObject {
  id: string;
  type: string;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fontSize?: number;
}

const DRAWING_TOOLS: DrawingTool[] = [
  { id: 'select', type: 'pen', name: 'Select', icon: '👆' },
  { id: 'pen', type: 'pen', name: 'Pen', icon: '✏️' },
  { id: 'line', type: 'line', name: 'Line', icon: '📏' },
  { id: 'rectangle', type: 'rectangle', name: 'Rectangle', icon: '⬜' },
  { id: 'circle', type: 'circle', name: 'Circle', icon: '⭕' },
  { id: 'text', type: 'text', name: 'Text', icon: '📝' },
  { id: 'eraser', type: 'eraser', name: 'Eraser', icon: '🧽' },
];

const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB'
];

const ImageEditor: React.FC<ImageEditorProps> = ({
  imageUrl,
  onSave,
  onClose,
  className = ''
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('transparent');
  const [fontSize, setFontSize] = useState(16);
  const [isDrawing, setIsDrawing] = useState(false);
  const [objects, setObjects] = useState<DrawingObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<DrawingObject[][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPath = useRef<number[]>([]);
  const currentObject = useRef<DrawingObject | null>(null);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      
      // Calculate stage size to fit image
      const containerWidth = containerRef.current?.clientWidth || 800;
      const containerHeight = containerRef.current?.clientHeight || 600;
      
      const scale = Math.min(
        containerWidth / img.width,
        containerHeight / img.height,
        1
      );
      
      setStageSize({
        width: img.width * scale,
        height: img.height * scale
      });
      setStageScale(scale);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Handle selection
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = stageRef.current;
      if (stage) {
        const selectedNode = stage.findOne(`#${selectedId}`);
        if (selectedNode) {
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.getLayer()?.batchDraw();
        }
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  // Save to history
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...objects]);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep, objects]);

  // Undo
  const undo = useCallback(() => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setObjects([...history[historyStep - 1]]);
    }
  }, [history, historyStep]);

  // Redo
  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setObjects([...history[historyStep + 1]]);
    }
  }, [history, historyStep]);

  // Generate unique ID
  const generateId = () => `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle mouse down
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedId(null);
      } else {
        setSelectedId(e.target.id());
      }
      return;
    }

    setIsDrawing(true);
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const id = generateId();
    
    switch (activeTool) {
      case 'pen':
      case 'eraser':
        currentPath.current = [pos.x, pos.y];
        currentObject.current = {
          id,
          type: activeTool,
          points: [pos.x, pos.y],
          stroke: activeTool === 'eraser' ? '#FFFFFF' : strokeColor,
          strokeWidth: activeTool === 'eraser' ? strokeWidth * 2 : strokeWidth,
        };
        break;
        
      case 'line':
        currentObject.current = {
          id,
          type: 'line',
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: strokeColor,
          strokeWidth,
        };
        break;
        
      case 'rectangle':
        currentObject.current = {
          id,
          type: 'rectangle',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: strokeColor,
          strokeWidth,
          fill: fillColor,
        };
        break;
        
      case 'circle':
        currentObject.current = {
          id,
          type: 'circle',
          x: pos.x,
          y: pos.y,
          radius: 0,
          stroke: strokeColor,
          strokeWidth,
          fill: fillColor,
        };
        break;
        
      case 'text':
        const text = prompt('Enter text:');
        if (text) {
          const newTextObject: DrawingObject = {
            id,
            type: 'text',
            x: pos.x,
            y: pos.y,
            text,
            fontSize,
            fill: strokeColor,
          };
          setObjects(prev => [...prev, newTextObject]);
          saveToHistory();
        }
        setIsDrawing(false);
        return;
    }
    
    if (currentObject.current) {
      setObjects(prev => [...prev, currentObject.current!]);
    }
  };

  // Handle mouse move
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !currentObject.current) return;
    
    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;

    const updatedObjects = [...objects];
    const currentIndex = updatedObjects.length - 1;
    
    switch (activeTool) {
      case 'pen':
      case 'eraser':
        currentPath.current = [...currentPath.current, point.x, point.y];
        updatedObjects[currentIndex] = {
          ...currentObject.current,
          points: [...currentPath.current],
        };
        break;
        
      case 'line':
        const linePoints = currentObject.current.points!;
        updatedObjects[currentIndex] = {
          ...currentObject.current,
          points: [linePoints[0], linePoints[1], point.x, point.y],
        };
        break;
        
      case 'rectangle':
        const startX = currentObject.current.x!;
        const startY = currentObject.current.y!;
        updatedObjects[currentIndex] = {
          ...currentObject.current,
          width: point.x - startX,
          height: point.y - startY,
        };
        break;
        
      case 'circle':
        const centerX = currentObject.current.x!;
        const centerY = currentObject.current.y!;
        const radius = Math.sqrt(
          Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
        );
        updatedObjects[currentIndex] = {
          ...currentObject.current,
          radius,
        };
        break;
    }
    
    setObjects(updatedObjects);
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      currentObject.current = null;
      currentPath.current = [];
      saveToHistory();
    }
  };

  // Clear all objects
  const clearAll = () => {
    setObjects([]);
    setSelectedId(null);
    saveToHistory();
  };

  // Delete selected object
  const deleteSelected = () => {
    if (selectedId) {
      setObjects(prev => prev.filter(obj => obj.id !== selectedId));
      setSelectedId(null);
      saveToHistory();
    }
  };

  // Save image
  const handleSave = () => {
    if (stageRef.current) {
      const dataUrl = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
      });
      onSave?.(dataUrl);
    }
  };

  // Zoom functions
  const zoomIn = () => {
    setStageScale(prev => Math.min(prev * 1.2, 3));
  };

  const zoomOut = () => {
    setStageScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const resetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Render drawing object
  const renderObject = (obj: DrawingObject) => {
    const commonProps = {
      id: obj.id,
      key: obj.id,
      draggable: activeTool === 'select',
      onClick: () => activeTool === 'select' && setSelectedId(obj.id),
    };

    switch (obj.type) {
      case 'pen':
      case 'eraser':
        return (
          <Line
            {...commonProps}
            points={obj.points}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={obj.type === 'eraser' ? 'destination-out' : 'source-over'}
          />
        );
        
      case 'line':
        return (
          <Line
            {...commonProps}
            points={obj.points}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            lineCap="round"
          />
        );
        
      case 'rectangle':
        return (
          <Rect
            {...commonProps}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            fill={obj.fill}
          />
        );
        
      case 'circle':
        return (
          <Circle
            {...commonProps}
            x={obj.x}
            y={obj.y}
            radius={obj.radius}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            fill={obj.fill}
          />
        );
        
      case 'text':
        return (
          <Text
            {...commonProps}
            x={obj.x}
            y={obj.y}
            text={obj.text}
            fontSize={obj.fontSize}
            fill={obj.fill}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <div className={`image-editor ${className}`}>
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-section">
          <h3>Tools</h3>
          <div className="tool-grid">
            {DRAWING_TOOLS.map(tool => (
              <button
                key={tool.id}
                className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                onClick={() => setActiveTool(tool.id)}
                title={tool.name}
              >
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-name">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-section">
          <h3>Colors</h3>
          <div className="color-grid">
            {COLORS.map(color => (
              <button
                key={color}
                className={`color-btn ${strokeColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setStrokeColor(color)}
              />
            ))}
          </div>
          <div className="color-inputs">
            <label>
              Stroke:
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
              />
            </label>
            <label>
              Fill:
              <input
                type="color"
                value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                onChange={(e) => setFillColor(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="toolbar-section">
          <h3>Settings</h3>
          <div className="setting-controls">
            <label>
              Stroke Width:
              <input
                type="range"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
              />
              <span>{strokeWidth}px</span>
            </label>
            <label>
              Font Size:
              <input
                type="range"
                min="8"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span>{fontSize}px</span>
            </label>
          </div>
        </div>

        <div className="toolbar-section">
          <h3>Actions</h3>
          <div className="action-buttons">
            <button onClick={undo} disabled={historyStep <= 0}>
              ↶ Undo
            </button>
            <button onClick={redo} disabled={historyStep >= history.length - 1}>
              ↷ Redo
            </button>
            <button onClick={deleteSelected} disabled={!selectedId}>
              🗑️ Delete
            </button>
            <button onClick={clearAll}>
              🧹 Clear All
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <h3>View</h3>
          <div className="zoom-controls">
            <button onClick={zoomOut}>🔍-</button>
            <span>{Math.round(stageScale * 100)}%</span>
            <button onClick={zoomIn}>🔍+</button>
            <button onClick={resetZoom}>Reset</button>
          </div>
        </div>

        <div className="toolbar-section">
          <div className="action-buttons">
            <button className="save-btn" onClick={handleSave}>
              💾 Save
            </button>
            {onClose && (
              <button className="close-btn" onClick={onClose}>
                ✕ Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="editor-canvas" ref={containerRef}>
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          draggable={activeTool === 'select'}
          onDragEnd={(e) => {
            setStagePos({
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
        >
          <Layer>
            {/* Background image */}
            {image && (
              <KonvaImage
                image={image}
                width={image.width}
                height={image.height}
              />
            )}
            
            {/* Drawing objects */}
            {objects.map(renderObject)}
            
            {/* Transformer for selected objects */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit resize
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default ImageEditor;