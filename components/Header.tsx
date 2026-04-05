
import React from 'react';
import { User, UserRole, Notification, Language } from '../types';
import { useLanguage } from '../src/lib/LanguageContext';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, notifications, onMarkAsRead }) => {
  const { language, setLanguage, t } = useLanguage();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="bg-blue-600 p-2 rounded-[12px] shadow-[0_5px_15px_rgba(37,99,235,0.3)] animate-pulse-slow">
                <i className="fas fa-road text-white text-xl"></i>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                Road<span className="text-blue-600">AI</span>
              </span>
              <div className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] -mt-1">Neural Vision v2</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Language Switcher */}
            <div className="relative group/lang">
              <button className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest hover:border-blue-600 transition-all">
                <i className="fas fa-globe text-slate-400"></i>
                <span>{language}</span>
              </button>
              <div className="absolute right-0 top-12 w-40 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all p-2 z-50">
                {[
                  { code: Language.UZ, label: t('common.uzbek') },
                  { code: Language.QR, label: t('common.karakalpak') },
                  { code: Language.EN, label: t('common.english') },
                  { code: Language.RU, label: t('common.russian') }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`w-full text-left px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${language === lang.code ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="relative group/notif">
              <button className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all relative">
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <div className="absolute right-0 top-14 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-2xl opacity-0 invisible group-hover/notif:opacity-100 group-hover/notif:visible transition-all p-4 z-50 transform group-hover/notif:translate-y-0 translate-y-2">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t('common.notifications')}</h4>
                  <span className="text-[8px] font-black text-slate-400 uppercase">{notifications.length} {t('common.all')}</span>
                </div>
                
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-300">
                      <i className="fas fa-bell-slash mb-2 opacity-20"></i>
                      <p className="text-[9px] font-black uppercase">{t('common.noDefects')}</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => !n.isRead && onMarkAsRead(n.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${n.isRead ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-blue-50 border-blue-100 hover:bg-blue-100/50'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h5 className={`text-[10px] font-black uppercase ${n.isRead ? 'text-slate-400' : 'text-blue-600'}`}>{n.title}</h5>
                          <span className="text-[7px] text-slate-400 font-bold">{new Date(n.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-tight">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{user.firstName} {user.lastName}</span>
              <span className={`text-[9px] font-black uppercase tracking-widest ${user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? 'text-blue-600' : 'text-emerald-600'}`}>
                {user.role}
              </span>
            </div>
            <div className="relative group">
              <button className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-blue-600 hover:shadow-[0_5px_15px_rgba(59,130,246,0.1)] transition-all active:scale-90">
                 <i className="fas fa-user-circle text-slate-400 text-xl"></i>
              </button>
              <div className="absolute right-0 top-14 w-56 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50 transform group-hover:translate-y-0 translate-y-2">
                <div className="px-4 py-3 border-b border-slate-100 mb-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessiya holati</p>
                   <p className="text-xs font-bold text-slate-900">Aktiv (256-bit AES)</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-red-50 text-red-500 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <i className="fas fa-power-off"></i>
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(0.95); } }
      `}</style>
    </header>
  );
};

export default Header;
