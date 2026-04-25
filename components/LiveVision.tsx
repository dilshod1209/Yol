
import React, { useRef, useEffect, useState } from 'react';
import { analyzeRoadIssue } from '../geminiService';
import { AnalysisResult, DefectType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface LiveVisionProps {
  onAnalysisUpdate: (result: AnalysisResult, frame: string) => void;
  onSave?: (analysis: AnalysisResult, frame: string) => void;
  isActive: boolean;
  onError?: (msg: string) => void;
  onStartAnalysis?: () => void;
}

const LiveVision: React.FC<LiveVisionProps> = ({ onAnalysisUpdate, onSave, isActive, onError, onStartAnalysis }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const [speed, setSpeed] = useState(72);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [radarAlert, setRadarAlert] = useState<{ active: boolean; distance: number; limit: number } | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (isActive) {
      startCamera();
      const interval = setInterval(() => {
        setFps(Math.floor(Math.random() * (32 - 29) + 29));
        setSpeed(prev => {
          const change = Math.random() > 0.5 ? 1 : -1;
          return Math.max(60, Math.min(120, prev + change));
        });
      }, 1000);
      return () => {
        stopCamera();
        clearInterval(interval);
      };
    } else {
      stopCamera();
    }
  }, [isActive]);

  const startCamera = async () => {
    setPermissionError(null);
    
    if (!window.isSecureContext) {
      setPermissionError("Kamera faqat xavfsiz ulanish (HTTPS) orqali ishlaydi. Iltimos, sayt manzilini tekshiring.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError("Brauzeringiz kamerani qo'llab-quvvatlamaydi. Iltimos, Chrome, Safari yoki Firefox brauzerlarining so'nggi versiyasidan foydalaning.");
      return;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err: any) {
      console.warn(`Camera initialization failed:`, err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError("Kameraga ruxsat berilmadi. Iltimos, brauzer sozlamalaridan ruxsat bering.");
      } else {
        setPermissionError("Kamerani ishga tushirib bo'lmadi.");
      }
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
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'uz-UZ';
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isActive && stream && !isQuotaExhausted) {
      interval = setInterval(captureAndAnalyze, 6000);
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
    const imageData = canvas.toDataURL('image/jpeg', 0.5);

    await processImage(imageData);
  };

  const captureAndAnalyzeFromFile = async (imageData: string) => {
    if (isProcessing || isQuotaExhausted) return;
    await processImage(imageData);
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    if (onStartAnalysis) onStartAnalysis();
    
    try {
      const result = await analyzeRoadIssue(imageData, 'live');
      
      // Simulate radar detection for demo if pothole or high severity
      if (result.severity === 'Yuqori' || result.type === DefectType.POTHOLE) {
        setRadarAlert({ active: true, distance: 450, limit: 70 });
        setTimeout(() => setRadarAlert(null), 8000);
      } else if (result.trafficLight?.detected && result.trafficLight.state === 'red') {
        speak("Diqqat! Svetofor qizil.");
      }

      setLastAnalysis(result);
      onAnalysisUpdate(result, imageData);
      setIsQuotaExhausted(false);
    } catch (err: any) {
      if (err.message === "QUOTA_EXHAUSTED") {
        setIsQuotaExhausted(true);
        if (onError) onError("QUOTA_EXHAUSTED");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const [simulatedObjects, setSimulatedObjects] = useState<{ id: number; type: string; x: number; y: number; w: number; h: number; conf: number }[]>([]);

  useEffect(() => {
    // Simulate persistent object detection for visual aesthetic
    const objects = [
      { id: 1, type: 'Car', x: 200, y: 300, w: 120, h: 80, conf: 92 },
      { id: 2, type: 'Bus', x: 600, y: 150, w: 200, h: 120, conf: 88 },
      { id: 3, type: 'Cyclist', x: 450, y: 500, w: 50, h: 100, conf: 76 }
    ];
    
    const interval = setInterval(() => {
      setSimulatedObjects(objects.map(obj => ({
        ...obj,
        x: obj.x + (Math.random() * 2 - 1),
        y: obj.y + (Math.random() * 2 - 1),
        conf: Math.min(99, Math.max(70, obj.conf + (Math.random() * 2 - 1)))
      })));
    }, 200);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-white/5 group ring-1 ring-white/10">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-20'}`}
      />
      
      {/* Background scan lines */}
      <div className="scan-line"></div>
      
      {/* Scenic Summer Highway Placeholder if no camera */}
      {!stream && isActive && (
        <div className="absolute inset-0 w-full h-full">
          <img 
            src="https://images.unsplash.com/photo-1545143333-636a661917f0?auto=format&fit=crop&q=80&w=1920&h=1080" 
            className="w-full h-full object-cover brightness-50"
            alt="Highway View"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80"></div>
        </div>
      )}

      {/* Simulated Bounding Boxes */}
      {isActive && simulatedObjects.map(obj => (
        <div 
          key={obj.id}
          className="bounding-box border-blue-400"
          style={{
            left: `${(obj.x / 1000) * 100}%`,
            top: `${(obj.y / 1000) * 100}%`,
            width: `${(obj.w / 1000) * 100}%`,
            height: `${(obj.h / 1000) * 100}%`,
          }}
        >
          <div className="absolute -top-4 left-0 text-[8px] font-mono font-bold bg-blue-400 text-white px-1 leading-none uppercase">
            {obj.type} {Math.floor(obj.conf)}%
          </div>
        </div>
      ))}

      {/* Real AI Detection Box */}
      <AnimatePresence>
        {lastAnalysis?.boundingBox && isActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bounding-box border-blue-500 border-2 bg-blue-500/10"
            style={{
              left: `${lastAnalysis.boundingBox.x / 10}%`,
              top: `${lastAnalysis.boundingBox.y / 10}%`,
              width: `${lastAnalysis.boundingBox.width / 10}%`,
              height: `${lastAnalysis.boundingBox.height / 10}%`,
            }}
          >
             <div className="absolute -top-5 left-0 text-[10px] font-mono font-black bg-blue-500 text-white px-1.5 py-0.5 leading-none uppercase">
                DETECTED: {lastAnalysis.type}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
      
      {/* HUD Overlay - Minimalist */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="bg-slate-900/60 backdrop-blur-md px-3 py-1 flex items-center gap-2 border-l-2 border-blue-500">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400">CAM_01_FEED</span>
              </div>
              <div className="bg-white/10 px-3 py-1 text-[8px] font-mono text-white/60 tracking-wider">
                COORD: 41.2995 N, 69.2401 E
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <div className="bg-slate-900/60 backdrop-blur-md px-3 py-1 text-[10px] font-mono font-bold text-white">
                {new Date().toLocaleTimeString()}
              </div>
              <div className="text-[8px] font-mono text-white/30 tracking-tighter uppercase">
                AI_VISION_MODULE_AKTIV
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex gap-4">
              <div className="bg-slate-900/60 backdrop-blur-md p-4 flex flex-col border border-white/5">
                <span className="text-[8px] text-white/40 uppercase tracking-[0.2em] mb-1">Current Speed</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-mono font-bold text-blue-400 leading-none">{speed}</span>
                  <span className="text-[10px] text-white/40 font-bold">KM/H</span>
                </div>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-md p-4 flex flex-col border border-white/5">
                <span className="text-[8px] text-white/40 uppercase tracking-[0.2em] mb-1">Signal</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-mono font-bold text-blue-400 leading-none">98.2</span>
                  <span className="text-[10px] text-white/40 font-bold">%</span>
                </div>
              </div>
            </div>

            {isProcessing && !isQuotaExhausted && (
              <div className="mb-4 mr-4 flex items-center gap-3">
                <div className="flex gap-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-1 h-3 bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
                  ))}
                </div>
                <span className="text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase">Processing_Data</span>
              </div>
            )}

            {isQuotaExhausted && (
              <div className="mb-4 mr-4 flex items-center gap-3 bg-red-600/90 px-4 py-2 rounded-xl backdrop-blur-sm border border-red-500/30">
                <i className="fas fa-triangle-exclamation text-white animate-pulse"></i>
                <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">Tahlil to'xtatildi, limit tugadi</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


export default LiveVision;
