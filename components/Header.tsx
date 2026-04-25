
import React from 'react';
import { User, UserRole, Notification, Language } from '../types';
import { useLanguage } from '../src/lib/LanguageContext';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  activeView: 'monitor' | 'navigator' | 'profile' | 'admin';
  setActiveView: (view: 'monitor' | 'navigator' | 'profile' | 'admin') => void;
}

const Header: React.FC<HeaderProps> = ({ 
  user, 
  onLogout, 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead,
  activeView,
  setActiveView
}) => {
  const { language, setLanguage, t } = useLanguage();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="sticky top-0 z-50 bg-white/80 border-b border-slate-200 backdrop-blur-xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4 group cursor-pointer">
            <div className="relative">
              <div className="bg-blue-600 h-10 w-10 flex items-center justify-center rounded-xl rotate-45 group-hover:rotate-0 transition-all duration-500 shadow-lg shadow-blue-500/20">
                <i className="fas fa-satellite-dish text-white text-lg -rotate-45 group-hover:rotate-0 transition-all duration-500"></i>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <span className="text-xl font-black text-slate-800 tracking-tight uppercase">
                ROAD<span className="text-blue-600">AI</span>
              </span>
              <div className="text-[8px] text-slate-400 font-black uppercase tracking-[0.3em] -mt-1">MANAGEMENT DASHBOARD</div>
            </div>
          </div>
          
          <div className="hidden xl:flex items-center space-x-8 px-8 border-x border-slate-100 h-12">
            <div className="flex space-x-1">
              {activeView !== 'admin' && (
                <>
                  <button 
                    onClick={() => setActiveView('monitor')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-all flex items-center ${activeView === 'monitor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    Monitoring
                  </button>
                  <button 
                    onClick={() => setActiveView('navigator')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-all flex items-center ${activeView === 'navigator' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    Navigator
                  </button>
                </>
              )}
              {user.role === UserRole.ADMIN && (
                <button 
                  onClick={() => setActiveView('admin')} 
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-all flex items-center ${activeView === 'admin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                >
                  Admin
                </button>
              )}
              {activeView !== 'admin' && (
                <button 
                  onClick={() => setActiveView('profile')} 
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-all flex items-center ${activeView === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                >
                  Profile
                </button>
              )}
            </div>
            
            <div className="w-px h-6 bg-slate-100 mx-2"></div>

            <div className="flex flex-col items-start min-w-[100px]">
               <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Status</span>
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                 <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Online</span>
               </div>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all relative">
                <i className="fas fa-bell text-sm"></i>
                {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50"></span>}
              </button>
              <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all">
                <i className="fas fa-magnifying-glass text-sm"></i>
              </button>
            </div>

            <div className="flex items-center space-x-4 group cursor-pointer relative py-2">
               <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{user.firstName} {user.lastName}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-[0.2em] font-black">{user.role}</span>
               </div>
               <div className="w-11 h-11 bg-slate-50 border-2 border-white rounded-2xl flex items-center justify-center hover:border-blue-500 transition-all shadow-sm overflow-hidden group-hover:scale-105">
                  <i className="fas fa-user-circle text-slate-300 text-xl group-hover:text-blue-500"></i>
               </div>

               <div className="absolute right-0 top-full mt-2 w-64 glass-panel rounded-3xl opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:visible group-hover:scale-100 transition-all p-4 z-[100] transform shadow-2xl origin-top-right border-slate-200">
                  <div className="p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Tizim Ma'lumotlari</p>
                     <div className="flex flex-col space-y-2">
                        <div className="flex justify-between">
                           <span className="text-[10px] text-slate-500 font-bold uppercase">Role:</span>
                           <span className="text-[10px] text-blue-600 font-black uppercase">{user.role}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-[10px] text-slate-500 font-bold uppercase">UID:</span>
                           <span className="text-[10px] text-slate-900 font-mono">{user.id.slice(0, 10)}...</span>
                        </div>
                     </div>
                  </div>
                  <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center space-x-3 px-4 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                  >
                    <i className="fas fa-right-from-bracket"></i>
                    <span>Sessiyani yakunlash</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
