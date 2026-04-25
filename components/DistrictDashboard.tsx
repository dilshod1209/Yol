import React from 'react';
import { motion } from 'motion/react';
import { DistrictMetric } from '../types';

interface DistrictCardProps {
  metric: DistrictMetric;
  onClick: (id: string) => void;
}

const DistrictCard: React.FC<DistrictCardProps> = ({ metric, onClick }) => {
  const getIndexColor = (val: number) => {
    if (val >= 80) return 'text-emerald-400';
    if (val >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={() => onClick(metric.id)}
      className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl cursor-pointer hover:border-blue-500/30 transition-all group relative overflow-hidden"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{metric.name}</h4>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Oxirgi yangilanish: {new Date(metric.lastUpdated).toLocaleDateString()}</p>
        </div>
        <div className={`text-2xl font-black ${getIndexColor(metric.roadQualityIndex)}`}>
          {metric.roadQualityIndex}%
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1.5">
            <span>Yo'l belgilari</span>
            <span className="text-slate-300">{metric.signageCoverage}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${metric.signageCoverage}%` }}
              className="h-full bg-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1.5">
            <span>Yoritish tizimi</span>
            <span className="text-slate-300">{metric.lightingCoverage}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${metric.lightingCoverage}%` }}
              className="h-full bg-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/50 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span className="flex items-center">
          <i className="fas fa-tools mr-2 text-amber-500"></i>
          Ta'mirda: {metric.pendingRepairs}
        </span>
        <i className="fas fa-arrow-right text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
      </div>
    </motion.div>
  );
};

export const DistrictDashboard: React.FC = () => {
  const [districts] = React.useState<DistrictMetric[]>([
    { id: '1', name: 'Mo\'ynoq', roadQualityIndex: 85, signageCoverage: 78, lightingCoverage: 65, pendingRepairs: 12, lastUpdated: Date.now() },
    { id: '2', name: 'Qanliko\'l', roadQualityIndex: 62, signageCoverage: 55, lightingCoverage: 40, pendingRepairs: 28, lastUpdated: Date.now() },
    { id: '3', name: 'Nukus', roadQualityIndex: 92, signageCoverage: 95, lightingCoverage: 88, pendingRepairs: 45, lastUpdated: Date.now() },
    { id: '4', name: 'Ellikqal\'a', roadQualityIndex: 45, signageCoverage: 32, lightingCoverage: 25, pendingRepairs: 64, lastUpdated: Date.now() },
    { id: '5', name: 'Beruniy', roadQualityIndex: 74, signageCoverage: 68, lightingCoverage: 50, pendingRepairs: 19, lastUpdated: Date.now() },
    { id: '6', name: 'To\'rtko\'l', roadQualityIndex: 58, signageCoverage: 48, lightingCoverage: 35, pendingRepairs: 37, lastUpdated: Date.now() },
  ]);

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Hududiy Analitika</h2>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-[0.2em]">Orolbo'yi mintaqasi bo'yicha real vaqt rejimidagi ko'rsatkichlar</p>
        </div>
        <div className="flex space-x-2">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700">
               <i className="fas fa-file-export mr-2"></i> Eksport PDF
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
               <i className="fas fa-plus mr-2"></i> Hudud qo'shish
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {districts.map((d) => (
          <DistrictCard key={d.id} metric={d} onClick={() => {}} />
        ))}
      </div>

      <div className="bg-blue-600/5 border border-blue-500/20 p-8 rounded-[2.5rem] relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]"></div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8">
                <h3 className="text-xl font-black text-white uppercase mb-3">Tizimli Statistik Hisobot</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">Barcha hududlar bo'yicha umumlashtirilgan ma'lumotlar AI tomonidan tahlil qilinmoqda. Yo'l belgilarini yangilash ustuvorligi: <span className="text-blue-400">Ellikqal'a (92%)</span>, <span className="text-blue-400">Qanliko'l (88%)</span>.</p>
            </div>
            <div className="lg:col-span-4 flex justify-end">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col items-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Umumiy Sifat</p>
                    <div className="text-4xl font-black text-emerald-500">69.3%</div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
