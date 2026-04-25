
import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Map as MapIcon, 
  Shield, 
  TrendingUp, 
  Users, 
  Camera, 
  Zap, 
  LayoutDashboard,
  Navigation,
  Clock,
  Settings,
  MoreVertical,
  ArrowUpRight,
  MapPin,
  Cpu,
  BarChart3,
  Search
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { Report, User, UserRole, ReportStatus, Severity } from '../types';

interface CommandCenterProps {
  allReports: Report[];
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: ReportStatus) => void;
  users: User[];
  onToggleBlock: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onSendGlobalNotification: (msg: string) => void;
  currentLocation: { lat: number; lng: number } | null;
  currentUser: User;
  onLogout: () => void;
  setActiveView: (view: 'monitor' | 'navigator' | 'profile' | 'admin') => void;
}

const CommandCenter: React.FC<CommandCenterProps> = ({
  allReports,
  onDelete,
  onUpdateStatus,
  users,
  onToggleBlock,
  onDeleteUser,
  onSendGlobalNotification,
  currentLocation,
  currentUser,
  onLogout,
  setActiveView
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'users' | 'settings'>('overview');
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = allReports.length;
    const pending = allReports.filter(r => r.status === ReportStatus.SUBMITTED || r.status === ReportStatus.UNDER_REVIEW).length;
    const fixed = allReports.filter(r => r.status === ReportStatus.FIXED).length;
    const inProgress = allReports.filter(r => r.status === ReportStatus.IN_REPAIR).length;
    const critical = allReports.filter(r => r.analysis.severity === Severity.HIGH).length;
    
    const qualityIndex = total === 0 ? 100 : Math.max(0, 100 - (critical * 10) - (pending * 2));
    const progressPercent = total === 0 ? 100 : Math.round((fixed / total) * 100);

    return { total, pending, fixed, inProgress, critical, qualityIndex, progressPercent };
  }, [allReports]);

  // Chart Data
  const recentActivityData = useMemo(() => {
    // Group by day for the last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('uz-UZ', { weekday: 'short' });
    }).reverse();

    return days.map(day => ({
      name: day,
      value: Math.floor(Math.random() * 20) + 5
    }));
  }, []);

  const severityData = [
    { name: 'Critical', value: stats.critical, color: '#ef4444' },
    { name: 'Medium', value: allReports.filter(r => r.analysis.severity === Severity.MEDIUM).length, color: '#f59e0b' },
    { name: 'Low', value: allReports.filter(r => r.analysis.severity === Severity.LOW).length, color: '#10b981' },
  ];

  const mapInstanceRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if ((activeTab === 'overview' || activeTab === 'map') && mapContainerRef.current) {
      if (!mapInstanceRef.current && !(mapContainerRef.current as any)._leaflet_id) {
        const initialLat = currentLocation?.lat || 41.2995;
        const initialLng = currentLocation?.lng || 69.2401;

        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 13,
          zoomControl: false,
          attributionControl: false
        });

        // Use a dark theme for the map
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20
        }).addTo(map);

        mapInstanceRef.current = map;
        setMapInstance(map);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapInstance(null);
      }
    };
  }, [activeTab]);

  // Update Markers
  useEffect(() => {
    if (mapInstance && typeof window !== 'undefined') {
      
      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      allReports.forEach(report => {
        const color = report.analysis.severity === Severity.HIGH ? '#ef4444' : '#f59e0b';
        
        // Custom Pulse Icon
        const pulseIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-6 h-6 rounded-full opacity-60 animate-ping" style="background-color: ${color}"></div>
              <div class="relative w-3 h-3 rounded-full border-2 border-white shadow-xl shadow-black/50" style="background-color: ${color}"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([report.location.lat, report.location.lng], { icon: pulseIcon }).addTo(mapInstance);
        
        const popupContent = `
          <div class="p-3 font-sans min-w-[200px]">
            <img src="${report.imageUrl || 'https://images.unsplash.com/photo-1599305090598-fe179d501c27?auto=format&fit=crop&q=80&w=400'}" 
                 class="w-full h-24 object-cover rounded-lg mb-3 shadow-md" onerror="this.src='https://via.placeholder.com/400x200?text=Yo%27l+Nosozligi'">
            <div class="space-y-1">
              <h4 class="font-black text-slate-900 border-b border-slate-100 pb-1">${report.analysis.type}</h4>
              <p class="text-[10px] text-slate-500 font-bold uppercase tracking-tight flex items-center">
                <i class="fas fa-location-dot mr-1"></i> ${report.address || 'Aniq joylashuv yo\'q'}
              </p>
              <div class="flex justify-between items-center pt-2">
                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                  report.analysis.severity === Severity.HIGH ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }">${report.analysis.severity}</span>
                <span class="text-slate-400 font-mono text-[9px]">${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}</span>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: 'dark-popup'
        });
        
        markersRef.current.push(marker);
      });
    }
  }, [mapInstance, allReports]);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col">
      {/* Top Header Barra */}
      <header className="h-16 border-b border-white/5 bg-[#0f1117]/80 backdrop-blur-2xl flex items-center justify-between px-8 z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 transform hover:rotate-3 transition-all cursor-pointer">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white leading-none mb-1">RoadAI Neural Vision</h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">v2.0 / COMMAND_CENTER_STATUS: ONLINE</span>
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block"></div>
          <nav className="hidden md:flex items-center gap-2">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'map', icon: MapIcon, label: 'Live Map' },
              { id: 'users', icon: Users, label: 'Personnel' },
              { id: 'settings', icon: Settings, label: 'Systems' }
            ].map((nav) => (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === nav.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <nav.icon className="w-4 h-4" />
                {nav.label}
              </button>
            ))}
          </nav>
          <div className="h-8 w-px bg-white/10 hidden md:block"></div>
          <button 
            onClick={() => setActiveView('monitor')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all hover:bg-white/5"
          >
            <ArrowUpRight className="w-4 h-4" />
            Public View
          </button>
        </div>

        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
           <div className="hidden lg:flex items-center gap-6">
             <div className="flex flex-col items-end">
               <span className="text-slate-500 mb-0.5">CPU LOAD</span>
               <span className="text-blue-500">32% / 128 FLOPS</span>
             </div>
             <div className="flex flex-col items-end">
               <span className="text-slate-500 mb-0.5">{currentUser.firstName?.toUpperCase()}</span>
               <span className="text-emerald-500">ROOT_ACCESS</span>
             </div>
           </div>
           <button 
            onClick={onLogout}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 transition-all cursor-pointer"
           >
              <Activity className="w-5 h-5 text-blue-500 hover:text-inherit" />
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left Sidebar - High-Tech Stats */}
        <aside className="w-[380px] flex flex-col gap-6 overflow-y-auto no-scrollbar hidden xl:flex">
          {/* Global Health Gauge */}
          <section className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap className="w-32 h-32 text-blue-500" />
            </div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Road Quality Index</h3>
              <MoreVertical className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex flex-col items-center justify-center py-6 relative">
               <div className="w-48 h-48 rounded-full border-[10px] border-white/5 flex flex-col items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full border-[10px] border-t-blue-600 border-r-blue-600/50 border-b-transparent border-l-transparent rotate-[-45deg] transition-all transform duration-1000"
                       style={{ rotate: `${(stats.qualityIndex * 3.6) - 90}deg` }}></div>
                  <span className="text-5xl font-black text-white tracking-tighter mb-1">{stats.qualityIndex}%</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-500">NEURAL_GREEN</span>
               </div>
               <div className="grid grid-cols-2 w-full mt-10 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Alert Level</span>
                    <span className={`text-xs font-black uppercase tracking-widest ${stats.critical > 5 ? 'text-red-500' : 'text-blue-400'}`}>
                      {stats.critical > 5 ? 'ELEVATED' : 'NOMINAL'}
                    </span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">AI Trust</span>
                    <span className="text-xs font-black text-emerald-400">98.4%</span>
                  </div>
               </div>
            </div>
          </section>

          {/* AI Vision Mini Preview */}
          <section className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-8 overflow-hidden relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Camera className="w-4 h-4 text-blue-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">NEURAL_VISION_LIVE</h3>
              </div>
              <span className="text-[8px] font-black text-red-500 uppercase animate-pulse">REC ● LIVE</span>
            </div>
            <div className="aspect-video bg-black rounded-3xl relative overflow-hidden border border-white/10 group">
               <img 
                src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800" 
                className="w-full h-full object-cover opacity-50 contrast-125 grayscale group-hover:grayscale-0 transition-all duration-700"
               />
               <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay"></div>
               {/* Simulated Bounding Boxes */}
               <motion.div 
                animate={{ x: [20, 100, 20], y: [40, 60, 40] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute w-24 h-16 border-2 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)] bg-red-500/10"
               >
                 <span className="absolute -top-5 left-0 text-[7px] font-black bg-red-500 text-white px-1 py-0.5 rounded uppercase">POTHOLE_D01</span>
               </motion.div>
               <motion.div 
                animate={{ x: [150, 120, 150], y: [80, 70, 80] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="absolute w-32 h-10 border-2 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-500/10"
               >
                 <span className="absolute -top-5 left-0 text-[7px] font-black bg-blue-600 text-white px-1 py-0.5 rounded uppercase">CRACK_E40</span>
               </motion.div>
               
               <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <div className="font-mono text-[7px] text-emerald-500">
                    LAT: 41.2995<br />LNG: 69.2401<br />SPD: 42KM/H
                  </div>
                  <div className="w-16 h-16 border border-emerald-500/30 rounded-full flex items-center justify-center">
                    <div className="w-10 h-10 border border-emerald-500/50 rounded-full flex items-center justify-center overflow-hidden">
                       <motion.div 
                        animate={{ height: ['20%', '80%', '20%'] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="w-1 bg-emerald-500"
                       />
                    </div>
                  </div>
               </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Repair Efficiency</span>
                  <span className="text-[10px] font-black text-white">{stats.progressPercent}%</span>
               </div>
               <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.progressPercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                  />
               </div>
            </div>
          </section>

          {/* Quick Action */}
          <button 
            onClick={() => onSendGlobalNotification("Hamma xodimlarga: Monitoring kuchaytirilsin. Ob-havo o'zgarishi kutilmoqda.")}
            className="w-full bg-white text-black py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] hover:bg-blue-500 hover:text-white transition-all shadow-xl active:scale-95 group flex items-center justify-center gap-3"
          >
            <Zap className="w-4 h-4 group-hover:animate-bounce" />
            Launch Global Alert
          </button>
        </aside>

        {/* Central Map & Activity Feed */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {[
               { icon: Activity, label: 'Systems Status', value: '185.0 ms', sub: 'LATENCY', color: 'text-blue-500' },
               { icon: TrendingUp, label: 'Active Repairs', value: stats.inProgress, sub: 'TEAMS_OUT', color: 'text-amber-500' },
               { icon: AlertTriangle, label: 'Red Alerts', value: stats.critical, sub: 'CRITICAL', color: 'text-red-500' }
             ].map((card, i) => (
               <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0f1117] border border-white/5 rounded-3xl p-6 flex flex-col justify-between group hover:border-white/10 transition-all"
               >
                 <div className="flex items-center justify-between mb-4">
                   <div className={`p-3 rounded-2xl bg-white/5 ${card.color}`}>
                     <card.icon className="w-5 h-5" />
                   </div>
                   <ArrowUpRight className="w-4 h-4 text-slate-700 group-hover:text-blue-500 transition-colors" />
                 </div>
                 <div>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">{card.label}</span>
                   <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-black text-white tracking-tighter">{card.value}</span>
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{card.sub}</span>
                   </div>
                 </div>
               </motion.div>
             ))}
          </div>

          <main className="flex-1 relative bg-[#0f1117] border border-white/5 rounded-[2.5rem] overflow-hidden group">
            {/* Nav Map/Table Toggles */}
            <div className="absolute top-8 left-8 z-[20] flex gap-3">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  activeTab === 'overview' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-[#0f1117]/80 backdrop-blur-md text-slate-500 border border-white/5 hover:bg-white/5'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setActiveTab('map')}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  activeTab === 'map' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-[#0f1117]/80 backdrop-blur-md text-slate-500 border border-white/5 hover:bg-white/5'
                }`}
              >
                <MapIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="absolute top-8 right-8 z-[20] flex items-center gap-4 bg-[#0f1117]/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5">
                <Search className="w-4 h-4 text-slate-600" />
                <input 
                  type="text" 
                  placeholder="SEARCH_LOCATION_OR_NODE..." 
                  className="bg-transparent border-none focus:outline-none text-[10px] font-black uppercase tracking-widest text-slate-300 w-48 placeholder:text-slate-700"
                />
            </div>

            {/* Content Container */}
            <div className="h-full w-full">
              {activeTab === 'overview' || activeTab === 'map' ? (
                 <div className="h-full w-full relative">
                    <div ref={mapContainerRef} className="h-full w-full z-10" />
                    {/* Compass Overlay */}
                    <div className="absolute bottom-10 right-10 z-[20] pointer-events-none opacity-20">
                       <Navigation className="w-24 h-24 text-white rotate-[-15deg]" />
                    </div>
                    {/* Activity Feed Mini */}
                    <div className="absolute bottom-8 left-8 z-[20] w-72 bg-[#0f1117]/80 backdrop-blur-xl rounded-3xl p-6 border border-white/5 flex flex-col gap-4 shadow-2xl">
                       <div className="flex items-center gap-3">
                         <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                         <h4 className="text-[9px] font-black uppercase tracking-widest text-white">System Signal Feed</h4>
                       </div>
                       <div className="space-y-4 max-h-[200px] overflow-y-auto no-scrollbar">
                          {allReports.slice(0, 5).map((r, i) => (
                             <div key={i} className="flex gap-4 group cursor-pointer transition-all">
                                <div className={`w-1 h-8 rounded-full ${r.analysis.severity === Severity.HIGH ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                <div>
                                   <p className="text-[10px] font-black uppercase tracking-tight text-slate-300 group-hover:text-blue-500 transition-colors">{r.analysis.type}</p>
                                   <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                      <Clock className="w-2.5 h-2.5" /> 2m ago
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              ) : activeTab === 'users' ? (
                <div className="h-full w-full p-12 overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between mb-12">
                     <div className="flex items-center gap-4">
                        <Users className="w-8 h-8 text-blue-500" />
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Neural Personnel</h2>
                     </div>
                     <button className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white text-black transition-all">
                       Deploy New Instance
                     </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map(user => (
                       <motion.div 
                        whileHover={{ y: -5 }}
                        key={user.id} 
                        className="bg-white/5 border border-white/10 p-6 rounded-3xl flex flex-col gap-6"
                       >
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-500 flex items-center justify-center font-black">
                                  {user.name.charAt(0)}
                               </div>
                               <div>
                                  <h4 className="text-sm font-black text-white uppercase tracking-tight">{user.name}</h4>
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user.role}</span>
                               </div>
                            </div>
                            <button 
                              onClick={() => onToggleBlock(user.id)}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${user.isBlocked ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                         </div>
                         <div className="bg-black/40 rounded-2xl p-4 space-y-3">
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                               <span className="text-slate-500">Security Access</span>
                               <span className="text-blue-500">Level 4</span>
                            </div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                               <span className="text-slate-500">Node Location</span>
                               <span className="text-white">{user.region || 'Tashkent HQ'}</span>
                            </div>
                         </div>
                         <div className="flex gap-3">
                            <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Assign Protocol</button>
                            <button 
                              onClick={() => onDeleteUser(user.id)}
                              className="px-4 py-3 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                         </div>
                       </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-600 gap-4">
                   <Cpu className="w-16 h-16 animate-spin-slow opacity-20" />
                   <span className="text-xs font-black uppercase tracking-[0.5em]">SYSTEMS_TERMINAL_OFFLINE</span>
                </div>
              )}
            </div>
          </main>

          {/* Bottom Table Section */}
          <section className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-4 flex flex-col overflow-hidden max-h-[300px]">
             <div className="flex items-center justify-between px-8 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                   <BarChart3 className="w-4 h-4 text-blue-500" />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Recent Incident Records</h3>
                </div>
                <div className="flex gap-4">
                   <button className="px-4 py-1.5 rounded-lg bg-white/5 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Filter</button>
                   <button className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">Export Logs</button>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-[#0f1117] z-10">
                      <tr className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 border-b border-white/5">
                         <th className="px-8 py-4">Status</th>
                         <th className="px-8 py-4">Incident_Type</th>
                         <th className="px-8 py-4">Location_District</th>
                         <th className="px-8 py-4">Severity_Index</th>
                         <th className="px-8 py-4">Timestamp</th>
                         <th className="px-8 py-4 text-right">Operation</th>
                      </tr>
                   </thead>
                   <tbody>
                      {allReports.map((r, i) => (
                         <tr key={i} className="group hover:bg-white/5 transition-all text-xs border-b border-white/5 last:border-0 font-medium">
                            <td className="px-8 py-4">
                               <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    r.status === ReportStatus.FIXED ? 'bg-emerald-500' : 
                                    r.status === ReportStatus.IN_REPAIR ? 'bg-blue-500' : 'bg-amber-500'
                                  }`}></div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{r.status}</span>
                               </div>
                            </td>
                            <td className="px-8 py-4 text-white font-black uppercase tracking-tight">{r.analysis.type}</td>
                            <td className="px-8 py-4 text-slate-500 uppercase tracking-widest truncate max-w-[200px]">{r.region || 'CENTRAL_HQ'}</td>
                            <td className="px-8 py-4">
                               <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                 r.analysis.severity === Severity.HIGH ? 'bg-red-500/20 text-red-500' : 
                                 r.analysis.severity === Severity.MEDIUM ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                               }`}>
                                  {r.analysis.severity}
                               </span>
                            </td>
                            <td className="px-8 py-4 text-slate-600 font-mono text-[10px]">{new Date(r.timestamp).toLocaleString().replace(',', ' |')}</td>
                            <td className="px-8 py-4 text-right">
                               <button 
                                onClick={() => onUpdateStatus(r.id, ReportStatus.IN_REPAIR)}
                                className="px-4 py-2 rounded-xl bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all"
                               >
                                  Assign Crew
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </section>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-div-icon {
          background: none !important;
          border: none !important;
        }
        .dark-popup .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          color: #0f1117 !important;
          border-radius: 24px !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important;
        }
        .dark-popup .leaflet-popup-tip {
          background: #ffffff !important;
        }
        .dark-popup .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
        }
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default CommandCenter;
