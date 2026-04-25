
import React, { useState, useMemo } from 'react';
import { Report, ReportStatus, User, Severity, RoadHealth, DefectType, UserRole, LocationData, Notification as AppNotification } from '../types';
import MapDisplay from './MapDisplay';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../src/lib/LanguageContext';
import { auth, db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { analyzeRoadIssue } from '../geminiService';
import { DistrictDashboard } from './DistrictDashboard';

interface AdminPanelProps {
  allReports: Report[];
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: ReportStatus) => void;
  users: User[];
  onToggleBlock: (userId: string, isBlocked: boolean) => void;
  onDeleteUser: (userId: string) => void;
  onSendGlobalNotification: (title: string, message: string) => Promise<void>;
  currentLocation: LocationData | null;
  notifications: AppNotification[];
  currentUser: User | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  allReports, 
  onDelete, 
  onUpdateStatus, 
  users, 
  onToggleBlock, 
  onDeleteUser,
  onSendGlobalNotification,
  currentLocation,
  notifications,
  currentUser
}) => {
  const { t } = useLanguage();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [globalNotification, setGlobalNotification] = useState({ title: '', message: '' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    setUploadSuccess(false);
    try {
      // 1. Convert to base64 for Gemini
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64Image = await base64Promise;

      // 2. Analyze with Gemini
      const analysis = await analyzeRoadIssue(base64Image, 'manual');

      // 3. Upload to Storage
      const uid = auth.currentUser?.uid || currentUser.id;
      const storageRef = ref(storage, `reports/${uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);

      // 4. Save to Firestore
      await addDoc(collection(db, 'reports'), {
        userId: uid,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        type: analysis.type,
        severity: analysis.severity,
        health: analysis.health,
        description: manualDescription || analysis.description,
        recommendation: analysis.recommendation,
        imageUrl,
        location: manualLocation,
        region: manualLocation.split(',').pop()?.trim() || 'Toshkent',
        status: ReportStatus.SUBMITTED,
        createdAt: serverTimestamp(),
        timestamp: Date.now(),
        analysis: {
          ...analysis,
          infrastructure: analysis.infrastructure,
          predictiveData: analysis.predictiveData
        },
        lat: currentLocation?.lat || 41.2995,
        lng: currentLocation?.lng || 69.2401
      });

      setUploadSuccess(true);
      setManualLocation('');
      setManualDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Upload error:", error);
      alert(t('common.errorOccurred'));
    } finally {
      setIsUploading(false);
    }
  };

  const statusTranslationKeys: Record<string, string> = {
    [ReportStatus.DRAFT]: 'draft',
    [ReportStatus.SUBMITTED]: 'submitted',
    [ReportStatus.UNDER_REVIEW]: 'underReview',
    [ReportStatus.IN_REPAIR]: 'inRepair',
    [ReportStatus.FIXED]: 'fixed',
    [ReportStatus.REJECTED]: 'rejected',
  };

  const severityTranslationKeys: Record<string, string> = {
    [Severity.LOW]: 'low',
    [Severity.MEDIUM]: 'medium',
    [Severity.HIGH]: 'high',
    [Severity.NONE]: 'none',
  };

  const defectTypeTranslationKeys: Record<string, string> = {
    [DefectType.POTHOLE]: 'pothole',
    [DefectType.CRACK]: 'crack',
    [DefectType.RUTTING]: 'rutting',
    [DefectType.EROSION]: 'erosion',
    [DefectType.OBSTACLE]: 'obstacle',
    [DefectType.FADED_MARKINGS]: 'fadedMarkings',
    [DefectType.LIGHTING_ISSUE]: 'lightingIssue',
    [DefectType.DRAINAGE_ISSUE]: 'drainageIssue',
    [DefectType.PEDESTRIAN_PATH]: 'pedestrianPath',
    [DefectType.VEGETATION_DUST]: 'vegetationDust',
    [DefectType.SMOOTH]: 'smooth',
    [DefectType.UNKNOWN]: 'unknown',
  };

  const roadHealthTranslationKeys: Record<string, string> = {
    [RoadHealth.EXCELLENT]: 'excellent',
    [RoadHealth.GOOD]: 'good',
    [RoadHealth.FAIR]: 'fair',
    [RoadHealth.POOR]: 'poor',
  };

  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'analytics' | 'notifications'>('reports');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [reportFilter, setReportFilter] = useState<{ status: string; severity: string; region: string; search: string }>({
    status: 'all',
    severity: 'all',
    region: 'all',
    search: ''
  });
  const [userSearch, setUserSearch] = useState('');

  const viewOnMap = (report: Report) => {
    setSelectedRegion(report.region || null);
    setMapCenter(report.location);
    setActiveTab('regions');
    setSelectedReport(null);
  };
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const filteredReports = allReports.filter(r => r.status !== ReportStatus.DRAFT);
  
  const displayReports = useMemo(() => {
    return filteredReports.filter(r => {
      const matchStatus = reportFilter.status === 'all' || r.status === reportFilter.status;
      const matchSeverity = reportFilter.severity === 'all' || r.analysis.severity === reportFilter.severity;
      const matchRegion = reportFilter.region === 'all' || r.region === reportFilter.region;
      const matchSearch = !reportFilter.search || 
        r.userName.toLowerCase().includes(reportFilter.search.toLowerCase()) ||
        r.analysis.type.toLowerCase().includes(reportFilter.search.toLowerCase()) ||
        r.analysis.description.toLowerCase().includes(reportFilter.search.toLowerCase());
      return matchStatus && matchSeverity && matchRegion && matchSearch;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredReports, reportFilter]);

  const sortedReports = [...filteredReports].sort((a, b) => b.timestamp - a.timestamp);
  
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.lastName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone.includes(userSearch)
    );
  }, [users, userSearch]);

  const recentReports = sortedReports.slice(0, 6);

  const stats = useMemo(() => {
    const totalReports = filteredReports.length;
    const fixedReports = filteredReports.filter(r => r.status === ReportStatus.FIXED).length;
    const highRisk = filteredReports.filter(r => r.analysis.severity === Severity.HIGH).length;

    // Infrastructure metrics
    const signageAvg = filteredReports.filter(r => r.analysis.infrastructure?.markingsVisible).length / (totalReports || 1) * 100;
    const lightingAvg = filteredReports.filter(r => r.analysis.infrastructure?.lightingFunctional).length / (totalReports || 1) * 100;
    const drainageAvg = filteredReports.filter(r => r.analysis.infrastructure?.drainageClear).length / (totalReports || 1) * 100;
    
    const regionMap: Record<string, number> = {};
    filteredReports.forEach(r => {
      const reg = r.region || 'Noma\'lum';
      regionMap[reg] = (regionMap[reg] || 0) + 1;
    });
    
    const regionStats = Object.entries(regionMap)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate average repair time
    const fixedWithTime = filteredReports.filter(r => r.status === ReportStatus.FIXED && r.fixedAt && r.timestamp);
    const avgRepairTime = fixedWithTime.length > 0
      ? fixedWithTime.reduce((acc, r) => acc + ((r.fixedAt! - r.timestamp) / (1000 * 60 * 60)), 0) / fixedWithTime.length
      : 0;
    
    return { totalReports, fixedReports, highRisk, regionStats, avgRepairTime, totalUsers: users.length, signageAvg, lightingAvg, drainageAvg };
  }, [filteredReports, users]);

  const predictiveInsights = useMemo(() => {
    const criticalRoads = filteredReports.filter(r => r.analysis.predictiveData?.deteriorationRisk === 'high' || (r.analysis.predictiveData?.monthsToFailure || 10) < 3);
    const avgFailureMonths = filteredReports.reduce((acc, r) => acc + (r.analysis.predictiveData?.monthsToFailure || 12), 0) / (filteredReports.length || 1);
    return { criticalRoads, avgFailureMonths };
  }, [filteredReports]);

  const monthlyReportData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return filteredReports.filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [filteredReports]);

  const exportMonthlyReport = () => {
    const data = monthlyReportData.map(r => ({
      ID: r.id,
      Foydalanuvchi: r.userName,
      Turi: r.analysis.type,
      Holati: r.status,
      Viloyat: r.region,
      Sana: new Date(r.timestamp).toLocaleString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
    XLSX.writeFile(wb, `monthly_road_report_${new Date().getMonth() + 1}_${new Date().getFullYear()}.xlsx`);
  };

  const analyticsData = useMemo(() => {
    const statusCounts = {
      [ReportStatus.SUBMITTED]: 0,
      [ReportStatus.UNDER_REVIEW]: 0,
      [ReportStatus.IN_REPAIR]: 0,
      [ReportStatus.FIXED]: 0,
      [ReportStatus.REJECTED]: 0,
    };
    
    filteredReports.forEach(r => {
      if (statusCounts[r.status] !== undefined) {
        statusCounts[r.status]++;
      }
    });

    return Object.entries(statusCounts).map(([name, value]) => ({ 
      name: t(`common.${statusTranslationKeys[name]}`), 
      value 
    }));
  }, [filteredReports]);

  const severityData = useMemo(() => {
    const counts = { [Severity.LOW]: 0, [Severity.MEDIUM]: 0, [Severity.HIGH]: 0 };
    filteredReports.forEach(r => {
      counts[r.analysis.severity]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ 
      name: t(`common.${severityTranslationKeys[name]}`), 
      value 
    }));
  }, [filteredReports]);

  const COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444'];
  const SEVERITY_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(t('common.roadReport'), 20, 20);
    doc.setFontSize(12);
    doc.text(`${t('common.date')}: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`${t('common.totalMessages')}: ${filteredReports.length}`, 20, 40);
    
    let y = 60;
    filteredReports.slice(0, 15).forEach((r, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${i+1}. ${t(`common.${defectTypeTranslationKeys[r.analysis.type]}`)} - ${t(`common.${statusTranslationKeys[r.status]}`)} (${r.region || t('common.unknownRegion')})`, 20, y);
      y += 10;
    });
    
    doc.save(`road_report_${Date.now()}.pdf`);
  };

  const exportToExcel = () => {
    const data = filteredReports.map(r => ({
      ID: r.id,
      [t('common.name')]: r.userName,
      [t('common.type')]: t(`common.${defectTypeTranslationKeys[r.analysis.type]}`),
      [t('common.status')]: t(`common.${statusTranslationKeys[r.status]}`),
      [t('common.region')]: r.region || t('common.unknownRegion'),
      [t('common.estimatedCost')]: r.analysis.estimatedCost,
      [t('common.repairTime')]: r.analysis.estimatedTime,
      [t('common.date')]: new Date(r.timestamp).toLocaleString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, `road_reports_${Date.now()}.xlsx`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'reports':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
               <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 bg-white/[0.02]">
                  <div>
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Ma'lumotlar Bazasi</h3>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Sinxronlangan hisobotlar oqimi</p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                     <div className="relative group">
                       <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500"></i>
                       <input 
                         type="text" 
                         placeholder="Qidiruv..." 
                         value={reportFilter.search}
                         onChange={(e) => setReportFilter({...reportFilter, search: e.target.value})}
                         className="bg-[#05070a] border border-white/10 rounded-xl pl-12 pr-6 py-3 text-xs text-white focus:border-blue-500 outline-none transition-all w-64 shadow-inner"
                       />
                     </div>
                     <select 
                       value={reportFilter.status}
                       onChange={(e) => setReportFilter({...reportFilter, status: e.target.value})}
                       className="bg-[#05070a] border border-white/10 rounded-xl px-6 py-3 text-[10px] font-black uppercase text-slate-400 focus:border-blue-500 outline-none transition-all cursor-pointer hover:bg-white/[0.02]"
                     >
                        <option value="all">Holat</option>
                        {Object.values(ReportStatus).map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  </div>
               </div>

               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-white/[0.01] text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                           <th className="px-8 py-6">ID / Sana</th>
                           <th className="px-8 py-6">Muammo Turi</th>
                           <th className="px-8 py-6">Hudud</th>
                           <th className="px-8 py-6">Holat</th>
                           <th className="px-8 py-6 text-right">Amallar</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {displayReports.map(report => (
                          <motion.tr 
                            key={report.id} 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group hover:bg-white/[0.01] transition-colors cursor-pointer"
                            onClick={() => setSelectedReport(report)}
                          >
                             <td className="px-8 py-6">
                                <p className="text-[10px] font-mono text-blue-500 mb-1">#{report.id.slice(0, 8)}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(report.timestamp).toLocaleDateString()}</p>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-16 h-10 rounded-lg overflow-hidden border border-white/5 shadow-lg group-hover:scale-105 transition-transform">
                                      <img src={report.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest mb-1">{t(`common.${defectTypeTranslationKeys[report.analysis.type]}`)}</p>
                                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${report.analysis.severity === Severity.HIGH ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {report.analysis.severity}
                                      </span>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{report.region}</p>
                                <p className="text-[9px] text-slate-600 truncate max-w-[150px]">{report.address}</p>
                             </td>
                             <td className="px-8 py-6">
                                <select 
                                  value={report.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => onUpdateStatus(report.id, e.target.value as any)}
                                  className="bg-transparent text-[9px] font-black uppercase text-blue-500 outline-none cursor-pointer hover:underline"
                                >
                                   {Object.values(ReportStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button className="w-8 h-8 rounded-lg bg-white/5 text-slate-600 hover:text-white transition-all"><i className="fas fa-expand-alt text-[10px]"></i></button>
                             </td>
                          </motion.tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="animate-fade-in space-y-8">
            <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
               <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight uppercase">Tizim Foydalanuvchilari</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Barcha darajadagi operatorlar nazorati</p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Qidirish (ism, tel, email)..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-[#05070a] border border-white/10 rounded-xl px-6 py-3 text-xs text-white focus:border-blue-500 outline-none transition-all w-80 shadow-inner"
                  />
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 bg-white/[0.01]">
                           <th className="px-8 py-6">Operator</th>
                           <th className="px-8 py-6">Roli / Aloqa</th>
                           <th className="px-8 py-6">Hudud nazorati</th>
                           <th className="px-8 py-6 text-right">Boshqaruv</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {filteredUsers.map(user => (
                          <tr key={user.id} className="group hover:bg-white/[0.01] transition-colors">
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center font-black text-blue-500 border border-blue-500/20 group-hover:scale-110 transition-transform shadow-inner">{user.firstName[0]}{user.lastName[0]}</div>
                                   <div>
                                      <p className="text-sm font-black text-white">{user.firstName} {user.lastName}</p>
                                      <p className="text-[10px] text-slate-500 font-mono tracking-tighter">{user.email}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex flex-col gap-1">
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit ${user.role === UserRole.ADMIN ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>{user.role}</span>
                                  <p className="text-xs font-black text-slate-400">{user.phone}</p>
                                </div>
                             </td>
                             <td className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">{user.region || 'Barcha hududlar'}</td>
                             <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                      onClick={() => onToggleBlock(user.id, !user.isBlocked)} 
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${user.isBlocked ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`}
                                      title={user.isBlocked ? 'Blokdan ochish' : 'Bloklash'}
                                   >
                                      <i className={`fas ${user.isBlocked ? 'fa-lock-open' : 'fa-lock'}`}></i>
                                   </button>
                                   <button onClick={() => onDeleteUser(user.id)} className="w-10 h-10 bg-white/5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl flex items-center justify-center transition-all" title="Foydalanuvchini o'chirish"><i className="fas fa-user-xmark"></i></button>
                                </div>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="animate-fade-in space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[450px]">
                <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[3rem] shadow-2xl backdrop-blur-md">
                   <h4 className="text-xs font-black text-white uppercase tracking-widest mb-12 flex items-center gap-3">
                     <i className="fas fa-chart-donut text-blue-500"></i>
                     Muammolar Segmenti
                   </h4>
                   <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={analyticsData} dataKey="value" innerRadius={80} outerRadius={120} paddingAngle={12}>
                               {analyticsData.map((e, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.05)" />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#0a0f18', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                </div>
                <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[3rem] shadow-2xl backdrop-blur-md">
                   <h4 className="text-xs font-black text-white uppercase tracking-widest mb-12 flex items-center gap-3">
                     <i className="fas fa-chart-bar text-emerald-500"></i>
                     Hududiy Distribyutsiya
                   </h4>
                   <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={stats.regionStats}>
                            <CartesianGrid strokeDasharray="5 5" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="region" stroke="#475569" fontSize={8} tick={{ fontWeight: 'bold' }} tickFormatter={(val) => val.slice(0, 5)} />
                            <YAxis stroke="#475569" fontSize={8} />
                            <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ background: '#0a0f18', border: '1px solid #1e293b', borderRadius: '16px' }} />
                            <Bar dataKey="count" fill="#3b82f6" radius={[6,6,0,0]}>
                               {stats.regionStats.map((entry: any, index: number) => (
                                 <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#1e293b'} />
                               ))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="max-w-2xl mx-auto p-12 bg-slate-900/40 border border-white/5 rounded-[3rem] shadow-2xl backdrop-blur-md animate-fade-in text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-blue-600/10 text-blue-500 rounded-[2.5rem] flex items-center justify-center text-4xl mb-8 shadow-inner border border-blue-500/20 rotate-12 transition-transform hover:rotate-0 duration-500"><i className="fas fa-paper-plane"></i></div>
             <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Global Bildirishnoma</h3>
             <p className="text-slate-500 text-sm font-medium mb-12 max-w-sm">Barcha foydalanuvchilar ekraniga real vaqtda xabar yuborish</p>
             
             <div className="space-y-6 w-full">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 pl-4">Sarlavha</label>
                  <input 
                    type="text" 
                    value={globalNotification.title} 
                    onChange={e => setGlobalNotification({...globalNotification, title: e.target.value})} 
                    className="w-full bg-[#05070a]/50 border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner" 
                    placeholder="Masalan: Tizim yangilanishi" 
                  />
                </div>
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 pl-4">Xabar matni</label>
                  <textarea 
                    rows={5} 
                    value={globalNotification.message} 
                    onChange={e => setGlobalNotification({...globalNotification, message: e.target.value})} 
                    className="w-full bg-[#05070a]/50 border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-blue-500 outline-none resize-none transition-all shadow-inner" 
                    placeholder="Foydalanuvchilarga yetkazilishi kerak bo'lgan xabar..." 
                  />
                </div>
                <button 
                  onClick={() => { if(globalNotification.title && globalNotification.message) { onSendGlobalNotification(globalNotification.title, globalNotification.message); setGlobalNotification({title:'', message:''}); alert("Xabar yuborildi!"); } }} 
                  className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/30 active:scale-[0.98] mt-8"
                >
                  Barcha foydalanuvchilarga yuborish
                </button>
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {selectedReport && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="md:w-1/2 relative h-64 md:h-auto">
                <img src={selectedReport.image} className="w-full h-full object-cover" />
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white shadow-xl">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${selectedReport.analysis.severity === Severity.HIGH ? 'text-red-600' : 'text-blue-600'}`}>
                    {t(`common.${severityTranslationKeys[selectedReport.analysis.severity]}`)} {t('common.risk')}
                  </span>
                </div>
                {selectedReport.analysis.boundingBox && (
                  <div 
                    className="absolute border-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                    style={{
                      left: `${selectedReport.analysis.boundingBox.x / 10}%`,
                      top: `${selectedReport.analysis.boundingBox.y / 10}%`,
                      width: `${selectedReport.analysis.boundingBox.width / 10}%`,
                      height: `${selectedReport.analysis.boundingBox.height / 10}%`,
                    }}
                  ></div>
                )}
              </div>
              <div className="md:w-1/2 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">{t(`common.${defectTypeTranslationKeys[selectedReport.analysis.type]}`)}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ID: {selectedReport.id.slice(0, 8)}</p>
                  </div>
                  <button onClick={() => setSelectedReport(null)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                    <i className="fas fa-times text-xl"></i>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{t('common.regions')}</p>
                    <p className="text-[10px] font-bold text-slate-900">{selectedReport.region}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{t('common.date')}</p>
                    <p className="text-[10px] font-bold text-slate-900">{new Date(selectedReport.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('common.analytics')}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{selectedReport.analysis.description}</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Tavsiya</h4>
                    <p className="text-sm text-blue-600 font-bold italic">"{selectedReport.analysis.recommendation}"</p>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Infratuzilma Holati (AI Tahlili)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
                      <i className={`fas fa-lightbulb ${selectedReport.analysis.infrastructure?.lightingFunctional ? 'text-emerald-500' : 'text-red-500'}`}></i>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Yoritish</p>
                        <p className="text-[10px] font-bold text-slate-900">{selectedReport.analysis.infrastructure?.lightingFunctional ? 'Ishchi' : 'Nosoz'}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
                      <i className={`fas fa-water ${selectedReport.analysis.infrastructure?.drainageClear ? 'text-emerald-500' : 'text-red-500'}`}></i>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Drenaj</p>
                        <p className="text-[10px] font-bold text-slate-900">{selectedReport.analysis.infrastructure?.drainageClear ? 'Toza' : 'To\'lgan'}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
                      <i className={`fas fa-lines-leaning ${selectedReport.analysis.infrastructure?.markingsVisible ? 'text-emerald-500' : 'text-red-500'}`}></i>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Chiziqlar</p>
                        <p className="text-[10px] font-bold text-slate-900">{selectedReport.analysis.infrastructure?.markingsVisible ? 'Aniq' : 'O\'chgan'}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
                      <i className={`fas fa-walking ${selectedReport.analysis.infrastructure?.pedestrianSafety === 'high' ? 'text-emerald-500' : 'text-amber-500'}`}></i>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Piyoda xavfsizligi</p>
                        <p className="text-[10px] font-bold text-slate-900 uppercase">{selectedReport.analysis.infrastructure?.pedestrianSafety}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Iqtisodiy Hisob-kitob (Taxminiy)</h4>
                  <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-100/50">
                        <tr className="font-black uppercase tracking-widest text-slate-400">
                          <th className="px-4 py-3">Material</th>
                          <th className="px-4 py-3">Miqdor</th>
                          <th className="px-4 py-3 text-right">Narx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedReport.analysis.materials?.map((m, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3 font-bold text-slate-700">{m.name}</td>
                            <td className="px-4 py-3 text-slate-500">{m.amount}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{m.cost.toLocaleString()} so'm</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50/50">
                          <td colSpan={2} className="px-4 py-4 font-black uppercase tracking-widest text-blue-600">Umumiy Xarajat</td>
                          <td className="px-4 py-4 text-right font-black text-xl text-blue-600">{selectedReport.analysis.estimatedCost?.toLocaleString()} so'm</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t('common.estimatedArea')}:</span>
                    <span className="text-sm font-black text-emerald-700">{selectedReport.analysis.estimatedArea} m²</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => viewOnMap(selectedReport)}
                    className="flex-1 bg-blue-600 text-white rounded-2xl py-4 px-6 text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-map-location-dot"></i>
                    {t('common.monitoring')}
                  </button>
                  <select 
                    value={selectedReport.status}
                    onChange={(e) => onUpdateStatus(selectedReport.id, e.target.value as ReportStatus)}
                    className="flex-1 bg-slate-900 text-white rounded-2xl py-4 px-6 text-xs font-black uppercase tracking-widest focus:outline-none"
                  >
                    {Object.values(ReportStatus).map(status => (
                      <option key={status} value={status}>{t(`common.${statusTranslationKeys[status]}`)}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => onDelete(selectedReport.id)}
                    className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen lg:h-[calc(100vh-120px)] gap-6 overflow-y-auto lg:overflow-hidden p-4 lg:p-0">
        {/* Navigation Sidebar (3D Lite) */}
        <div className="w-full lg:w-80 flex flex-col gap-4 perspective-1000 order-2 lg:order-1">
          <div className="flex-1 bg-slate-900 border border-white/5 rounded-[2.5rem] p-4 shadow-2xl space-y-2 backdrop-blur-xl">
             <div className="px-6 py-4 mb-4 border-b border-white/5">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Sistem Paneli</p>
                <h1 className="text-white text-lg font-black uppercase tracking-tighter">ROADAI CORE</h1>
             </div>
             
             {[
               { id: 'reports', icon: 'fa-list-check', label: 'Hisobotlar' },
               { id: 'users', icon: 'fa-user-gear', label: 'Operatorlar' },
               { id: 'analytics', icon: 'fa-chart-mixed', label: 'Analitika' },
               { id: 'notifications', icon: 'fa-bullhorn', label: 'Bildirishnomalar' },
             ].filter(item => {
               if (item.id === 'users') return (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.MODERATOR);
               if (item.id === 'notifications') return (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN);
               return true;
             }).map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ rotateY: -10, x: 5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full group px-6 py-5 rounded-2xl flex items-center gap-4 transition-all duration-300 transform-gpu ${
                    activeTab === item.id 
                      ? 'bg-blue-600 text-white shadow-[0_20px_40px_rgba(37,99,235,0.3)] translate-x-2' 
                      : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    activeTab === item.id ? 'bg-white/20' : 'bg-white/5'
                  }`}>
                    <i className={`fas ${item.icon} text-xs`}></i>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest flex-1">{item.label}</span>
                  {activeTab === item.id && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff]"></div>
                  )}
                </motion.button>
             ))}
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 capitalize"></div>
             <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 backdrop-blur-md shadow-inner">
                   <div className="w-8 h-8 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_20px_rgba(52,211,153,0.6)]"></div>
                </div>
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Tizim Holati</p>
                <h4 className="text-white font-black uppercase tracking-tighter">Sinxronlangan</h4>
             </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6 order-1 lg:order-2 overflow-hidden">
           {/* Top Bar */}
           <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-6 flex items-center justify-between shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-6">
                 <div className="flex flex-col">
                    <h2 className="text-white text-xl font-black uppercase tracking-tighter leading-none">{activeTab}</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Boshqaruv Markazi</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={exportToPDF} title="PDF Eksport" className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-white/5 group relative overflow-hidden">
                   <div className="absolute inset-0 bg-red-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                   <i className="fas fa-file-pdf relative z-10"></i>
                 </button>
                 <button onClick={exportToExcel} title="Excel Eksport" className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center border border-white/5 group relative overflow-hidden">
                   <div className="absolute inset-0 bg-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                   <i className="fas fa-file-excel relative z-10"></i>
                 </button>
                 <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                 <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/5 transition-all hover:bg-white/10 cursor-pointer">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-white uppercase leading-none">{currentUser?.firstName}</p>
                       <p className="text-[8px] text-blue-500 font-bold uppercase tracking-widest mt-1">{currentUser?.role}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg text-xs">{currentUser?.firstName?.[0]}</div>
                 </div>
              </div>
           </div>

           {/* Dynamic Content Container */}
           <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
              {renderContent()}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
