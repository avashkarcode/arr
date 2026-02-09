
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CaptureView } from '../types';

interface CameraInterfaceProps {
  onCapture: (base64: string, view: CaptureView, orientation?: { beta: number, gamma: number }) => void;
  onCancel: () => void;
  defaultView?: CaptureView;
}

const CameraInterface: React.FC<CameraInterfaceProps> = ({ onCapture, onCancel, defaultView = CaptureView.PLANAR }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewType, setViewType] = useState<CaptureView>(defaultView);
  const [orientation, setOrientation] = useState({ beta: 0, gamma: 0 });
  const [isLeveled, setIsLeveled] = useState(false);
  const [hasSensorActivity, setHasSensorActivity] = useState(false);
  const [dismissSensorWarning, setDismissSensorWarning] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 } 
          },
          audio: false
        });
        currentStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play failed:", e));
        }

        // Check for flash (torch) capability
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
            setHasFlash(true);
          }
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Camera access was denied or is not available on this device.");
        onCancel();
      }
    }
    setupCamera();

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const b = e.beta || 0;
      const g = e.gamma || 0;
      
      if (Math.abs(b) > 0.01 || Math.abs(g) > 0.01) {
        setHasSensorActivity(true);
      }

      setOrientation({ beta: b, gamma: g });
      
      if (viewType === CaptureView.PLANAR) {
        setIsLeveled(Math.abs(b) < 6 && Math.abs(g) < 6);
      } else {
        setIsLeveled(Math.abs(b) > 25 && Math.abs(b) < 65);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [viewType, onCancel]);

  const toggleFlash = async () => {
    if (!videoRef.current?.srcObject) return;
    const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
    if (track) {
      try {
        const newState = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: newState } as any]
        });
        setIsFlashOn(newState);
      } catch (e) {
        console.error("Failed to toggle flash:", e);
      }
    }
  };

  const requestSensorPermissionManual = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        if (state === 'granted') {
          // Success handled by event listener
        } else {
          setDismissSensorWarning(true);
        }
      } catch (e) {
        console.error(e);
        setDismissSensorWarning(true);
      }
    } else {
      setDismissSensorWarning(true);
    }
  };

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        onCapture(base64, viewType, orientation);
      }
    }
  }, [onCapture, viewType, orientation]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="absolute inset-0 w-full h-full object-cover" 
        />
        
        <div className={`absolute inset-0 border-[6px] transition-all duration-300 pointer-events-none z-10 ${isLeveled && hasSensorActivity ? 'border-green-500 opacity-40 shadow-[inset_0_0_100px_rgba(34,197,94,0.3)]' : 'border-transparent opacity-0'}`}></div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          {!hasSensorActivity && !dismissSensorWarning && (
            <div className="pointer-events-auto bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-center max-w-xs space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto text-xl">
                <i className="fa-solid fa-compass-drafting"></i>
              </div>
              <div className="space-y-1">
                <p className="text-white text-sm font-bold">Clinical Leveler Inactive</p>
                <p className="text-white/60 text-[11px] leading-tight px-2">Orientation data is unavailable in this environment. You may proceed in Standard Mode.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={requestSensorPermissionManual}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform text-xs"
                >
                  Attempt Sensor Access
                </button>
                <button 
                  onClick={() => setDismissSensorWarning(true)}
                  className="w-full bg-white/5 text-white/40 font-bold py-2 rounded-xl text-[10px] uppercase tracking-widest"
                >
                  Proceed without Sensors
                </button>
              </div>
            </div>
          )}

          {hasSensorActivity && (
            <div className={`w-40 h-40 border-2 rounded-full flex items-center justify-center transition-all duration-300 ${isLeveled ? 'border-green-400 scale-110' : 'border-white/20'}`}>
              <div className={`w-0.5 h-12 absolute transition-colors ${isLeveled ? 'bg-green-400' : 'bg-white/20'}`}></div>
              <div className={`h-0.5 w-12 absolute transition-colors ${isLeveled ? 'bg-green-400' : 'bg-white/20'}`}></div>
              
              <div 
                className={`w-8 h-8 rounded-full absolute shadow-2xl border-2 transition-all duration-200 ease-out flex items-center justify-center ${isLeveled ? 'bg-green-500 border-white scale-125' : 'bg-white/10 border-white/40'}`}
                style={{ transform: `translate(${orientation.gamma * 2}px, ${orientation.beta * 0.5}px)` }}
              >
                {isLeveled && <i className="fa-solid fa-check text-white text-[10px]"></i>}
              </div>

              {viewType === CaptureView.OBLIQUE && !isLeveled && (
                <div className="absolute -bottom-8 text-white/60 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                  Tilt to ~45°
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top Controls */}
        <div className="absolute top-12 inset-x-0 px-6 flex justify-between items-center z-30">
          <button 
            onClick={onCancel} 
            className="flex items-center gap-2 bg-black/40 backdrop-blur-md text-white py-2 px-4 rounded-full border border-white/20 hover:bg-black/60 transition-all active:scale-95 shadow-lg"
          >
            <i className="fa-solid fa-xmark"></i>
            <span className="text-xs font-bold uppercase tracking-widest">Cancel</span>
          </button>

          {hasFlash && (
            <button 
              onClick={toggleFlash} 
              className={`w-10 h-10 backdrop-blur-sm rounded-full flex items-center justify-center transition-all ${isFlashOn ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'bg-black/40 text-white'}`}
            >
              <i className={`fa-solid ${isFlashOn ? 'fa-bolt' : 'fa-bolt-slash'}`}></i>
            </button>
          )}
        </div>

        {/* View Instructions */}
        <div className="absolute top-28 left-1/2 -translate-x-1/2 w-full max-w-xs px-4 z-30">
          <div className="bg-blue-600/90 backdrop-blur-md text-white p-3 rounded-2xl flex items-center gap-3 shadow-2xl border border-white/20 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <i className={`fa-solid ${viewType === CaptureView.PLANAR ? 'fa-camera-rotate' : 'fa-ruler-vertical'} text-lg`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-70">
                {viewType === CaptureView.PLANAR ? 'Step 1: Top View' : 'Step 2: Side View'}
              </p>
              <p className="text-[11px] font-bold leading-tight">
                {viewType === CaptureView.PLANAR 
                  ? 'Hold phone flat and level above the wound.' 
                  : 'Tilt to 45 degrees to capture depth detail.'}
              </p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="absolute bottom-8 inset-x-0 px-6 text-center z-30">
          <div className={`py-3 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-3 shadow-2xl border transition-all duration-300 ${isLeveled && hasSensorActivity ? 'bg-green-600 border-green-400 text-white scale-105' : 'bg-black/60 border-white/10 text-white/70'}`}>
            <i className={`fa-solid ${hasSensorActivity ? (isLeveled ? 'fa-circle-check animate-bounce' : 'fa-circle-notch fa-spin opacity-50') : 'fa-camera'}`}></i>
            {hasSensorActivity ? (isLeveled ? 'Ready to Capture' : 'Align for Accuracy') : 'Standard Mode'}
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 pb-12 pt-8 flex flex-col items-center space-y-8 relative z-40">
        <div className="flex bg-white/5 rounded-full p-1.5 w-72 border border-white/10">
          <button 
            onClick={() => setViewType(CaptureView.PLANAR)}
            className={`flex-1 py-3 rounded-full text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${viewType === CaptureView.PLANAR ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-white/40 hover:text-white/60'}`}
          >
            <i className="fa-solid fa-image"></i>
            Top View
          </button>
          <button 
            onClick={() => setViewType(CaptureView.OBLIQUE)}
            className={`flex-1 py-3 rounded-full text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${viewType === CaptureView.OBLIQUE ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-white/40 hover:text-white/60'}`}
          >
            <i className="fa-solid fa-cube"></i>
            Side View
          </button>
        </div>

        <div className="flex items-center justify-center w-full relative">
          <div className="absolute left-10 text-white/30 text-[10px] font-mono flex flex-col items-center">
            <span className="text-[8px] font-bold text-white/20 uppercase mb-1">Tilt</span>
            {hasSensorActivity ? `${Math.round(orientation.beta)}°` : '--'}
          </div>

          <div className="relative flex items-center justify-center">
            <div className={`absolute w-24 h-24 rounded-full border-4 transition-all duration-500 ${isLeveled && hasSensorActivity ? 'border-green-500 opacity-100 scale-100' : 'border-white/10 opacity-0 scale-90'}`}></div>
            
            <button 
              onClick={capturePhoto}
              className={`w-20 h-20 rounded-full border-[6px] border-neutral-800 shadow-2xl transition-all duration-300 active:scale-90 flex items-center justify-center group ${isLeveled && hasSensorActivity ? 'bg-white' : 'bg-neutral-700'}`}
            >
              <div className={`w-14 h-14 rounded-full border-2 border-black/5 flex items-center justify-center transition-all duration-300 ${viewType === CaptureView.PLANAR ? (hasSensorActivity && isLeveled ? 'bg-blue-600' : 'bg-blue-900/50') : (hasSensorActivity && isLeveled ? 'bg-emerald-600' : 'bg-emerald-900/50')}`}>
                <i className={`fa-solid fa-camera text-white transition-transform ${isLeveled && hasSensorActivity ? 'scale-110' : 'scale-90 opacity-70'}`}></i>
              </div>
            </button>
          </div>

          <div className="absolute right-10 text-white/30 text-[10px] font-mono flex flex-col items-center">
             <span className="text-[8px] font-bold text-white/20 uppercase mb-1">Roll</span>
             {hasSensorActivity ? `${Math.round(orientation.gamma)}°` : '--'}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraInterface;
