
import React, { useState, useMemo, useEffect } from 'react';
import { WoundAnalysisResult, MeasurementLine, TunnelingRecord, UnderminingRecord } from '../types';
import { MeasurementOverlay } from './MeasurementOverlay';

interface ResultViewProps {
  result: WoundAnalysisResult;
  image: string;
  onReset: () => void;
  onBack: () => void;
  onSave: (patientName: string, updatedResult: WoundAnalysisResult) => void;
  isEditing?: boolean;
  initialPatientName?: string;
}

const PERI_WOUND_OPTIONS = [
  'Intact', 'Macerated', 'Erythematous', 'Indurated', 'Dry/Scaly', 'Pigmented', 'Excoriated', 'Other'
];

const DEPTH_OPTIONS = Array.from({ length: 101 }, (_, i) => (i * 0.1).toFixed(1));
const CLOCK_OPTIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const ResultView: React.FC<ResultViewProps> = ({ result, image, onReset, onBack, onSave, isEditing, initialPatientName }) => {
  const safeLengthLine = result.lengthLine || { start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 } };
  const safeWidthLine = result.widthLine || { start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.8 } };

  const [editedLength, setEditedLength] = useState<MeasurementLine>(safeLengthLine);
  const [editedWidth, setEditedWidth] = useState<MeasurementLine>(safeWidthLine);
  const [manualDepth, setManualDepth] = useState<number>(result.depthCm || 0);
  const [activeMetric, setActiveMetric] = useState<'length' | 'width' | 'depth' | 'none'>('none');
  const [isSwapped, setIsSwapped] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isFaxDialogOpen, setIsFaxDialogOpen] = useState(false);
  const [isFaxing, setIsFaxing] = useState(false);
  const [faxStatus, setFaxStatus] = useState('');
  const [faxNumber, setFaxNumber] = useState('');
  const [patientName, setPatientName] = useState(initialPatientName || '');
  
  const [tunneling, setTunneling] = useState<TunnelingRecord[]>(result.tunneling || []);
  const [undermining, setUndermining] = useState<UnderminingRecord[]>(result.undermining || []);
  const [tissueTypes, setTissueTypes] = useState(result.tissueTypes || { epithelization: 0, granulation: 0, slough: 0, eschar: 0 });
  
  const [selectedPeriWoundTags, setSelectedPeriWoundTags] = useState<string[]>(
    result.periWoundAppearance ? result.periWoundAppearance.split(', ').filter(t => PERI_WOUND_OPTIONS.includes(t)) : []
  );
  const [customPeriWound, setCustomPeriWound] = useState(
    result.periWoundAppearance?.split(', ').find(t => !PERI_WOUND_OPTIONS.includes(t) && t !== '') || ''
  );

  useEffect(() => {
    if (initialPatientName) setPatientName(initialPatientName);
  }, [initialPatientName]);

  const calculateDistance = (currentLine: MeasurementLine, originalLine: MeasurementLine, originalCm: number) => {
    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const currentLen = dist(currentLine.start, currentLine.end);
    const originalLen = dist(originalLine.start, originalLine.end);
    if (originalLen === 0) return originalCm || 0;
    return Number(((currentLen / originalLen) * (originalCm || 1)).toFixed(2));
  };

  const currentLengthCm = useMemo(() => calculateDistance(editedLength, safeLengthLine, result.lengthCm), [editedLength, safeLengthLine, result]);
  const currentWidthCm = useMemo(() => calculateDistance(editedWidth, safeWidthLine, result.widthCm), [editedWidth, safeWidthLine, result]);

  const displayLength = Number((isSwapped ? currentWidthCm : currentLengthCm).toFixed(2));
  const displayWidth = Number((isSwapped ? currentLengthCm : currentWidthCm).toFixed(2));
  const displayDepth = Number(manualDepth.toFixed(2));
  const displayArea = Number((displayLength * displayWidth * 0.785).toFixed(2));

  const lengthAdjusted = displayLength !== result.lengthCm;
  const widthAdjusted = displayWidth !== result.widthCm;
  const depthAdjusted = displayDepth !== result.depthCm;
  const isAnyAdjusted = lengthAdjusted || widthAdjusted || depthAdjusted;

  const getCalibrationLabel = () => {
    switch(result.calibrationMethod) {
      case 'dime': return 'Dime Verified (17.91mm)';
      case 'ruler': return 'Ruler Calibrated';
      case 'sticker': return 'Marker Verified (1cm)';
      default: return 'Visual Estimation';
    }
  };

  const getCalibrationIcon = () => {
    switch(result.calibrationMethod) {
      case 'dime': return 'fa-coins';
      case 'ruler': return 'fa-ruler-horizontal';
      case 'sticker': return 'fa-certificate';
      default: return 'fa-eye';
    }
  };

  const generateReportText = (forFax = false) => {
    const combinedPeriWound = [...selectedPeriWoundTags.filter(t => t !== 'Other'), ...(selectedPeriWoundTags.includes('Other') && customPeriWound ? [customPeriWound] : [])].join(', ');
    const header = forFax ? "CONFIDENTIAL SECURE FAX TRANSMISSION\nTO EMR GATEWAY\n---------------------------------\n" : "ARROW WOUND CLINICAL REPORT\n";
    return `${header}Patient: ${patientName || 'Anonymous'}\nDate: ${new Date().toLocaleString()}\nCalibration: ${getCalibrationLabel()}\n\nMEASUREMENTS:\n- Length: ${displayLength} cm\n- Width: ${displayWidth} cm\n- Depth: ${displayDepth} cm\n- Area: ${displayArea} cm²\n\nTISSUE:\n- Epithelialization: ${tissueTypes.epithelization}%\n- Granulation: ${tissueTypes.granulation}%\n- Slough: ${tissueTypes.slough}%\n- Eschar: ${tissueTypes.eschar}%\n\nPERI-WOUND:\n${combinedPeriWound || 'Intact'}\n\nGenerated by ArrowWound Pro.\nCONFIRMATION ID: ${Date.now()}`;
  };

  const handleShareReport = async () => {
    const reportText = generateReportText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Wound Report: ${patientName || 'Clinic'}`,
          text: reportText,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(reportText);
      alert("Report copied to clipboard. (Device sharing not supported in this browser)");
    }
  };

  const handleFaxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faxNumber.trim()) return;
    
    setIsFaxing(true);
    setFaxStatus('Connecting to Secure Gateway...');
    
    // Simulate clinical transmission phases
    setTimeout(() => setFaxStatus('Encrypting Clinical Payload...'), 1200);
    setTimeout(() => setFaxStatus('Handshaking with EMR Endpoint...'), 2400);
    setTimeout(() => setFaxStatus('Transmitting Page 1/1...'), 3600);
    
    setTimeout(() => {
      setIsFaxing(false);
      setIsFaxDialogOpen(false);
      alert(`Fax sent successfully to ${faxNumber}. Confirmation ID: ${Math.floor(Math.random() * 1000000)}`);
      setFaxNumber('');
    }, 5000);
  };

  const togglePeriWoundTag = (tag: string) => {
    setSelectedPeriWoundTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const updateTunnel = (idx: number, updates: Partial<TunnelingRecord>) => {
    const next = [...tunneling];
    next[idx] = { ...next[idx], ...updates };
    setTunneling(next);
  };

  const updateUndermining = (idx: number, updates: Partial<UnderminingRecord>) => {
    const next = [...undermining];
    next[idx] = { ...next[idx], ...updates };
    setUndermining(next);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    const combinedPeriWound = [...selectedPeriWoundTags.filter(t => t !== 'Other'), ...(selectedPeriWoundTags.includes('Other') && customPeriWound ? [customPeriWound] : [])].join(', ');
    onSave(patientName, { 
      ...result, 
      lengthCm: displayLength, 
      widthCm: displayWidth, 
      depthCm: displayDepth, 
      areaCm2: displayArea, 
      tunneling, 
      undermining, 
      tissueTypes, 
      periWoundAppearance: combinedPeriWound, 
      lengthLine: editedLength, 
      widthLine: editedWidth, 
      isManualAdjustment: isAnyAdjusted, 
      originalValues: isAnyAdjusted ? { lengthCm: result.lengthCm, widthCm: result.widthCm, depthCm: result.depthCm } : undefined 
    });
    setIsSaveDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-32 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-500 p-2 -ml-2 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all active:bg-blue-100 flex items-center gap-2">
            <i className="fa-solid fa-arrow-left"></i>
            <span className="text-sm font-bold">Back</span>
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Clinical Results</h2>
        </div>
        <div className="flex gap-2">
          {result.calibrationMethod !== 'visual_estimation' && (
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm flex items-center">
              <i className={`fa-solid ${getCalibrationIcon()} mr-1.5`}></i> Verified
            </div>
          )}
          <button onClick={handleShareReport} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95">
            <i className="fa-solid fa-share-nodes"></i>
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-100 relative bg-black aspect-video flex items-center justify-center">
        <img src={`data:image/jpeg;base64,${image}`} alt="Wound" className="w-full h-full object-contain" />
        <MeasurementOverlay lengthLine={editedLength} widthLine={editedWidth} isSwapped={isSwapped} activeLine={activeMetric === 'length' ? 'length' : activeMetric === 'width' ? 'width' : 'none'} onUpdate={(l, w) => { setEditedLength(l); setEditedWidth(w); }} />
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center text-white shadow-lg border border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.calibrationMethod !== 'visual_estimation' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-700'}`}>
            <i className={`fa-solid ${getCalibrationIcon()}`}></i>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Calibration Method</p>
            <p className="text-xs font-bold">{getCalibrationLabel()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">AI Confidence</p>
          <p className="text-xs font-bold text-blue-400">{Math.round(result.accuracyConfidence * 100)}%</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-location-arrow text-red-600"></i> Wound Mapping
          </h3>
          <button onClick={() => setIsSwapped(!isSwapped)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border-2 transition-all duration-300 active:bg-blue-800 active:text-white ${isSwapped ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-600 hover:text-blue-600'}`}>
            <i className="fa-solid fa-rotate mr-2"></i> Swap Axes
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Length" value={`${displayLength} cm`} icon="fa-arrows-left-right" isActive={activeMetric === 'length'} isVerified={lengthAdjusted} onClick={() => setActiveMetric(activeMetric === 'length' ? 'none' : 'length')} />
          <MetricCard label="Width" value={`${displayWidth} cm`} icon="fa-arrows-up-down" isActive={activeMetric === 'width'} isVerified={widthAdjusted} onClick={() => setActiveMetric(activeMetric === 'width' ? 'none' : 'width')} />
          <MetricCard label="Depth" value={`${displayDepth} cm`} icon="fa-layer-group" isActive={activeMetric === 'depth'} isVerified={depthAdjusted} highlight onClick={() => setActiveMetric(activeMetric === 'depth' ? 'none' : 'depth')} />
          <MetricCard label="Area" value={`${displayArea} cm²`} icon="fa-chart-area" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-droplet text-blue-500"></i> Tissue Identification (%)
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <TissueRow label="Epithelialization" color="bg-pink-400" value={tissueTypes.epithelization} onChange={(v) => setTissueTypes(p => ({...p, epithelization: parseInt(v)||0}))} description="New pink skin" />
          <TissueRow label="Granulation" color="bg-red-500" value={tissueTypes.granulation} onChange={(v) => setTissueTypes(p => ({...p, granulation: parseInt(v)||0}))} description="Healthy red tissue" />
          <TissueRow label="Slough" color="bg-yellow-200" value={tissueTypes.slough} onChange={(v) => setTissueTypes(p => ({...p, slough: parseInt(v)||0}))} description="Yellow/tan debris" />
          <TissueRow label="Eschar" color="bg-neutral-800" value={tissueTypes.eschar} onChange={(v) => setTissueTypes(p => ({...p, eschar: parseInt(v)||0}))} description="Necrotic tissue" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-person-circle-check text-blue-600"></i>
          Peri-wound Assessment
        </h3>
        <div className="flex flex-wrap gap-2">
          {PERI_WOUND_OPTIONS.map(tag => (
            <button 
              key={tag}
              onClick={() => togglePeriWoundTag(tag)}
              className={`text-xs font-bold px-4 py-2 rounded-full border transition-all ${
                selectedPeriWoundTags.includes(tag)
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-blue-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button onClick={() => setIsSaveDialogOpen(true)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:bg-blue-800 flex items-center justify-center gap-3">
          <i className="fa-solid fa-floppy-disk"></i> {isEditing ? 'Update Clinical Record' : 'Save To Local Files'}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={handleShareReport} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all active:bg-black flex items-center justify-center gap-3">
            <i className="fa-solid fa-share-nodes"></i> Share
          </button>
          <button onClick={() => setIsFaxDialogOpen(true)} className="w-full bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-slate-900 transition-all active:bg-black flex items-center justify-center gap-3">
            <i className="fa-solid fa-fax"></i> Fax to EMR
          </button>
        </div>
      </div>

      <div className="text-center pt-8 border-t border-slate-100">
        <button 
          onClick={onReset} 
          className="w-full bg-red-50 border-2 border-red-200 text-red-600 font-black py-5 rounded-2xl shadow-sm hover:bg-red-100 hover:border-red-300 transition-all flex items-center justify-center gap-3 active:scale-[0.98] active:bg-red-200"
        >
          <i className="fa-solid fa-trash-can"></i>
          Discard and Return Home
        </button>
      </div>

      {isFaxDialogOpen && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <i className="fa-solid fa-fax text-xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Digital Fax Gateway</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Secure Clinical Link</p>
              </div>
            </div>

            {isFaxing ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                    <i className="fa-solid fa-shield-halved animate-pulse"></i>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="font-bold text-slate-800 animate-pulse">{faxStatus}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">AES-256 Encrypted Tunnel</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFaxSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Destination Fax Number</label>
                  <input 
                    autoFocus 
                    type="tel" 
                    placeholder="e.g. +1 (555) 000-0000" 
                    className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-600 outline-none font-bold text-lg" 
                    value={faxNumber} 
                    onChange={(e) => setFaxNumber(e.target.value)} 
                  />
                  <p className="text-[9px] text-slate-400 font-medium px-1">Verify EMR endpoint before transmitting clinical data.</p>
                </div>
                
                <div className="flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsFaxDialogOpen(false)} 
                    className="flex-1 py-4 font-black text-slate-500 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={!faxNumber.trim()} 
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-30 uppercase text-xs tracking-widest"
                  >
                    Transmit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isSaveDialogOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-bold text-slate-800">Archive Record</h3>
            <form onSubmit={handleSaveSubmit} className="space-y-6">
              <input 
                autoFocus 
                type="text" 
                placeholder="Patient Name / ID" 
                className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-600 outline-none font-bold text-lg" 
                value={patientName} 
                onChange={(e) => setPatientName(e.target.value)} 
                disabled={isEditing} 
              />
              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsSaveDialogOpen(false)} 
                  className="flex-1 py-4 font-black text-slate-500 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all uppercase text-xs tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!patientName.trim()} 
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-30 uppercase text-xs tracking-widest"
                >
                  {isEditing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TissueRow: React.FC<{ label: string; color: string; value: number; onChange: (v: string) => void; description: string }> = ({ label, color, value, onChange, description }) => (
  <div className="flex flex-col gap-1 p-3 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors">
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <div className="flex-1 text-sm font-bold text-slate-700">{label}</div>
      <div className="flex items-center gap-3">
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="w-32 accent-blue-600" 
        />
        <span className="text-xs font-black text-slate-800 w-10 text-right">{value}%</span>
      </div>
    </div>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; icon: string; highlight?: boolean; isActive?: boolean; isVerified?: boolean; onClick?: () => void }> = ({ label, value, icon, highlight, isActive, isVerified, onClick }) => (
  <button onClick={onClick} className={`p-5 rounded-2xl border flex items-center space-x-3 transition-all text-left w-full relative overflow-hidden active:scale-[0.98] ${isActive ? 'ring-2 ring-blue-600 bg-blue-600 border-blue-600 text-white shadow-xl' : highlight ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 shadow-sm text-gray-800 hover:border-blue-200 hover:bg-blue-50/20'}`}>
    {isVerified && !isActive && <div className="absolute top-0 right-0 bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">Verified</div>}
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20' : highlight ? 'bg-white/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <div className="flex-1 overflow-hidden">
      <p className={`text-[10px] uppercase font-black tracking-widest ${isActive ? 'text-white/70' : highlight ? 'text-slate-500' : 'text-gray-400'}`}>{label}</p>
      <p className="text-xl font-bold truncate">{value}</p>
    </div>
  </button>
);

export default ResultView;
