
import React, { useState } from 'react';
import { User, Report, ReportStatus, Severity } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../src/lib/LanguageContext';

interface UserProfileProps {
  user: User;
  userReports: Report[];
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, userReports, onDelete, onSubmit }) => {
  const { t } = useLanguage();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case ReportStatus.FIXED: return 'bg-emerald-500/20 text-emerald-500';
      case ReportStatus.REJECTED: return 'bg-red-500/20 text-red-500';
      case ReportStatus.IN_REPAIR: return 'bg-blue-500/20 text-blue-500';
      case ReportStatus.UNDER_REVIEW: return 'bg-amber-500/20 text-amber-500';
      case ReportStatus.SUBMITTED: return 'bg-indigo-500/20 text-indigo-500';
      case ReportStatus.DRAFT: return 'bg-slate-800 text-slate-400';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 rounded-[2rem] bg-white/10 backdrop-blur-xl border-2 border-white/20 flex items-center justify-center shadow-2xl">
            <i className="fas fa-user-astronaut text-6xl text-white/50"></i>
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-black text-white tracking-tight mb-2">{user.firstName} {user.lastName}</h2>
            <p className="text-blue-50 font-medium mb-1"><i className="fas fa-envelope mr-2 opacity-60"></i>{user.email}</p>
            <p className="text-blue-50 font-medium mb-4"><i className="fas fa-location-dot mr-2 opacity-60"></i>{user.region}, {user.district}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <span className="px-4 py-1.5 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/10">
                <i className={`fas ${user.role === 'ADMIN' ? 'fa-user-shield' : 'fa-user'} mr-2`}></i>
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-blue-500/30 transition-all group shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">{t('common.submitted')}</p>
          <div className="flex items-end space-x-3">
             <p className="text-4xl font-black text-slate-900">{userReports.filter(r => r.status !== ReportStatus.DRAFT).length}</p>
             <span className="text-slate-400 text-xs mb-1 font-bold">{t('common.reports')}</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-red-500/30 transition-all group shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">{t('common.highRisk')}</p>
          <div className="flex items-end space-x-3">
             <p className="text-4xl font-black text-red-500">{userReports.filter(r => r.analysis.severity === Severity.HIGH).length}</p>
             <span className="text-slate-400 text-xs mb-1 font-bold">{t('common.high')}</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-emerald-500/30 transition-all group shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">{t('common.fixed')}</p>
          <div className="flex items-end space-x-3">
             <p className="text-4xl font-black text-emerald-500">{userReports.filter(r => r.status === ReportStatus.FIXED).length}</p>
             <span className="text-slate-400 text-xs mb-1 font-bold">{t('common.fixed')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <i className="fas fa-layer-group text-blue-600"></i>
          {t('common.reports')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userReports.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-200">
               <i className="fas fa-layer-group text-4xl mb-4 opacity-10"></i>
               <p className="font-bold text-xs uppercase">{t('common.noDefects')}</p>
            </div>
          ) : (
            userReports.map(r => (
              <div 
                key={r.id} 
                onClick={() => setSelectedReport(r)}
                className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col space-y-4 group hover:border-blue-500/30 transition-all shadow-sm cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-5">
                    <div className="relative">
                      <img src={r.image} className="w-16 h-16 rounded-2xl object-cover border border-slate-100" />
                      <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-lg ${r.status === ReportStatus.DRAFT ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                         <i className={`fas ${r.status === ReportStatus.DRAFT ? 'fa-pencil' : 'fa-check-double'}`}></i>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{r.analysis.type}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(r.timestamp).toLocaleString()}</p>
                      <div className="flex space-x-2 mt-1">
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${getStatusColor(r.status)}`}>
                          {r.status}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {r.status === ReportStatus.DRAFT && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSubmit(r.id); }}
                        className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white hover:bg-emerald-500 transition-all shadow-lg"
                        title={t('common.send')}
                      >
                        <i className="fas fa-paper-plane"></i>
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                      className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-500 hover:text-white transition-all shadow-inner"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">{r.analysis.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detailed Report Modal */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-64 md:h-96 bg-slate-100">
                <img 
                  src={selectedReport.image} 
                  className="w-full h-full object-cover"
                  alt="Defect"
                />
                {/* Bounding Box Overlay */}
                {selectedReport.analysis.boundingBox && (
                  <div 
                    className="absolute border-4 border-red-500 shadow-[0_0_0_2px_rgba(255,255,255,0.5)] rounded-sm pointer-events-none"
                    style={{
                      left: `${selectedReport.analysis.boundingBox.x}%`,
                      top: `${selectedReport.analysis.boundingBox.y}%`,
                      width: `${selectedReport.analysis.boundingBox.width}%`,
                      height: `${selectedReport.analysis.boundingBox.height}%`
                    }}
                  >
                    <div className="absolute -top-8 left-0 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-t-md uppercase">
                      {selectedReport.analysis.type}
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-all"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                        {selectedReport.analysis.type}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(selectedReport.status)}`}>
                        {selectedReport.status}
                      </span>
                    </div>
                    <p className="text-slate-400 font-bold flex items-center">
                      <i className="fas fa-location-dot mr-2"></i>
                      {selectedReport.address || `${selectedReport.location.lat.toFixed(4)}, ${selectedReport.location.lng.toFixed(4)}`}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {selectedReport.status === ReportStatus.DRAFT && (
                      <button 
                        onClick={() => { onSubmit(selectedReport.id); setSelectedReport(null); }}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg flex items-center gap-2"
                      >
                        <i className="fas fa-paper-plane"></i>
                        Yuborish
                      </button>
                    )}
                    <button 
                      onClick={() => { onDelete(selectedReport.id); setSelectedReport(null); }}
                      className="px-6 py-3 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-inner flex items-center gap-2"
                    >
                      <i className="fas fa-trash-alt"></i>
                      O'chirish
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tavsif</h4>
                      <p className="text-slate-600 leading-relaxed text-sm">{selectedReport.analysis.description}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tavsiya</h4>
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-blue-700 text-sm font-medium">{selectedReport.analysis.recommendation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Iqtisodiy hisob-kitob</h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-4 border-bottom border-slate-200">
                          <span className="text-xs font-bold text-slate-500">Taxminiy maydon</span>
                          <span className="text-sm font-black text-slate-900">{selectedReport.analysis.estimatedArea} m²</span>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kerakli materiallar</p>
                          {selectedReport.analysis.materials?.map((m, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2">
                              <span className="text-xs font-medium text-slate-600">{m.name} ({m.amount} {m.unit})</span>
                              <span className="text-xs font-black text-slate-900">${m.cost.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Umumiy xarajat</span>
                          <span className="text-xl font-black text-emerald-600">${selectedReport.analysis.estimatedCost.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfile;
