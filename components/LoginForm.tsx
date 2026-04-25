
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
import { useLanguage } from '../src/lib/LanguageContext';

interface LoginFormProps {
  onDemoAdminLogin: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onDemoAdminLogin }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  
  // Login fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Special admin bypass with Firebase authentication
    if ((phone === 'admin' || phone === 'admin@system.com' || phone === 'admin@road.ai') && password === 'admin') {
      setLoading(true);
      try {
        onDemoAdminLogin();
      } catch (err: any) {
        console.error("Admin login failed:", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      
      // Map phone to a dummy email for Firebase Auth
      const safePhone = phone.replace(/[^a-zA-Z0-9]/g, '');
      if (!safePhone) {
        setError("Iltimos, haqiqiy telefon raqamini kiriting.");
        setLoading(false);
        return;
      }
      const dummyEmail = `${safePhone}@road.ai`;

      if (isRegistering) {
        if (!firstName || !lastName || !region || !district || !phone || !password) {
          setError("Iltimos, barcha maydonlarni to'ldiring.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("Maxfiy kod kamida 6 ta belgidan iborat bo'lishi kerak.");
          setLoading(false);
          return;
        }

        const result = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        const user = result.user;

        const userData = {
          id: user.uid,
          firstName,
          lastName,
          email: dummyEmail,
          phone,
          region,
          district,
          role: UserRole.USER,
          isBlocked: false,
          personalCode: password,
          createdAt: Date.now()
        };

        await setDoc(doc(db, 'users', user.uid), userData);
      } else {
        await signInWithEmailAndPassword(auth, dummyEmail, password);
      }
    } catch (err: any) {
      console.error("Auth Error Code:", err.code);
      console.error("Auth Error Message:", err.message);
      
      const errorCode = err.code;
      
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
        setError("Telefon raqami yoki kod noto'g'ri.");
      } else if (errorCode === 'auth/wrong-password') {
        setError("Noto'g'ri kod.");
      } else if (errorCode === 'auth/invalid-email') {
        setError("Telefon raqami formati noto'g'ri.");
      } else if (errorCode === 'auth/email-already-in-use') {
        setError("Bu telefon raqami allaqachon ro'yxatdan o'tgan.");
      } else if (errorCode === 'auth/weak-password') {
        setError("Kod juda oddiy (kamida 6 belgi kerak).");
      } else if (errorCode === 'auth/too-many-requests') {
        setError("Ko'p marta xato urinishlar bo'ldi. Birozdan keyin qayta urunib ko'ring.");
      } else if (errorCode === 'auth/operation-not-allowed') {
        setError("Tizimda email/parol orqali kirish yoqilmagan. Firebase Console'da uni yoqing.");
      } else {
        setError("Kirishda xatolik: " + (err.code || "Noma'lum xatolik"));
      }
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
      } else {
        // New user from Google - still need region/district
        setTempUser(user);
        setShowProfileSetup(true);
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Kirish oynasi yopildi.");
      } else if (err.code === 'auth/invalid-credential') {
        setError("Google hisobi orqali kirishda xatolik yuz berdi.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignore parallel popup requests
      } else {
        setError("Kirishda xatolik yuz berdi: " + (err.code || "Noma'lum"));
      }
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
        phone: phone || '', // Use the phone if they provided it
        region,
        district,
        role: UserRole.USER,
        isBlocked: false,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', tempUser.uid), userData);
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
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl shadow-lg mb-6">
              <i className="fas fa-road text-blue-600 text-3xl"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-2">
              Road<span className="text-blue-600">AI</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              {t('common.monitoring')} platformasi
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-500 text-xs font-bold mb-8 flex items-center">
              <i className="fas fa-circle-exclamation mr-3 text-red-400"></i>
              {error}
            </div>
          )}

          {!showProfileSetup ? (
            <div className="space-y-6">
              <form onSubmit={handleManualLogin} className="space-y-4">
                <div className="space-y-3">
                  {isRegistering && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                          <input
                            type="text"
                            placeholder={t('common.name')}
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                          />
                        </div>
                        <div className="relative">
                          <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                          <input
                            type="text"
                            placeholder={t('common.surname')}
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <select
                          required
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-xs text-slate-500 focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                        >
                          <option value="">{t('common.region')}</option>
                          {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select
                          required
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-xs text-slate-500 focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                        >
                          <option value="">{t('common.district')}</option>
                          {region && districts[region as keyof typeof districts]?.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="relative">
                    <i className="fas fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                    <input
                      type="text"
                      placeholder={t('common.phone')}
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="relative">
                    <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                    <input
                      type="password"
                      placeholder={isRegistering ? "Kod yarating" : "Kod"}
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
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/10 transition-all active:scale-95 uppercase tracking-widest text-xs"
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
                className="w-full flex items-center justify-center space-x-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-sm"
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
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                  }}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  {isRegistering ? "Akkauntingiz bormi? Kirish" : "Yangi akkaunt ochish (Register)"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <p className="text-sm font-bold text-slate-500 mb-4 text-center">Profil ma'lumotlarini to'ldiring</p>
              
              <div className="grid grid-cols-1 gap-4">
                <select
                  required
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-600 focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="">{t('common.region')}</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-600 focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="">{t('common.district')}</option>
                  {region && districts[region as keyof typeof districts]?.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <input
                  type="tel"
                  placeholder={t('common.phone')}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/10 transition-all active:scale-95 uppercase tracking-widest text-xs mt-4"
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
