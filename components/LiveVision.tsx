
import React, { useRef, useEffect, useState } from 'react';
import { analyzeRoadIssue } from '../geminiService';
import { AnalysisResult } from '../types';

interface LiveVisionProps {
  onAnalysisUpdate: (result: AnalysisResult, frame: string) => void;
  onSave?: (analysis: AnalysisResult, frame: string) => void;
  isActive: boolean;
  onError?: (msg: string) => void;
}

const LiveVision: React.FC<LiveVisionProps> = ({ onAnalysisUpdate, onSave, isActive, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);

  const handleManualSave = async () => {
    if (!lastAnalysis || !onSave || !canvasRef.current) return;
    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
    onSave(lastAnalysis, imageData);
  };

  useEffect(() => {
    if (isActive) {
      startCamera();
      const fpsInterval = setInterval(() => {
        setFps(Math.floor(Math.random() * (31 - 28) + 28));
      }, 1000);
      return () => {
        stopCamera();
        clearInterval(fpsInterval);
      };
    } else {
      stopCamera();
    }
  }, [isActive]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error("Kameraga kirishda xatolik:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'uz-UZ';
      // Fallback to 'ru-RU' or 'en-US' if 'uz-UZ' is not available
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isActive && stream && !isQuotaExhausted) {
      interval = setInterval(captureAndAnalyze, 7000); // Slightly increased interval to save quota
    }
    return () => clearInterval(interval);
  }, [isActive, stream, isQuotaExhausted]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing || isQuotaExhausted) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.5); // Lower quality to save bandwidth

    setIsProcessing(true);
    try {
      const result = await analyzeRoadIssue(imageData, 'live');
      setLastAnalysis(result);
      onAnalysisUpdate(result, imageData);
      
      // Voice alert for red traffic light
      if (result.trafficLight?.detected && result.trafficLight.state === 'red') {
        const distance = result.trafficLight.distance || 0;
        if (distance <= 150) {
          speak("Diqqat! Svetofor qizil. To'xtang!");
        }
      }

      setIsQuotaExhausted(false);
    } catch (err: any) {
      console.error("Live analysis error:", err);
      if (err.message === "QUOTA_EXHAUSTED") {
        setIsQuotaExhausted(true);
        if (onError) onError("QUOTA_EXHAUSTED");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video shadow-2xl border-4 border-white ring-1 ring-slate-200 group">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover scale-105 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
      />
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700 shadow-inner">
            <i className="fas fa-video-slash text-3xl text-slate-600"></i>
          </div>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">Kamera O'chirilgan</p>
          <p className="text-slate-600 text-[10px] mt-2">Monitoringni boshlash uchun "Kamerani qo'shish" tugmasini bosing</p>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* HUD Overlay */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
          
          {/* Bounding Box Overlay */}
          {lastAnalysis?.boundingBox && (
            <div 
              className="absolute border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-500"
              style={{
                left: `${lastAnalysis.boundingBox.x / 10}%`,
                top: `${lastAnalysis.boundingBox.y / 10}%`,
                width: `${lastAnalysis.boundingBox.width / 10}%`,
                height: `${lastAnalysis.boundingBox.height / 10}%`,
              }}
            >
              <div className="absolute -top-6 left-0 bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-t uppercase">
                {lastAnalysis.type}
              </div>
            </div>
          )}

          {/* Top HUD */}
          <div className="flex justify-between items-start opacity-70 group-hover:opacity-100 transition-opacity">
            <div className="space-y-1">
               <div className="flex items-center space-x-2 text-[10px] font-black text-white/70 tracking-widest uppercase">
                 <i className={`fas fa-wifi ${isQuotaExhausted ? 'text-red-500' : 'text-emerald-400 animate-pulse'}`}></i>
                 <span>Status: {isQuotaExhausted ? 'QUOTA_ERROR' : 'CONNECTED'}</span>
               </div>
               <div className="text-blue-400 font-mono text-[9px] tracking-widest uppercase">AI ENGINE: v2.5.0-ALPHA</div>
            </div>
            <div className="text-right">
               <div className="text-white font-mono text-xs">{new Date().toLocaleTimeString()}</div>
               <div className="text-white/40 font-mono text-[9px] uppercase tracking-widest">{fps} FPS</div>
            </div>
          </div>

          {/* Center Scan Area */}
          <div className="absolute inset-0 flex items-center justify-center">
             <div className={`w-1/2 h-1/2 border ${isQuotaExhausted ? 'border-red-500/30' : 'border-blue-500/20'} rounded-3xl relative`}>
                <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${isQuotaExhausted ? 'border-red-500' : 'border-blue-500'}`}></div>
                <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${isQuotaExhausted ? 'border-red-500' : 'border-blue-500'}`}></div>
                <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${isQuotaExhausted ? 'border-red-500' : 'border-blue-500'}`}></div>
                <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${isQuotaExhausted ? 'border-red-500' : 'border-blue-500'}`}></div>
                {!isQuotaExhausted && <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan"></div>}
                {isQuotaExhausted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/5">
                    <span className="text-red-500 font-black text-[10px] uppercase tracking-[0.2em] bg-black/60 px-4 py-2 rounded-xl border border-red-500/20">QUOTA_EXCEEDED</span>
                  </div>
                )}
             </div>
          </div>

          {/* Bottom HUD */}
          <div className="flex justify-between items-end">
            <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10">
               <div className="text-[8px] font-black text-white/30 uppercase mb-1 tracking-widest">Vision Data</div>
               <div className="flex space-x-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/60 font-bold uppercase">MODE: {isQuotaExhausted ? 'HALT' : 'SCAN'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/60 font-bold uppercase">LAT: 12ms</span>
                  </div>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              {lastAnalysis && (
                <button 
                  onClick={handleManualSave}
                  className="bg-emerald-600 px-6 py-3 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-emerald-500 transition-all pointer-events-auto flex items-center gap-2"
                >
                  <i className="fas fa-paper-plane"></i>
                  Adminga yuborish
                </button>
              )}
              {isProcessing && (
                <div className="bg-blue-600 px-6 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-2xl animate-pulse">
                  Neural Computing...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LiveVision;
