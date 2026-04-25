
import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../src/lib/LanguageContext';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden relative">
      {/* Background abstract lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg width="100%" height="100%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,500 Q250,400 500,500 T1000,500" fill="none" stroke="#2563eb" strokeWidth="2" opacity="0.5" />
          <path d="M0,600 Q250,500 500,600 T1000,600" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3" />
          <path d="M0,400 Q250,300 500,400 T1000,400" fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.2" />
        </svg>
      </div>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center relative z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl shadow-lg">
            <i className="fas fa-road text-blue-600 text-xl"></i>
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase">
            Road<span className="text-blue-600">AI</span>
          </span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-bold uppercase tracking-widest text-slate-500">
          <a href="#" className="hover:text-blue-600 transition-colors">Texnologiya</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Xavfsizlik</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Yechimlar</a>
        </div>
        <button 
          onClick={onGetStarted}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-blue-700 hover:shadow-xl transition-all"
        >
          Demo so'rovi
        </button>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          <div className="inline-block px-4 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">
            Neural Vision v2.5.0
          </div>
          <h1 className="text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight">
            Monitoringdan ko'proq narsa: <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">
              Aqlli yo'l himoyasi
            </span>
          </h1>
          <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-xl">
            Integratsiyalashgan Anti-Radar va AI tahlillari yordamida xavflarni aniqlang, infratuzilmani optimallashtiring va xavfsiz bo'ling.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={onGetStarted}
              className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/20"
            >
              Hozir boshlash
            </button>
            <button className="px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
              Batafsil ma'lumot
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative"
        >
          <div className="relative rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] border-8 border-white">
            <img 
              src="https://picsum.photos/seed/highway/1200/800" 
              alt="Smart Highway" 
              className="w-full h-auto"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 to-transparent flex items-end p-12">
              <div className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl w-full border border-white/20">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></div>
                      <span className="text-white text-xs font-black uppercase tracking-widest">AI Monitoring Active</span>
                   </div>
                   <span className="text-white/60 font-mono text-[10px]">96% CONFIDENCE</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-4/5"></div>
                   </div>
                   <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 w-2/3"></div>
                   </div>
                   <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-300 w-1/2"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating elements */}
          <div className="absolute -top-10 -right-10 glass-panel p-6 rounded-3xl shadow-2xl border border-white/20 animate-bounce-slow">
             <i className="fas fa-shield-check text-3xl text-[#00fca8] mb-2"></i>
             <div className="text-[10px] font-black text-white uppercase tracking-widest">Anti-Radar</div>
          </div>
          <div className="absolute -bottom-10 -left-10 glass-panel p-6 rounded-3xl shadow-2xl border border-white/20 animate-pulse">
             <i className="fas fa-brain text-3xl text-[#0ea5e9] mb-2"></i>
             <div className="text-[10px] font-black text-white uppercase tracking-widest">Neural Analysis</div>
          </div>
        </motion.div>
      </main>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#00fca8]">
              <i className="fas fa-eye text-2xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Neyron yo'l ko'rish qobiliyati</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Real vaqt rejimida xavf va chuqurlarni aniqlash. Bizning AI neyron tarmog'imiz yo'l holatini 99% aniqlik bilan tahlil qiladi.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0ea5e9]">
              <i className="fas fa-radar text-2xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Faol Anti-Radar</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              GPS va AI yordamida statsionar va mobil kamera ogohlantirishlari. Haydovchilarni oldindan ogohlantirish orqali xavfsizlikni ta'minlaydi.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-[#fdfd96]">
              <i className="fas fa-chart-line text-2xl text-amber-500"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Aqlli telemetriya</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Tezlik, masofa va xavfsizlikni baholash. Barcha ma'lumotlar real vaqt rejimida tahlil qilinadi va saqlanadi.
            </p>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
