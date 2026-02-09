
import React, { useState } from 'react';
import { Patient, AssessmentEntry } from '../types';

interface HistoryViewProps {
  patients: Patient[];
  onDeletePatient: (id: string) => void;
  onBack: () => void;
  onEditAssessment: (patient: Patient, entry: AssessmentEntry) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ patients, onDeletePatient, onBack, onEditAssessment }) => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const handleExportAll = () => {
    const dataStr = JSON.stringify(patients, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ArrowWound_Database_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (selectedPatient) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedPatient(null)} className="text-slate-500 p-2 hover:bg-blue-50 rounded-full transition-all active:bg-blue-100">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h2 className="text-2xl font-bold text-slate-800">{selectedPatient.name}</h2>
        </div>

        <div className="space-y-6 pb-24">
          {selectedPatient.assessments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <img src={`data:image/jpeg;base64,${entry.images?.[0]?.base64}`} className="w-20 h-20 rounded-xl object-cover bg-slate-100 border border-slate-200 shadow-sm" alt="Scan" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                    <button onClick={() => onEditAssessment(selectedPatient, entry)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm">
                      <i className="fa-solid fa-pen-to-square mr-1"></i> Open
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-[11px] font-bold text-slate-700">L: {entry.result.lengthCm} cm</p>
                    <p className="text-[11px] font-bold text-slate-700">W: {entry.result.widthCm} cm</p>
                    <p className="text-[11px] font-bold text-slate-700">D: {entry.result.depthCm} cm</p>
                    <p className="text-[11px] font-bold text-slate-700">A: {entry.result.areaCm2} cm²</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Patient Files</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Stored Locally</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportAll} className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all active:scale-90" title="Export JSON">
            <i className="fa-solid fa-file-export"></i>
          </button>
          <button onClick={onBack} className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all active:scale-90">
            <i className="fa-solid fa-house"></i>
          </button>
        </div>
      </div>

      <div className="space-y-4 pb-24">
        {patients.length > 0 ? (
          patients.map((patient) => (
            <div key={patient.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-blue-400 hover:bg-blue-50/10 transition-all cursor-pointer group active:scale-[0.99]" onClick={() => setSelectedPatient(patient)}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                    <i className="fa-solid fa-folder"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{patient.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                      {patient.assessments.length} Record(s) Stored
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete patient ${patient.name}?`)) onDeletePatient(patient.id); }} className="text-slate-200 hover:text-red-500 p-2 transition-colors">
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                  <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-blue-400 transition-all group-hover:translate-x-1"></i>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-32 space-y-6 text-slate-300">
            <i className="fa-solid fa-file-circle-plus text-7xl opacity-20"></i>
            <p className="font-bold uppercase text-xs tracking-widest">No local files found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
