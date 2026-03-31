
import React, { useState, useMemo } from 'react';
import { Report, ReportStatus, User, Severity, RoadHealth, DefectType } from '../types';
import MapDisplay from './MapDisplay';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminPanelProps {
  allReports: Report[];
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: ReportStatus) => void;
  users: User[];
  onToggleBlock: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onSendGlobalNotification: (title: string, message: string) => Promise<void>;
  currentLocation: { lat: number, lng: number } | null;
  notifications: Notification[];
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
  notifications
}) => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'users' | 'analytics' | 'regions' | 'notifications'>('dashboard');
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
    
    return { totalReports, fixedReports, highRisk, regionStats, avgRepairTime, totalUsers: users.length };
  }, [filteredReports, users]);

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

    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [filteredReports]);

  const severityData = useMemo(() => {
    const counts = { [Severity.LOW]: 0, [Severity.MEDIUM]: 0, [Severity.HIGH]: 0 };
    filteredReports.forEach(r => {
      counts[r.analysis.severity]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReports]);

  const COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444'];
  const SEVERITY_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Yo'l Nosozliklari Hisoboti", 20, 20);
    doc.setFontSize(12);
    doc.text(`Sana: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Jami xabarlar: ${filteredReports.length}`, 20, 40);
    
    let y = 60;
    filteredReports.slice(0, 15).forEach((r, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${i+1}. ${r.analysis.type} - ${r.status} (${r.region || 'Noma\'lum'})`, 20, y);
      y += 10;
    });
    
    doc.save(`road_report_${Date.now()}.pdf`);
  };

  const exportToExcel = () => {
    const data = filteredReports.map(r => ({
      ID: r.id,
      Foydalanuvchi: r.userName,
      Turi: r.analysis.type,
      Holati: r.status,
      Viloyat: r.region,
      Xarajat: r.analysis.estimatedCost,
      Vaqt: r.analysis.estimatedTime,
      Sana: new Date(r.timestamp).toLocaleString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, `road_reports_${Date.now()}.xlsx`);
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
                    {selectedReport.analysis.severity} Xavf
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
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">{selectedReport.analysis.type}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ID: {selectedReport.id.slice(0, 8)}</p>
                  </div>
                  <button onClick={() => setSelectedReport(null)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                    <i className="fas fa-times text-xl"></i>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Joylashuv</p>
                    <p className="text-[10px] font-bold text-slate-900">{selectedReport.region}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Sana</p>
                    <p className="text-[10px] font-bold text-slate-900">{new Date(selectedReport.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tahlil va Tavsif</h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{selectedReport.analysis.description}</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Tavsiya</h4>
                    <p className="text-sm text-blue-600 font-bold italic">"{selectedReport.analysis.recommendation}"</p>
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
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Taxminiy Maydon:</span>
                    <span className="text-sm font-black text-emerald-700">{selectedReport.analysis.estimatedArea} m²</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => viewOnMap(selectedReport)}
                    className="flex-1 bg-blue-600 text-white rounded-2xl py-4 px-6 text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-map-location-dot"></i>
                    Xaritada ko'rish
                  </button>
                  <select 
                    value={selectedReport.status}
                    onChange={(e) => onUpdateStatus(selectedReport.id, e.target.value as ReportStatus)}
                    className="flex-1 bg-slate-900 text-white rounded-2xl py-4 px-6 text-xs font-black uppercase tracking-widest focus:outline-none"
                  >
                    {Object.values(ReportStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center">
            <i className="fas fa-shield-halved mr-4 text-blue-600"></i>
            Boshqaruv Paneli
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Tizim xavfsizligi va yo'l holati nazorati</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={exportMonthlyReport} className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
            <i className="fas fa-calendar-check mr-2"></i> Monthly Report
          </button>
          <button onClick={exportToPDF} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
            <i className="fas fa-file-pdf mr-2"></i> PDF Export
          </button>
          <button onClick={exportToExcel} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
            <i className="fas fa-file-excel mr-2"></i> Excel Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm overflow-x-auto">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Hisobotlar
        </button>
        <button 
          onClick={() => setActiveTab('regions')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'regions' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Hududlar
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Foydalanuvchilar
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Analitika
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Bildirishnomalar
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Jami Hisobotlar</p>
              <h3 className="text-4xl font-black">{stats.totalReports}</h3>
              <div className="mt-4 flex items-center text-[10px] font-bold">
                <i className="fas fa-arrow-up mr-2"></i> 12% o'sish
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tuzatilgan</p>
              <h3 className="text-4xl font-black text-slate-900">{stats.fixedReports}</h3>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${(stats.fixedReports / stats.totalReports) * 100}%` }}></div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Yuqori Xavf</p>
              <h3 className="text-4xl font-black text-red-500">{stats.highRisk}</h3>
              <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase">Tezkor chora zarur</p>
            </div>
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aktiv Foydalanuvchilar</p>
              <h3 className="text-4xl font-black text-slate-900">{users.length}</h3>
              <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase">Jami ro'yxatdan o'tgan</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">So'nggi Nosozliklar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentReports.map(report => (
                  <div key={report.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex space-x-4 hover:border-blue-500/30 transition-all shadow-sm">
                    <img src={report.image} className="w-24 h-24 rounded-2xl object-cover border border-slate-100" />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{report.analysis.type}</h4>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${report.analysis.severity === Severity.HIGH ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                            {report.analysis.severity}
                          </span>
                          {(report.analysis.severity === Severity.HIGH || report.analysis.health === RoadHealth.POOR) && (
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">
                              Reporter: {report.userName}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">{report.region}, {new Date(report.timestamp).toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-600 line-clamp-2 mt-2 leading-tight">{report.analysis.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Hududlar</h3>
                <button onClick={() => setActiveTab('regions')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Hammasi</button>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="space-y-6">
                  {stats.regionStats.slice(0, 5).map((r: any) => (
                    <button 
                      key={r.region} 
                      onClick={() => { setSelectedRegion(r.region); setActiveTab('regions'); }}
                      className="w-full text-left group"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest group-hover:text-blue-600 transition-colors">{r.region}</span>
                        <span className="text-[10px] font-black text-blue-600">{r.count}</span>
                      </div>
                      <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full group-hover:bg-blue-500 transition-all" style={{ width: `${(r.count / stats.totalReports) * 100}%` }}></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'regions' && (
        <div className="space-y-8 animate-slide-up">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Viloyatlar Ro'yxati</h3>
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-4 shadow-sm max-h-[600px] overflow-y-auto">
                {stats.regionStats.map((r: any) => (
                  <button
                    key={r.region}
                    onClick={() => setSelectedRegion(r.region)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-all ${selectedRegion === r.region ? 'bg-blue-600 text-white shadow-lg scale-[1.02]' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedRegion === r.region ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                        <i className="fas fa-location-dot"></i>
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest">{r.region}</span>
                    </div>
                    <span className={`text-xs font-black ${selectedRegion === r.region ? 'text-white' : 'text-blue-600'}`}>{r.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-8">
              {selectedRegion ? (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex items-center space-x-4 mb-4">
                    <button onClick={() => setSelectedRegion(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <i className="fas fa-arrow-left text-slate-400"></i>
                    </button>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Orqaga</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedRegion}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hududiy tahlil va monitoring</p>
                      </div>
                      <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Jami nosozliklar: {stats.regionStats.find(r => r.region === selectedRegion)?.count || 0}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Tuzatilgan</p>
                        <p className="text-2xl font-black text-slate-900">
                          {filteredReports.filter(r => r.region === selectedRegion && r.status === ReportStatus.FIXED).length}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Jarayonda</p>
                        <p className="text-2xl font-black text-slate-900">
                          {filteredReports.filter(r => r.region === selectedRegion && (r.status === ReportStatus.IN_REPAIR || r.status === ReportStatus.UNDER_REVIEW)).length}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Yuqori Xavf</p>
                        <p className="text-2xl font-black text-red-500">
                          {filteredReports.filter(r => r.region === selectedRegion && r.analysis.severity === Severity.HIGH).length}
                        </p>
                      </div>
                    </div>

                    <div className="h-[400px] rounded-[2rem] overflow-hidden border border-slate-200 shadow-inner">
                      <MapDisplay 
                        currentLocation={filteredReports.find(r => r.region === selectedRegion)?.location || { lat: 41.2995, lng: 69.2401 }}
                        reports={filteredReports.filter(r => r.region === selectedRegion)} 
                        onReportClick={setSelectedReport}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Hududdagi So'nggi Hisobotlar</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredReports
                        .filter(r => r.region === selectedRegion)
                        .slice(0, 4)
                        .map(report => (
                          <div key={report.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex space-x-4 shadow-sm">
                            <img src={report.image} className="w-20 h-20 rounded-2xl object-cover" />
                            <div className="flex-1">
                              <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{report.analysis.type}</h5>
                              <p className="text-[9px] text-slate-400 font-bold mt-1">{new Date(report.timestamp).toLocaleDateString()}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${report.status === ReportStatus.FIXED ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {report.status}
                                </span>
                                {(report.analysis.severity === Severity.HIGH || report.analysis.health === RoadHealth.POOR) && (
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">
                                    {report.userName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                  <div className="lg:col-span-8 h-[500px] bg-slate-50 rounded-[2.5rem] border border-slate-200 overflow-hidden relative shadow-inner">
                    <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">O'zbekiston Yo'l Xaritasi</h4>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Viloyatlar bo'yicha monitoring</p>
                    </div>
                    <MapDisplay 
                      currentLocation={currentLocation || { lat: 41.3775, lng: 64.5853 }} 
                      reports={filteredReports}
                    />
                  </div>
                  <div className="lg:col-span-4 grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                    {stats.regionStats.map((r: any, idx: number) => (
                      <div 
                        key={r.region} 
                        className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group animate-slide-up"
                        style={{ animationDelay: `${idx * 50}ms` }}
                        onClick={() => setSelectedRegion(r.region)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <i className="fas fa-map-location-dot"></i>
                          </div>
                          <span className="text-xl font-black text-slate-900">{r.count}</span>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight mb-2">{r.region}</h4>
                        <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full" style={{ width: `${(r.count / stats.totalReports) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <i className="fas fa-bullhorn text-xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Global Bildirishnoma</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Barcha foydalanuvchilarga xabar yuborish</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Xabar Sarlavhasi</label>
                <input 
                  type="text" 
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="Masalan: Tizim yangilanishi"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition-all font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Xabar Matni</label>
                <textarea 
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Xabar mazmunini bu yerga yozing..."
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition-all font-medium resize-none"
                ></textarea>
              </div>

              <button 
                onClick={async () => {
                  if (!notifTitle || !notifMessage) {
                    alert("Iltimos, barcha maydonlarni to'ldiring");
                    return;
                  }
                  setIsSending(true);
                  await onSendGlobalNotification(notifTitle, notifMessage);
                  setNotifTitle('');
                  setNotifMessage('');
                  setIsSending(false);
                }}
                disabled={isSending}
                className={`w-full py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 ${isSending ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'}`}
              >
                {isSending ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Yuborilmoqda...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i>
                    <span>Barchaga Yuborish</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 p-6 bg-amber-50 rounded-3xl border border-amber-100">
              <div className="flex space-x-3">
                <i className="fas fa-circle-info text-amber-500 mt-1"></i>
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase tracking-tight">
                  Diqqat: Ushbu xabar tizimdagi barcha ro'yxatdan o'tgan foydalanuvchilarga yuboriladi. Iltimos, ma'lumotlar to'g'riligini tekshiring.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Xabarlar Tarixi</h3>
              <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Global</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              {notifications.filter(n => n.userId === 'global').length === 0 ? (
                <div className="p-12 text-center text-slate-300">
                  <i className="fas fa-history text-4xl mb-4 opacity-20"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">Hozircha yuborilgan xabarlar yo'q</p>
                </div>
              ) : (
                notifications.filter(n => n.userId === 'global').map(notif => (
                  <div key={notif.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 animate-fade-in">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{notif.title}</h4>
                      <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(notif.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 px-6 py-6 rounded-[2rem] flex items-center space-x-4 shadow-sm">
               <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                  <i className="fas fa-database text-2xl"></i>
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jami xabarlar</p>
                  <p className="text-2xl font-black text-slate-900">{stats.totalReports}</p>
               </div>
            </div>
            <div className="bg-white border border-slate-200 px-6 py-6 rounded-[2rem] flex items-center space-x-4 shadow-sm">
               <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
                  <i className="fas fa-check-double text-2xl"></i>
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tuzatilgan</p>
                  <p className="text-2xl font-black text-slate-900">{stats.fixedReports}</p>
               </div>
            </div>
            <div className="bg-white border border-slate-200 px-6 py-6 rounded-[2rem] flex items-center space-x-4 shadow-sm">
               <div className="bg-red-50 p-4 rounded-2xl text-red-600">
                  <i className="fas fa-radiation text-2xl animate-pulse"></i>
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yuqori Xavf</p>
                  <p className="text-2xl font-black text-slate-900">{stats.highRisk}</p>
               </div>
            </div>
            <div className="bg-white border border-slate-200 px-6 py-6 rounded-[2rem] flex items-center space-x-4 shadow-sm">
               <div className="bg-purple-50 p-4 rounded-2xl text-purple-600">
                  <i className="fas fa-users text-2xl"></i>
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foydalanuvchilar</p>
                  <p className="text-2xl font-black text-slate-900">{stats.totalUsers}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
            <div className="lg:col-span-8 h-[500px] bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden relative shadow-sm">
               <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">O'zbekiston Yo'l Xaritasi</h4>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Barcha xabarlar joylashuvi</p>
               </div>
               <div className="w-full h-full">
                  {filteredReports.length > 0 && filteredReports[0].location ? (
                    <MapDisplay 
                      currentLocation={filteredReports[0].location} 
                      reports={filteredReports}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-black uppercase text-xs tracking-widest">
                       Joylashuv ma'lumotlari mavjud emas
                    </div>
                  )}
               </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
               <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center">
                     <i className="fas fa-location-dot mr-2 text-blue-600"></i>
                     Hududlar bo'yicha
                  </h4>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                     {stats.regionStats.map((r: any) => (
                       <div key={r.region} className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{r.region}</span>
                          <span className="text-xs font-black text-slate-900">{r.count}</span>
                       </div>
                     ))}
                  </div>
               </div>

               {selectedReport && (
                 <div className="bg-white p-6 rounded-[2rem] border border-blue-200 animate-fade-in shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                       <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Batafsil Ma'lumot</h4>
                       <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
                    </div>
                    <img src={selectedReport.image} className="w-full h-32 object-cover rounded-xl mb-4 border border-slate-100" />
                    
                    <div className="w-full h-32 rounded-xl overflow-hidden mb-4 border border-slate-200 relative z-0">
                      <MapDisplay 
                        currentLocation={selectedReport.location} 
                        reports={[selectedReport]}
                      />
                    </div>

                    <div className="space-y-3">
                       <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Joylashuv (Manzil)</p>
                          <p className="text-[10px] text-slate-900 font-bold mb-2">{selectedReport.location.address || `${selectedReport.location.lat.toFixed(4)}, ${selectedReport.location.lng.toFixed(4)}`}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Tavsif</p>
                          <p className="text-[10px] text-slate-600 leading-relaxed">{selectedReport.analysis.description}</p>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm mt-8">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Barcha Hisobotlar</h3>
               <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <div className="relative flex-grow md:flex-grow-0">
                    <input 
                      type="text"
                      value={reportFilter.search}
                      onChange={(e) => setReportFilter(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Qidirish..."
                      className="bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg pl-8 pr-3 py-2 w-full focus:outline-none focus:border-blue-500"
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[8px]"></i>
                  </div>
                  <select 
                    value={reportFilter.status}
                    onChange={(e) => setReportFilter(prev => ({ ...prev, status: e.target.value }))}
                    className="bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Barcha Holatlar</option>
                    {Object.values(ReportStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <select 
                    value={reportFilter.severity}
                    onChange={(e) => setReportFilter(prev => ({ ...prev, severity: e.target.value }))}
                    className="bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Barcha Xavflar</option>
                    {Object.values(Severity).map(sev => (
                      <option key={sev} value={sev}>{sev}</option>
                    ))}
                  </select>
                  <select 
                    value={reportFilter.region}
                    onChange={(e) => setReportFilter(prev => ({ ...prev, region: e.target.value }))}
                    className="bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Barcha Hududlar</option>
                    {stats.regionStats.map(r => (
                      <option key={r.region} value={r.region}>{r.region}</option>
                    ))}
                  </select>
               </div>
            </div>
            
            {displayReports.length === 0 ? (
              <div className="p-32 text-center text-slate-300">
                <p className="font-black uppercase tracking-[0.2em] text-[10px]">Filtrga mos ma'lumotlar topilmadi</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="p-6">Reporter</th>
                      <th className="p-6">Nosozlik</th>
                      <th className="p-6">Viloyat</th>
                      <th className="p-6 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayReports.map(report => (
                      <tr key={report.id} className="hover:bg-blue-50/50 transition-all group">
                        <td className="p-6">
                          <div className="flex items-center space-x-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-slate-900">{report.userName}</p>
                                {(report.analysis.severity === Severity.HIGH || report.analysis.health === RoadHealth.POOR) && (
                                  <span className="bg-red-500 text-white text-[6px] font-black px-1 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                                    High Risk
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-slate-400 uppercase font-black">{new Date(report.timestamp).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center space-x-3">
                             <img src={report.image} className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                             <span className="text-xs font-bold text-slate-600">{report.analysis.type}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className="text-xs font-black text-blue-600">{report.region}</span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end space-x-2">
                            <select 
                              value={report.status}
                              onChange={(e) => onUpdateStatus(report.id, e.target.value as ReportStatus)}
                              className="bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                            >
                              {Object.values(ReportStatus).map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => setSelectedReport(report)}
                              className="w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            >
                              <i className="fas fa-eye text-sm"></i>
                            </button>
                            <button 
                              onClick={() => onDelete(report.id)}
                              className="w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <i className="fas fa-trash text-sm"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {activeTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Foydalanuvchilar Boshqaruvi</h3>
            <div className="relative w-full md:w-64">
              <input 
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Foydalanuvchini qidirish..."
                className="w-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[8px]"></i>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-6">Foydalanuvchi</th>
                  <th className="p-6">Viloyat / Tuman</th>
                  <th className="p-6">Telefon / ID</th>
                  <th className="p-6 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-300">
                      <p className="font-black uppercase tracking-[0.2em] text-[10px]">Foydalanuvchilar topilmadi</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-blue-50/50 transition-all">
                      <td className="p-6">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="text-sm font-black text-slate-900">{user.firstName} {user.lastName}</p>
                            <p className="text-[9px] text-slate-400 font-black">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                         <p className="text-xs font-black text-slate-600">{user.region}</p>
                         <p className="text-[9px] text-slate-400 uppercase font-bold">{user.district}</p>
                      </td>
                      <td className="p-6">
                         <p className="text-xs font-black text-blue-600">{user.phone}</p>
                         <p className="text-[9px] text-slate-400 uppercase font-bold">{user.personalCode}</p>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end space-x-2">
                          <button 
                            onClick={() => onToggleBlock(user.id)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${user.isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}
                            title={user.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                          >
                            <i className={`fas ${user.isBlocked ? 'fa-user-check' : 'fa-user-slash'}`}></i>
                          </button>
                          <button 
                            onClick={() => onDeleteUser(user.id)}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                          >
                            <i className="fas fa-user-minus"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-slide-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8">Xabarlar Holati (Status)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {analyticsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      itemStyle={{ color: '#0f172a', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8">Xavflilik Darajasi</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      itemStyle={{ color: '#0f172a', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8">Viloyatlar bo'yicha faollik</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.regionStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="region" 
                    stroke="#94a3b8" 
                    fontSize={8} 
                    tickFormatter={(val) => val.substring(0, 5)}
                    tick={{ fontWeight: 'bold' }}
                  />
                  <YAxis stroke="#94a3b8" fontSize={8} tick={{ fontWeight: 'bold' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                    itemStyle={{ color: '#0f172a', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
