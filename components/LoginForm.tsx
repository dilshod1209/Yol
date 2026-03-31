
import React, { useState } from 'react';
import { UserRole } from '../types';
import { regions, districts } from '../src/uzbekistanData';
import { auth, db } from '../firebase';
import { 
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';

interface LoginFormProps {
  onDemoAdminLogin: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onDemoAdminLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile fields
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Special admin bypass
    if (email === 'admin' && password === 'admin') {
      onDemoAdminLogin();
      return;
    }

    setLoading(true);
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        setTempUser(result.user);
        setShowProfileSetup(true);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') setError("Foydalanuvchi topilmadi.");
      else if (err.code === 'auth/wrong-password') setError("Noto'g'ri parol.");
      else if (err.code === 'auth/email-already-in-use') setError("Bu email band.");
      else setError("Xatolik yuz berdi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        if (userDoc.data().isBlocked) {
          await auth.signOut();
          setError("Sizning hisobingiz bloklangan.");
        }
        // App.tsx will handle the redirect
      } else {
        // New user - need profile info
        setTempUser(user);
        setShowProfileSetup(true);
      }
    } catch (err: any) {
      console.error(err);
      setError("Kirishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    
    setLoading(true);
    try {
      const userData = {
        firstName: tempUser.displayName?.split(' ')[0] || '',
        lastName: tempUser.displayName?.split(' ').slice(1).join(' ') || '',
        email: tempUser.email,
        region,
        district,
        phone,
        role: UserRole.USER,
        isBlocked: false,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', tempUser.uid), userData);
      // App.tsx will handle the rest
    } catch (err) {
      console.error(err);
      setError("Profilni saqlashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-600/20 mb-6">
              <i className="fas fa-road text-white text-3xl"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-2">
              Road<span className="text-blue-600">AI</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              Yo'l monitoringi platformasi
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-500 text-xs font-bold mb-8 flex items-center">
              <i className="fas fa-circle-exclamation mr-3"></i>
              {error}
            </div>
          )}

          {!showProfileSetup ? (
            <div className="space-y-6">
              <form onSubmit={handleManualLogin} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="text"
                      placeholder="Email yoki login"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="relative">
                    <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="password"
                      placeholder="Parol"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
                >
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : (isRegistering ? "Ro'yxatdan o'tish" : "Kirish")}
                </button>
              </form>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Yoki</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-sm"
              >
                {loading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    <span>Google orqali kirish</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button 
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  {isRegistering ? "Akkauntingiz bormi? Kirish" : "Yangi akkaunt ochish (Register)"}
                </button>
              </div>

              <p className="text-center text-[10px] text-slate-400 font-medium px-6">
                Tizimga kirish orqali siz foydalanish shartlariga rozilik bildirasiz.
              </p>
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <p className="text-sm font-bold text-slate-700 mb-4 text-center">Profil ma'lumotlarini to'ldiring</p>
              
              <div className="grid grid-cols-1 gap-4">
                <select
                  required
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all font-medium"
                >
                  <option value="">Viloyatni tanlang</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all font-medium"
                >
                  <option value="">Tumanni tanlang</option>
                  {region && districts[region as keyof typeof districts]?.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <input
                  type="tel"
                  placeholder="Telefon raqami (+998...)"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 uppercase tracking-widest text-xs mt-4"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Davom etish'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginForm;
