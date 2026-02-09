
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, WoundAnalysisResult, CapturedImage, CaptureView, Patient, AssessmentEntry } from './types';
import CameraInterface from './components/CameraInterface';
import ResultView from './components/ResultView';
import HistoryView from './components/HistoryView';
import { analyzeWound } from './services/geminiService';

const LOADING_MESSAGES = [
  "Analyzing Wound Topology...",
  "Measuring Dimensions...",
  "Identifying Wound Edges...",
  "Segmenting Surrounding Tissue...",
  "Calculating Depth Mapping...",
  "Analyzing Tissue Composition...",
  "Synthesizing Clinical Report..."
];

const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<AppState>(AppState.HOME);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [analysisResult, setAnalysisResult] = useState<WoundAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('arrow_wound_patients');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((p: any) => ({
            ...p,
            assessments: (p.assessments || []).map((a: any) => ({
              ...a,
              images: a.images || [{ base64: a.image, view: CaptureView.PLANAR }]
            }))
          }));
          setPatients(migrated);
        }
      } catch (e) {
        console.error("Failed to load patient history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('arrow_wound_patients', JSON.stringify(patients));
  }, [patients]);

  // Cycle through loading messages when analyzing
  useEffect(() => {
    let interval: number;
    if (isAnalyzing) {
      interval = window.setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isAnalyzing]);

  const requestSensorPermission = async () => {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        return permissionState === 'granted';
      } catch (e) {
        return false;
      }
    }
    return true; 
  };

  const handleStartCamera = async () => {
    await requestSensorPermission();
    setCurrentState(AppState.CAMERA);
  };

  const handleCapture = useCallback((base64: string, view: CaptureView, orientation?: { beta: number, gamma: number }) => {
    setCapturedImages(prev => [...prev, { base64, view, orientation }]);
    setCurrentState(AppState.STAGING);
  }, []);

  const removeImage = (index: number) => {
    setCapturedImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) resetApp();
      return updated;
    });
  };

  const startAnalysis = async () => {
    if (capturedImages.length === 0) return;
    setCurrentState(AppState.ANALYZING);
    setIsAnalyzing(true);
    setLoadingMessageIndex(0);
    try {
      const result = await analyzeWound(capturedImages);
      setAnalysisResult(result);
      setCurrentState(AppState.RESULTS);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis engine encountered an error. Please try again with better lighting.");
      setCurrentState(AppState.STAGING);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditAssessment = (patient: Patient, entry: AssessmentEntry) => {
    setCapturedImages(entry.images);
    setAnalysisResult(entry.result);
    setEditingAssessmentId(entry.id);
    setCurrentState(AppState.RESULTS);
  };

  const handleSaveAssessment = (patientName: string, updatedResult: WoundAnalysisResult) => {
    setPatients(prev => {
      const updatedPatients = [...prev];
      const patientIdx = updatedPatients.findIndex(p => p.name.toLowerCase() === patientName.toLowerCase());

      if (editingAssessmentId) {
        if (patientIdx > -1) {
          const entryIdx = updatedPatients[patientIdx].assessments.findIndex(a => a.id === editingAssessmentId);
          if (entryIdx > -1) {
            updatedPatients[patientIdx].assessments[entryIdx] = { ...updatedPatients[patientIdx].assessments[entryIdx], result: updatedResult, images: capturedImages };
          }
        }
      } else {
        const newEntry: AssessmentEntry = { id: Date.now().toString(), date: new Date().toISOString(), result: updatedResult, images: capturedImages };
        if (patientIdx > -1) updatedPatients[patientIdx].assessments.push(newEntry);
        else updatedPatients.push({ id: Date.now().toString(), name: patientName, assessments: [newEntry] });
      }
      return updatedPatients;
    });
    resetApp();
    setCurrentState(AppState.HISTORY);
  };

  const resetApp = () => {
    setCapturedImages([]);
    setAnalysisResult(null);
    setEditingAssessmentId(null);
    setCurrentState(AppState.HOME);
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const fileArray = Array.from(files) as File[];
    const base64s = await Promise.all(fileArray.map(file => new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1] || '');
        } else {
          resolve('');
        }
      };
      r.readAsDataURL(file);
    })));
    setCapturedImages(prev => [...prev, ...base64s.filter(b => b !== '').map(b => ({ base64: b, view: CaptureView.PLANAR }))]);
    setCurrentState(AppState.STAGING);
    if (event.target) event.target.value = '';
  };

  const hasAdjustmentsInHistory = patients.some(p => p.assessments.some(a => a.result.isManualAdjustment));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={resetApp}>
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-location-arrow"></i>
          </div>
          <h1 className="font-black text-xl tracking-tighter"><span className="text-red-600">Arrow</span><span className="text-blue-600">Wound</span></h1>
        </div>
        <button onClick={() => setCurrentState(AppState.HISTORY)} className="text-slate-400 hover:text-blue-600 p-2 transition-all active:bg-blue-50 rounded-full">
           <i className="fa-solid fa-folder-open"></i>
        </button>
      </header>

      <main className="container mx-auto max-w-lg min-h-[calc(100vh-140px)]">
        {currentState === AppState.HOME && (
          <div className="p-8 flex flex-col items-center text-center space-y-12 py-20 animate-in fade-in zoom-in-95 duration-500">
            <div className="space-y-4">
              <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto text-red-600 text-4xl shadow-xl shadow-red-100/50">
                <i className="fa-solid fa-location-arrow rotate-45"></i>
              </div>
              <h2 className="text-4xl font-black text-slate-900 leading-tight tracking-tighter"><span className="text-red-600">Arrow</span><span className="text-blue-600">Wound</span></h2>
              <p className="text-slate-500 font-medium max-w-xs mx-auto text-sm leading-relaxed">Precision clinical vision for the modern healthcare facility.</p>
            </div>

            <div className="w-full space-y-4">
              <button onClick={handleStartCamera} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center space-x-3 active:bg-blue-800">
                <i className="fa-solid fa-camera text-xl"></i>
                <span>Capture New Scan</span>
              </button>
              
              <button onClick={triggerUpload} className="w-full bg-white border-2 border-blue-600 text-blue-600 font-black py-5 rounded-2xl transition-all hover:bg-blue-50 flex items-center justify-center space-x-3 active:bg-blue-100">
                <i className="fa-solid fa-arrow-up-from-bracket text-xl"></i>
                <span>Upload Clinical Images</span>
              </button>

              <button 
                onClick={() => setCurrentState(AppState.HISTORY)} 
                className="w-full bg-slate-100 border-2 border-slate-200 text-slate-700 font-black py-5 rounded-2xl transition-all hover:bg-slate-200 flex items-center justify-center space-x-3 active:scale-[0.98]"
              >
                <i className="fa-solid fa-folder-tree text-xl"></i>
                <span>Saved Assessments</span>
              </button>
            </div>
          </div>
        )}

        {currentState === AppState.STAGING && (
          <div className="p-6 space-y-8 animate-in slide-in-from-bottom-6 duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800">Staged Scans</h2>
              <button onClick={resetApp} className="text-[10px] font-black uppercase text-red-500 tracking-widest hover:bg-red-50 px-3 py-2 rounded-lg">Reset</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {capturedImages.map((img, idx) => (
                <div key={idx} className="relative rounded-2xl overflow-hidden border-2 border-slate-200 aspect-square group shadow-sm">
                  <img src={`data:image/jpeg;base64,${img.base64}`} className="w-full h-full object-cover" alt="Scan" />
                  <button onClick={() => removeImage(idx)} className="absolute bottom-2 right-2 w-8 h-8 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              ))}
              <button onClick={handleStartCamera} className="rounded-2xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center aspect-square text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all active:bg-blue-50">
                <i className="fa-solid fa-plus text-3xl"></i>
              </button>
            </div>
            <button onClick={startAnalysis} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-2xl transition-all active:bg-blue-800 flex items-center justify-center gap-3">
              <i className="fa-solid fa-wand-magic-sparkles text-xl"></i> Run Analysis
            </button>
          </div>
        )}

        {currentState === AppState.CAMERA && <CameraInterface onCapture={handleCapture} onCancel={() => capturedImages.length > 0 ? setCurrentState(AppState.STAGING) : setCurrentState(AppState.HOME)} />}

        {currentState === AppState.ANALYZING && (
          <div className="fixed inset-0 bg-white/95 z-[100] flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-300">
            <div className="relative">
               <div className="w-32 h-32 border-8 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center text-red-600 text-2xl">
                  <i className="fa-solid fa-location-arrow animate-bounce"></i>
               </div>
            </div>
            <div className="text-center space-y-4 max-w-xs">
              <h3 className="text-2xl font-black tracking-tighter transition-all duration-500 animate-pulse text-slate-800">
                {LOADING_MESSAGES[loadingMessageIndex]}
              </h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                {hasAdjustmentsInHistory ? 'Clinical Learning Loop: ACTIVE' : 'Estimating Volumetric Scaling...'}
              </p>
            </div>
          </div>
        )}

        {currentState === AppState.RESULTS && analysisResult && capturedImages.length > 0 && (
          <ResultView result={analysisResult} image={capturedImages[0].base64} onReset={resetApp} onBack={() => setCurrentState(AppState.STAGING)} onSave={handleSaveAssessment} isEditing={!!editingAssessmentId} initialPatientName={patients.find(p => p.assessments.some(a => a.id === editingAssessmentId))?.name} />
        )}

        {currentState === AppState.HISTORY && (
          <HistoryView patients={patients} onDeletePatient={(id) => setPatients(p => p.filter(x => x.id !== id))} onBack={resetApp} onEditAssessment={handleEditAssessment} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center z-40">
        <button onClick={resetApp} className={`flex flex-col items-center gap-1 transition-all ${currentState === AppState.HOME ? 'text-blue-600' : 'text-slate-400'}`}>
          <i className="fa-solid fa-house"></i>
          <span className="text-[10px] font-black uppercase tracking-tighter">Home</span>
        </button>
        <button onClick={handleStartCamera} className="relative flex flex-col items-center justify-center text-white">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl shadow-xl flex items-center justify-center -mt-12 border-4 border-white active:bg-blue-800 transition-all">
            <i className="fa-solid fa-camera"></i>
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 mt-2">Scan</span>
        </button>
        <button onClick={() => setCurrentState(AppState.HISTORY)} className={`flex flex-col items-center gap-1 transition-all ${currentState === AppState.HISTORY ? 'text-blue-600' : 'text-slate-400'}`}>
          <i className="fa-solid fa-folder-open"></i>
          <span className="text-[10px] font-black uppercase tracking-tighter">Files</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
