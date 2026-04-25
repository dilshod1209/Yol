
import React, { useState } from 'react';
import { User, Report, ReportStatus, Severity } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../src/lib/LanguageContext';

interface UserProfileProps {
  user: User;
  userReports: Report[];
  onDelete: (id: string) => void;
  onSubmit: (id: string, address?: string) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, userReports, onDelete, onSubmit }) => {
  const { t } = useLanguage();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [reportToSubmit, setReportToSubmit] = useState<Report | null>(null);
  const [submissionAddress, setSubmissionAddress] = useState('');
  
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case ReportStatus.FIXED: return 'bg-emerald-100 text-emerald-700';
      case ReportStatus.REJECTED: return 'bg-red-100 text-red-700';
      case ReportStatus.IN_REPAIR: return 'bg-blue-100 text-blue-700';
      case ReportStatus.UNDER_REVIEW: return 'bg-amber-100 text-amber-700';
      case ReportStatus.SUBMITTED: return 'bg-indigo-100 text-indigo-700';
      case ReportStatus.DRAFT: return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const filteredReports = userReports.filter(r => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesDate = !dateFilter || new Date(r.timestamp).toISOString().split('T')[0] === dateFilter;
    return matchesStatus && matchesDate;
  });

  const categories = [
    { 
      id: 'drafts',
      title: 'Tahlil natijalari', 
      icon: 'fa-microchip',
      color: 'amber',
      reports: filteredReports.filter(r => r.status === ReportStatus.DRAFT) 
    },
    { 
      id: 'submitted',
      title: 'Yuborilganlar', 
      icon: 'fa-paper-plane',
      color: 'blue',
      reports: filteredReports.filter(r => r.status !== ReportStatus.DRAFT) 
    },
    { 
      id: 'critical',
      title: 'Kritik holatlar', 
      icon: 'fa-triangle-exclamation',
      color: 'red',
      reports: filteredReports.filter(r => r.analysis.severity === Severity.HIGH || r.analysis.severity === Severity.MEDIUM) 
    }
  ];

  const [activeCategory, setActiveCategory] = useState(categories[0].id);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  const deleteReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Haqiqatdan ham ushbu hisobotni o'chirmoqchimisiz?")) {
      onDelete(id);
    }
  };

  const handleDeleteConfirm = () => {
    if (reportToDelete) {
      onDelete(reportToDelete);
      setReportToDelete(null);
    }
  };

  const handleSubmitWithAddress = () => {
    if (isBatchSubmitting) {
      const drafts = filteredReports.filter(r => r.status === ReportStatus.DRAFT);
      drafts.forEach(r => onSubmit(r.id, submissionAddress));
      setIsBatchSubmitting(false);
      setSubmissionAddress('');
      return;
    }
    if (reportToSubmit) {
      onSubmit(reportToSubmit.id, submissionAddress);
      setReportToSubmit(null);
      setSubmissionAddress('');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 px-4 max-w-6xl mx-auto">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center relative group overflow-hidden">
            <i className="fas fa-user-astronaut text-7xl text-slate-200"></i>
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-all duration-500"></div>
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-5xl font-black text-slate-900 tracking-tight mb-4">{user.firstName} {user.lastName}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <i className="fas fa-envelope text-xs"></i>
                </div>
                <p className="text-slate-900 font-bold text-xs">{user.email}</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <i className="fas fa-location-dot text-xs"></i>
                </div>
                <p className="text-slate-900 font-bold text-xs">{user.region}, {user.district}</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <i className="fas fa-fingerprint text-xs"></i>
                </div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">ID: <span className="text-slate-900 font-mono ml-1">{user.id.slice(0, 8)}...</span></p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
                  <i className="fas fa-user text-xs"></i>
                </div>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200">
                  {user.role}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 border-t border-slate-100 pt-8">
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 text-[10px]">
                    <i className="fas fa-check"></i>
                  </div>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Yaxshi holat</span>
                </div>
                <span className="text-sm font-black text-emerald-700">
                  {userReports.filter(r => r.analysis.health === 'excellent' || r.analysis.health === 'good').length}
                </span>
              </div>
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 text-[10px]">
                    <i className="fas fa-triangle-exclamation"></i>
                  </div>
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">O'rtacha holat</span>
                </div>
                <span className="text-sm font-black text-amber-700">
                  {userReports.filter(r => r.analysis.health === 'fair').length}
                </span>
              </div>
              <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 text-[10px]">
                    <i className="fas fa-skull-crossbones"></i>
                  </div>
                  <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Yomon holat</span>
                </div>
                <span className="text-sm font-black text-red-700">
                  {userReports.filter(r => r.analysis.health === 'poor').length}
                </span>
              </div>
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 text-[10px]">
                    <i className="fas fa-chart-simple"></i>
                  </div>
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Jami tahlillar</span>
                </div>
                <span className="text-sm font-black text-blue-700">{userReports.length}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Categories / Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {categories.map((cat, idx) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setActiveCategory(cat.id)}
            className={`p-8 rounded-[2.5rem] border-2 text-left transition-all duration-500 relative group overflow-hidden bg-white ${
              activeCategory === cat.id 
                ? `border-blue-500 shadow-xl shadow-blue-500/10` 
                : 'border-slate-100 hover:border-slate-300'
            }`}
          >
            <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-500`}>
              <i className={`fas ${cat.icon} text-9xl`}></i>
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">{cat.title}</p>
            <div className="flex items-end justify-between">
              <div className="flex items-end space-x-3">
                <p className={`text-5xl font-black ${activeCategory === cat.id ? `text-blue-600` : 'text-slate-900'}`}>
                  {cat.reports.length}
                </p>
                <span className="text-slate-400 text-xs mb-1 font-bold">Hisobotlar</span>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                activeCategory === cat.id ? `bg-blue-600 text-white shadow-lg` : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
              }`}>
                <i className={`fas ${cat.icon} text-lg`}></i>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
          <i className="fas fa-sliders text-blue-600"></i>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrlar:</span>
        </div>
        
        <div className="flex flex-wrap gap-4 flex-1">
          <div className="relative group">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none min-w-[180px]"
            >
              <option value="ALL">Hammasi Holati</option>
              {Object.values(ReportStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[8px]"></i>
          </div>

          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
          />

          {(statusFilter !== 'ALL' || dateFilter) && (
            <button 
              onClick={() => { setStatusFilter('ALL'); setDateFilter(''); }}
              className="px-6 py-3 rounded-2xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
            >
              <i className="fas fa-trash-can"></i>
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* Reports Section */}
      <div className="space-y-12">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeCategory}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className={`w-3 h-10 rounded-full ${
                  activeCategory === 'high' ? 'bg-red-500' : activeCategory === 'fixed' ? 'bg-emerald-500' : 'bg-blue-500'
                }`}></span>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                  {categories.find(c => c.id === activeCategory)?.title} Hisobotlar
                </h3>
              </div>

              {activeCategory === 'drafts' && categories.find(c => c.id === 'drafts')?.reports.length! > 0 && (
                <button 
                  onClick={() => setIsBatchSubmitting(true)}
                  className="px-8 py-4 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 animate-pulse-slow font-sans"
                >
                  <i className="fas fa-layer-group"></i>
                  Barcha qoralama-larni yuborish
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.find(c => c.id === activeCategory)?.reports.length === 0 ? (
                <div className="col-span-full py-24 text-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center space-y-4">
                   <i className="fas fa-folder-open text-6xl text-slate-200"></i>
                   <p className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-400">Ushbu toifada hozircha hisobotlar mavjud emas</p>
                </div>
              ) : (
                categories.find(c => c.id === activeCategory)?.reports.map((r, i) => (
                  <motion.div 
                    key={r.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedReport(r)}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col space-y-6 group hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer overflow-hidden relative"
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center space-x-6">
                        <div className="relative preserve-3d group-hover:rotate-y-12 transition-transform duration-500">
                          <img src={r.image} className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-lg" />
                          <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-xl ${
                            r.analysis.severity === Severity.HIGH ? 'bg-red-500' : 
                            r.analysis.severity === Severity.MEDIUM ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}>
                             <i className={`fas ${
                               r.analysis.severity === Severity.HIGH ? 'fa-skull-crossbones' : 
                               r.analysis.severity === Severity.MEDIUM ? 'fa-triangle-exclamation' : 'fa-check'
                             }`}></i>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">{r.analysis.type}</h4>
                          <div className="flex items-center space-x-3 mb-2">
                             <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getStatusColor(r.status)}`}>
                               {r.status}
                             </div>
                             <span className="text-[10px] text-slate-400 font-bold">{new Date(r.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {r.status === ReportStatus.DRAFT && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setReportToSubmit(r); setSubmissionAddress(r.address || ''); }}
                            className="bg-blue-600 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <i className="fas fa-paper-plane"></i>
                            Admin-ga yuborish
                          </button>
                        )}
                        <button 
                          onClick={(e) => deleteReport(r.id, e)}
                          className="px-4 py-3 rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                          title="Foydalanuvchi hisobotini o'chirish"
                        >
                          <i className="fas fa-trash-can"></i>
                          O'chirish
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex-1">
                       <div className="flex items-center gap-2 mb-2">
                         <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">AI Tahlili:</span>
                         <span className={`text-[9px] font-black uppercase ${
                           r.analysis.severity === Severity.HIGH ? 'text-red-500' : 
                           r.analysis.severity === Severity.MEDIUM ? 'text-amber-500' : 'text-emerald-500'
                         }`}>
                           {r.analysis.severity.toUpperCase()}
                         </span>
                       </div>
                       <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 font-medium italic">{r.analysis.description}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>


      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {reportToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                <i className="fas fa-trash-alt text-3xl"></i>
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{t('common.confirmDelete')}</h3>
              <p className="text-slate-500 text-sm mb-8">Ushbu hisobotni butunlay o'chirib tashlamoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setReportToDelete(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  {t('common.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submission Address Modal */}
      <AnimatePresence>
        {(reportToSubmit || isBatchSubmitting) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 shadow-2xl"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-6">
                <i className="fas fa-paper-plane text-3xl"></i>
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 text-center">
                {isBatchSubmitting ? 'Barchasini yuborish' : 'Adminga yuborish'}
              </h3>
              <p className="text-slate-500 text-sm mb-6 text-center">
                {isBatchSubmitting 
                  ? "Barcha qoralama hisobotlarni yuborish uchun umumiy manzilni kiriting."
                  : "Iltimos, nosozlik joylashgan aniq manzilni kiriting yoki tasdiqlang."}
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="relative">
                  <i className="fas fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                  <input 
                    type="text"
                    placeholder="Manzilni kiriting..."
                    value={submissionAddress}
                    onChange={(e) => setSubmissionAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => { setReportToSubmit(null); setIsBatchSubmitting(false); }}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={handleSubmitWithAddress}
                  disabled={!submissionAddress.trim()}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.send')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed Report Modal */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-64 md:h-96 bg-slate-50">
                <img 
                  src={selectedReport.image} 
                  className="w-full h-full object-cover"
                  alt="Defect"
                />
                {/* Bounding Box Overlay */}
                {selectedReport.analysis.boundingBox && (
                  <div 
                    className="absolute border-4 border-blue-600 shadow-[0_0_0_2px_rgba(255,255,255,0.5)] rounded-sm pointer-events-none"
                    style={{
                      left: `${selectedReport.analysis.boundingBox.x}%`,
                      top: `${selectedReport.analysis.boundingBox.y}%`,
                      width: `${selectedReport.analysis.boundingBox.width}%`,
                      height: `${selectedReport.analysis.boundingBox.height}%`
                    }}
                  >
                    <div className="absolute -top-8 left-0 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-t-md uppercase">
                      {selectedReport.analysis.type}
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-all"
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
                    <p className="text-slate-400 font-bold flex items-center text-sm">
                      <i className="fas fa-location-dot mr-2 text-blue-500"></i>
                      {selectedReport.address || `${selectedReport.location.lat.toFixed(4)}, ${selectedReport.location.lng.toFixed(4)}`}
                    </p>
                  </div>
                    <div className="flex gap-3">
                      {selectedReport.status === ReportStatus.DRAFT && (
                        <button 
                          onClick={() => { 
                            setReportToSubmit(selectedReport); 
                            setSubmissionAddress(selectedReport.address || ''); 
                            setSelectedReport(null); 
                          }}
                          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                        >
                          <i className="fas fa-paper-plane"></i>
                          Yuborish
                        </button>
                      )}
                      <button 
                        onClick={() => { onDelete(selectedReport.id); setSelectedReport(null); }}
                      className="px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-slate-100 flex items-center gap-2"
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
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200/50">
                          <span className="text-xs font-bold text-slate-400">Taxminiy maydon</span>
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

                        <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center">
                          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Umumiy xarajat</span>
                          <span className="text-xl font-black text-blue-600">${selectedReport.analysis.estimatedCost.toLocaleString()}</span>
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
