
import React, { useState, useRef, useEffect } from 'react';
import { Point, MeasurementLine } from '../types';

interface MeasurementOverlayProps {
  lengthLine: MeasurementLine;
  widthLine: MeasurementLine;
  onUpdate: (length: MeasurementLine, width: MeasurementLine) => void;
  isSwapped: boolean;
  activeLine: 'length' | 'width' | 'none';
}

type DragState = {
  line: 'length' | 'width';
  point: 'start' | 'end';
} | null;

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({ 
  lengthLine, 
  widthLine, 
  onUpdate,
  isSwapped,
  activeLine
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>(null);

  const getEventPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStart = (line: 'length' | 'width', point: 'start' | 'end') => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setDragState({ line, point });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState) return;
    const point = getEventPoint(e);
    if (!point) return;

    // Clamp values
    const clampedPoint = {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y))
    };

    const newLength = { ...lengthLine };
    const newWidth = { ...widthLine };

    if (dragState.line === 'length') {
      newLength[dragState.point] = clampedPoint;
    } else {
      newWidth[dragState.point] = clampedPoint;
    }

    onUpdate(newLength, newWidth);
  };

  const handleEnd = () => setDragState(null);

  const renderLine = (line: MeasurementLine, color: string, label: string, isCurrentlyActive: boolean) => {
    if (!isCurrentlyActive) return null;

    const x1 = line.start.x * 100;
    const y1 = line.start.y * 100;
    const x2 = line.end.x * 100;
    const y2 = line.end.y * 100;

    const lineId = label.toLowerCase().includes('length') ? 'length' : 'width';

    return (
      <svg key={label} className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-40 animate-in fade-in duration-300">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Shadow/Contrast Line */}
        <line 
          x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
          stroke="black" strokeWidth="5" strokeOpacity="0.3"
        />

        <line 
          x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
          stroke={color} strokeWidth="3" strokeDasharray="6 3"
          filter="url(#glow)"
        />

        {/* Start Handle */}
        <circle 
          cx={`${x1}%`} cy={`${y1}%`} r="18" fill="white" fillOpacity="0.2" className="pointer-events-auto cursor-move"
          onMouseDown={handleStart(lineId as any, 'start')}
          onTouchStart={handleStart(lineId as any, 'start')}
        />
        <circle 
          cx={`${x1}%`} cy={`${y1}%`} r="10" fill={color} stroke="white" strokeWidth="2"
          className="pointer-events-none"
        />

        {/* End Handle */}
        <circle 
          cx={`${x2}%`} cy={`${y2}%`} r="18" fill="white" fillOpacity="0.2" className="pointer-events-auto cursor-move"
          onMouseDown={handleStart(lineId as any, 'end')}
          onTouchStart={handleStart(lineId as any, 'end')}
        />
        <circle 
          cx={`${x2}%`} cy={`${y2}%`} r="10" fill={color} stroke="white" strokeWidth="2"
          className="pointer-events-none"
        />

        {/* Label Background */}
        <g transform={`translate(${(x1 + x2) / 2 * 1}, ${(y1 + y2) / 2 * 1})`}>
          <rect 
            x="-35" y="-12" 
            width="70" height="24" rx="12" 
            fill={color} 
            className="shadow-xl"
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}
          />
          <text 
            fill="white" fontSize="11" fontWeight="900" textAnchor="middle" dominantBaseline="middle"
            className="uppercase tracking-widest"
          >
            {label}
          </text>
        </g>
      </svg>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair touch-none select-none z-30"
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {/* Background Dimming when active */}
      {activeLine !== 'none' && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none transition-opacity duration-300"></div>
      )}

      {renderLine(lengthLine, '#3b82f6', isSwapped ? 'WIDTH' : 'LENGTH', activeLine === 'length')}
      {renderLine(widthLine, '#10b981', isSwapped ? 'LENGTH' : 'WIDTH', activeLine === 'width')}
    </div>
  );
};
