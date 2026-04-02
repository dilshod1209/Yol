
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import MapDisplay from './components/MapDisplay';
import LiveVision from './components/LiveVision';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';
import LoginForm from './components/LoginForm';
import { analyzeRoadIssue } from './geminiService';
import { Report, LocationData, AnalysisResult, RoadHealth, User, UserRole, RouteData, ReportStatus, Notification, DefectType } from './types';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  getDocFromServer,
  getDocs,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [activeView, setActiveView] = useState<'monitor' | 'profile' | 'admin'>('monitor');
  const [activeTab, setActiveTab] = useState<'live' | 'manual'>('live');
  const [reports, setReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startLocation, setStartLocation] = useState<LocationData | null>(null);
  const [endLocation, setEndLocation] = useState<LocationData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  const [trafficLightAlert, setTrafficLightAlert] = useState<string | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<any[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<any[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock traffic lights in Tashkent
  const mockTrafficLights = [
    { id: 'tl1', lat: 41.3111, lng: 69.2797, name: 'Amir Temur xiyoboni' },
    { id: 'tl2', lat: 41.3275, lng: 69.2825, name: 'Minor metrosi' },
    { id: 'tl3', lat: 41.2995, lng: 69.2401, name: 'Bunyodkor stadioni' },
    { id: 'tl4', lat: 41.3100, lng: 69.2400, name: 'Paxtakor metrosi' },
  ];

  // Voice synthesis for alerts
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'uz-UZ';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Traffic light distance check
  useEffect(() => {
    if (!currentLocation) return;

    const checkDistance = () => {
      mockTrafficLights.forEach(tl => {
        const dist = getDistance(currentLocation.lat, currentLocation.lng, tl.lat, tl.lng);
        if (dist <= 150 && dist > 0) {
          const alertMsg = `Diqqat! 150 metr masofada svetafor bor: ${tl.name}. Svetafor qizil bo'lishi mumkin.`;
          if (trafficLightAlert !== tl.id) {
            setTrafficLightAlert(tl.id);
            speak(alertMsg);
            // Clear alert after 10 seconds to allow re-triggering later
            setTimeout(() => setTrafficLightAlert(null), 10000);
          }
        }
      });
    };

    const interval = setInterval(checkDistance, 5000);
    return () => clearInterval(interval);
  }, [currentLocation, trafficLightAlert]);

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Address suggestions
  useEffect(() => {
    const fetchSuggestions = async (query: string, setSuggestions: (s: any[]) => void) => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=uz&limit=5`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.warn("Suggestions fetch error:", err);
      }
    };

    const timer1 = setTimeout(() => fetchSuggestions(startQuery, setStartSuggestions), 500);
    return () => clearTimeout(timer1);
  }, [startQuery]);

  useEffect(() => {
    const fetchSuggestions = async (query: string, setSuggestions: (s: any[]) => void) => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=uz&limit=5`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.warn("Suggestions fetch error:", err);
      }
    };

    const timer2 = setTimeout(() => fetchSuggestions(endQuery, setEndSuggestions), 500);
    return () => clearTimeout(timer2);
  }, [endQuery]);

  const handleSelectSuggestion = (suggestion: any, type: 'start' | 'end') => {
    const location = { lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) };
    if (type === 'start') {
      setStartQuery(suggestion.display_name);
      setStartLocation(location);
      setStartSuggestions([]);
    } else {
      setEndQuery(suggestion.display_name);
      setEndLocation(location);
      setEndSuggestions([]);
    }
  };

  // Test connection to Firestore
  useEffect(() => {
    const testConnection = async () => {
      try {
        // Removed test read that was causing permission denied errors
      } catch (error) {
        // Ignore
      }
    };
    testConnection();
  }, []);

  const handleDemoAdminLogin = () => {
    const demoAdmin: User = {
      id: 'demo-admin',
      firstName: 'Tizim',
      lastName: 'Admini',
      email: 'admin@road.ai',
      phone: '+998901234567',
      role: UserRole.ADMIN,
      region: 'Toshkent',
      district: 'Yunusobod',
      createdAt: Date.now()
    };
    setCurrentUser(demoAdmin);
    setIsDemoAdmin(true);
    setActiveView('admin');
  };

  useEffect(() => {
    let unsubUserDoc: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (isDemoAdmin) return; // Don't override demo admin

      if (firebaseUser) {
        // Update online status
        updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true });
        
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden') {
            updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: false });
          } else {
            updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true });
          }
        };
        const handleBeforeUnload = () => {
          updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: false, isCameraActive: false });
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Listen to user document changes in real-time
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubUserDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: firebaseUser.uid, ...docSnap.data() } as User;
            setCurrentUser(userData);
            if (userData.role === UserRole.ADMIN) {
              setActiveView('admin');
            }
          } else {
            setCurrentUser(null);
          }
          setIsAuthReady(true);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setIsAuthReady(true);
        });

        return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('beforeunload', handleBeforeUnload);
          unsubUserDoc();
        };
      } else {
        unsubUserDoc();
        setCurrentUser(null);
        setIsAuthReady(true);
      }
    });

    let geoId: number;
    if (navigator.geolocation) {
      geoId = navigator.geolocation.watchPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Joylashuv xatosi:", err),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (auth.currentUser && !isDemoAdmin) {
        updateDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false, isCameraActive: false });
      }
      unsubscribeAuth();
      unsubUserDoc();
      if (geoId) navigator.geolocation.clearWatch(geoId);
    };
  }, [isDemoAdmin]);

  // Track camera status and notify admin
  useEffect(() => {
    if (currentUser && !isDemoAdmin && auth.currentUser) {
      const isCameraNowActive = activeTab === 'live' && activeView === 'monitor';
      updateDoc(doc(db, 'users', auth.currentUser.uid), { isCameraActive: isCameraNowActive });
      
      if (isCameraNowActive) {
        // Notify admin about active camera
        addDoc(collection(db, 'notifications'), {
          userId: 'admin', // Special ID for admin notifications
          title: "Kamera faollashtirildi",
          message: `${currentUser.firstName} ${currentUser.lastName} kamerani yoqdi.`,
          timestamp: Date.now(),
          isRead: false,
          type: 'camera_active',
          userPhone: currentUser.phone
        }).catch(err => console.error("Admin notification failed:", err));
      }
    }
  }, [activeTab, activeView, currentUser, isDemoAdmin]);

  // Real-time synchronization
  useEffect(() => {
    if (!currentUser || !auth.currentUser) return;

    // Reports
    const reportsQuery = currentUser.role === UserRole.ADMIN 
      ? query(collection(db, 'reports'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'reports'), where('userId', '==', currentUser.id), orderBy('timestamp', 'desc'));

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(reportsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    // Notifications
    const notificationIds = [currentUser.id, 'global'];
    if (currentUser.role === UserRole.ADMIN) {
      notificationIds.push('admin');
    }
    const notificationsQuery = query(
      collection(db, 'notifications'), 
      where('userId', 'in', notificationIds), 
      orderBy('timestamp', 'desc')
    );

    const unsubNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notificationsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    // Users (Admin only)
    let unsubUsers = () => {};
    if (currentUser.role === UserRole.ADMIN) {
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(usersData.filter(u => u.role !== UserRole.ADMIN));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => {
      unsubReports();
      unsubNotifications();
      unsubUsers();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    if (isDemoAdmin) {
      setCurrentUser(null);
      setIsDemoAdmin(false);
      setActiveView('monitor');
    } else {
      await signOut(auth);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: ReportStatus) => {
    if (!auth.currentUser) {
      alert("Demo Admin rejimida statusni o'zgartirish imkonsiz.");
      return;
    }
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === ReportStatus.IN_REPAIR) {
        updateData.repairStartedAt = Date.now();
      } else if (newStatus === ReportStatus.FIXED) {
        updateData.fixedAt = Date.now();
      }

      await updateDoc(doc(db, 'reports', reportId), updateData);
      
      // Notify user
      const report = reports.find(r => r.id === reportId);
      if (report) {
        await addDoc(collection(db, 'notifications'), {
          userId: report.userId,
          title: "Hisobot holati o'zgardi",
          message: `Sizning hisobotingiz holati "${newStatus}" ga o'zgardi.`,
          timestamp: Date.now(),
          isRead: false,
          type: 'status_change'
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reports/notifications');
    }
  };

  const submitReport = async (id: string) => {
    if (!auth.currentUser) {
      alert("Demo rejimida hisobot yuborish imkonsiz.");
      return;
    }
    try {
      await updateDoc(doc(db, 'reports', id), { status: ReportStatus.SUBMITTED });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    }
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !auth.currentUser) {
      alert("Iltimos, tizimga kiring.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!manualLocation) {
      alert("Iltimos, avval joylashuvni kiriting.");
      return;
    }

    setIsAnalyzing(true);
    setQuotaError(false);
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const analysis = await analyzeRoadIssue(base64);
          setLastAnalysis(analysis);

          // Upload image to Storage
          const storageRef = ref(storage, `reports/${currentUser.id}/${Date.now()}.jpg`);
          await uploadString(storageRef, base64, 'data_url');
          const downloadURL = await getDownloadURL(storageRef);

          await addDoc(collection(db, 'reports'), {
            userId: currentUser.id,
            userName: `${currentUser.firstName} ${currentUser.lastName}`,
            image: downloadURL,
            location: currentLocation || { lat: 41.2995, lng: 69.2401 },
            address: manualLocation,
            description: manualDescription,
            analysis,
            timestamp: Date.now(),
            status: ReportStatus.DRAFT,
            region: currentUser.region || 'Toshkent shahri'
          });

          alert("Rasm yuklandi va tahlil qilindi! Uni profil bo'limidan ko'rishingiz mumkin.");
          setManualLocation('');
          setManualDescription('');
        } catch (err: any) {
          if (err.message === "QUOTA_EXHAUSTED") setQuotaError(true);
          else {
            handleFirestoreError(err, OperationType.CREATE, 'reports');
            alert("Rasm tahlilida xatolik.");
          }
        } finally {
          setIsAnalyzing(false);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      setIsUploading(false);
    }
  };

  const handleLiveUpdate = async (result: AnalysisResult, frame: string) => {
    setLastAnalysis(result);
    // Auto-save if defect found
    if (result.health !== RoadHealth.EXCELLENT && result.type !== DefectType.SMOOTH) {
      handleSaveReport(result, frame);
    }
  };

  const deleteReport = async (id: string) => {
    if (!auth.currentUser) {
      alert("Demo rejimida o'chirish imkonsiz.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'reports', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reports/${id}`);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!auth.currentUser) {
      alert("Demo rejimida foydalanuvchini o'chirish imkonsiz.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const toggleUserBlock = async (userId: string) => {
    if (!auth.currentUser) {
      alert("Demo rejimida bloklash imkonsiz.");
      return;
    }
    try {
      const user = users.find(u => u.id === userId);
      if (user) {
        await updateDoc(doc(db, 'users', userId), { isBlocked: !user.isBlocked });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const sendGlobalNotification = async (title: string, message: string) => {
    if (!auth.currentUser) {
      alert("Demo Admin rejimida xabarlar yuborish imkonsiz. Iltimos, haqiqiy admin akkaunti bilan kiring.");
      return;
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'global',
        title,
        message,
        timestamp: Date.now(),
        isRead: false,
        type: 'admin_broadcast'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications/global');
      throw err;
    }
  };

  const handleSearchAddress = async (e: React.FormEvent, type: 'start' | 'end' | 'single' = 'single') => {
    e.preventDefault();
    const query = type === 'start' ? startQuery : type === 'end' ? endQuery : searchQuery;
    if (!query.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);

    const tryGeocode = async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data && data.length > 0 ? data : null;
      } catch (err) {
        console.warn(`Geocoding failed for ${url}:`, err);
        return null;
      }
    };

    try {
      let data = null;
      const googleKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;

      // 1. Try Google Maps if key is available
      if (googleKey && googleKey !== 'YOUR_API_KEY') {
        try {
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleKey}`);
          const gData = await res.json();
          if (gData.status === 'OK' && gData.results.length > 0) {
            data = [{
              lat: gData.results[0].geometry.location.lat,
              lon: gData.results[0].geometry.location.lng,
              display_name: gData.results[0].formatted_address
            }];
          }
        } catch (err) {
          console.warn("Google Geocoding failed:", err);
        }
      }

      // 2. Try Nominatim
      if (!data) {
        data = await tryGeocode(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      }

      // 3. Try geocode.maps.co
      if (!data) {
        data = await tryGeocode(`https://geocode.maps.co/search?q=${encodeURIComponent(query)}`);
      }

      if (data && data.length > 0) {
        const loc = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon || data[0].lng),
          address: data[0].display_name
        };
        if (type === 'start') {
          setStartLocation(loc);
        } else if (type === 'end') {
          setEndLocation(loc);
          setDestination(loc);
        } else {
          setDestination(loc);
        }
      } else {
        setSearchError("Manzil topilmadi. Iltimos, qaytadan urinib ko'ring.");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Qidiruvda xatolik yuz berdi. Iltimos, internet aloqasini tekshiring.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveReport = async (analysis: AnalysisResult, image: string) => {
    if (!currentUser || !auth.currentUser) {
      alert("Iltimos, tizimga kiring.");
      return;
    }
    
    try {
      // Upload image to Storage
      const storageRef = ref(storage, `reports/${currentUser.id}/${Date.now()}.jpg`);
      await uploadString(storageRef, image, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'reports'), {
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        image: downloadURL,
        location: currentLocation || { lat: 41.2995, lng: 69.2401 },
        analysis,
        timestamp: Date.now(),
        status: ReportStatus.DRAFT,
        region: currentUser.region || 'Toshkent shahri'
      });
      
      alert("Hisobot saqlandi! Uni profil bo'limidan yuborishingiz mumkin.");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
      alert("Hisobotni saqlashda xatolik.");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) return <LoginForm onDemoAdminLogin={handleDemoAdminLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500/30">
      <Header 
        user={currentUser} 
        onLogout={handleLogout} 
        notifications={notifications}
        onMarkAsRead={markNotificationAsRead}
      />
      
      <div className="bg-white/80 border-b border-slate-200 sticky top-16 z-40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 flex space-x-6">
          {currentUser.role !== UserRole.ADMIN && (
            <>
              <button 
                onClick={() => {
                  setActiveView('monitor');
                  setIsMapExpanded(false);
                }} 
                className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center ${activeView === 'monitor' && !isMapExpanded ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <i className="fas fa-satellite-dish mr-2 text-sm"></i> Monitoring
              </button>
              <button 
                onClick={() => {
                  setActiveView('monitor');
                  setIsMapExpanded(true);
                }} 
                className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center ${activeView === 'monitor' && isMapExpanded ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <i className="fas fa-route mr-2 text-sm"></i> Navigatsiya
              </button>
              <button onClick={() => setActiveView('profile')} className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center ${activeView === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <i className="fas fa-id-card mr-2 text-sm"></i> Profil
              </button>
            </>
          )}
          {currentUser.role === UserRole.ADMIN && (
            <button onClick={() => setActiveView('admin')} className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center ${activeView === 'admin' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              <i className="fas fa-shield-halved mr-2 text-sm"></i> Admin Panel
            </button>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {quotaError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-3 text-red-500">
              <i className="fas fa-triangle-exclamation text-xl"></i>
              <p className="text-sm font-black uppercase tracking-widest">AI Limitiga yetildi. Iltimos biroz kuting (429 Error).</p>
            </div>
            <button onClick={() => setQuotaError(false)} className="text-red-500/50 hover:text-red-500"><i className="fas fa-xmark"></i></button>
          </div>
        )}

        {activeView === 'profile' && <UserProfile user={currentUser} userReports={reports} onDelete={deleteReport} onSubmit={submitReport} />}
        {activeView === 'admin' && (
          <AdminPanel 
            allReports={reports} 
            onDelete={deleteReport} 
            onUpdateStatus={updateReportStatus}
            users={users}
            onToggleBlock={toggleUserBlock}
            onDeleteUser={deleteUser}
            onSendGlobalNotification={sendGlobalNotification}
            currentLocation={currentLocation}
            notifications={notifications}
          />
        )}

        {activeView === 'monitor' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[700px]">
            <AnimatePresence mode="wait">
              {!isMapExpanded && (
                <motion.div 
                  key="monitoring-panel"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="lg:col-span-7 flex flex-col space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                      <button 
                        onClick={() => setActiveTab('live')} 
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'live' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <i className="fas fa-video mr-2"></i> Kamera
                      </button>
                      <button 
                        onClick={() => setActiveTab('manual')} 
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <i className="fas fa-cloud-arrow-up mr-2"></i> Fayl Yuklash
                      </button>
                    </div>
                    <div className="flex items-center space-x-4 bg-white/50 px-4 py-2 rounded-2xl border border-slate-200">
                       <div className="flex flex-col text-right">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">AI Skaner</span>
                          <span className={`text-[10px] font-bold ${quotaError ? 'text-red-500' : 'text-emerald-600 animate-pulse'}`}>{quotaError ? 'TO\'XTADI' : 'AKTIV'}</span>
                       </div>
                       <div className={`w-8 h-8 rounded-full ${quotaError ? 'bg-red-500/10' : 'bg-emerald-500/10'} flex items-center justify-center border ${quotaError ? 'border-red-500/20' : 'border-emerald-500/20'}`}>
                          <i className={`fas ${quotaError ? 'fa-triangle-exclamation text-red-500' : 'fa-brain text-emerald-500'} text-xs`}></i>
                       </div>
                    </div>
                  </div>

                  {activeTab === 'manual' && (
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-fade-in">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                          <i className="fas fa-file-image text-xl"></i>
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Rasm yuklash orqali tahlil</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Joylashuv va tavsifni kiriting</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="relative">
                          <i className="fas fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                          <input 
                            type="text"
                            placeholder="Yo'l nomi yoki manzil (Masalan: Amir Temur ko'chasi)"
                            value={manualLocation}
                            onChange={(e) => setManualLocation(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 focus:outline-none focus:border-red-500 transition-all font-medium"
                          />
                        </div>
                        <div className="relative">
                          <i className="fas fa-align-left absolute left-4 top-4 text-slate-400 text-xs"></i>
                          <textarea 
                            placeholder="Qo'shimcha tavsif (ixtiyoriy)"
                            value={manualDescription}
                            onChange={(e) => setManualDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 focus:outline-none focus:border-red-500 transition-all font-medium resize-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || !manualLocation}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-600/20 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
                      >
                        {isUploading ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                          <>
                            <i className="fas fa-cloud-arrow-up"></i>
                            Rasm tanlash va yuklash
                          </>
                        )}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleManualUpload} className="hidden" accept="image/*" />
                    </div>
                  )}

                  <div className={`relative group ${activeTab === 'manual' ? 'hidden' : ''}`}>
                    <LiveVision 
                      isActive={activeTab === 'live'} 
                      onAnalysisUpdate={handleLiveUpdate} 
                      onSave={handleSaveReport}
                      onError={(msg) => msg === "QUOTA_EXHAUSTED" && setQuotaError(true)} 
                    />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-[2rem]">
                        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-xs">Neural Tahlil...</p>
                      </div>
                    )}
                  </div>

                  {lastAnalysis && (
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden animate-slide-up group">
                      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-colors"></div>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
                        <div className="flex items-center space-x-5">
                          <div className={`text-2xl font-black px-6 py-2.5 rounded-2xl text-white ${lastAnalysis.health === RoadHealth.POOR ? 'bg-red-500 shadow-[0_10px_30px_rgba(239,68,68,0.2)]' : 'bg-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.2)]'}`}>
                            {lastAnalysis.health}
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{lastAnalysis.type}</h2>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Aniqlangan Yo'l Holati</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-100 flex items-center space-x-3">
                           <i className="fas fa-triangle-exclamation text-amber-500"></i>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xavf:</span>
                           <span className="text-sm font-black text-slate-900">{lastAnalysis.severity}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                            <i className="fas fa-file-invoice mr-2"></i> To'liq Tavsif
                          </p>
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{lastAnalysis.description}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center">
                            <i className="fas fa-shield-heart mr-2"></i> Xavfsizlik Tavsiyasi
                          </p>
                          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                            <p className="text-sm text-blue-600 leading-relaxed font-bold italic">"{lastAnalysis.recommendation}"</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              layout
              className={`${isMapExpanded ? 'lg:col-span-12' : 'lg:col-span-5'} flex flex-col space-y-6`}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center">
                    <i className="fas fa-map-location-dot mr-3 text-blue-600"></i> Smart Navigator
                  </h3>
                  <div className="flex items-center space-x-2">
                    {isMapExpanded && (
                      <button 
                        onClick={() => setIsMapExpanded(false)}
                        className="text-[9px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors flex items-center"
                      >
                        <i className="fas fa-compress mr-2"></i> Monitoringga qaytish
                      </button>
                    )}
                    {routeInfo && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">Optimal Yo'l Topildi</span>}
                  </div>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={startQuery}
                      onFocus={() => setIsMapExpanded(true)}
                      onChange={(e) => setStartQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress(e as any, 'start')}
                      placeholder="Qayerdan? (Masalan: Mening joylashuvim)" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition-all font-medium"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
                      <i className="fas fa-circle-dot text-xs"></i>
                    </span>
                    {startSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-2xl mt-2 shadow-2xl z-50 overflow-hidden">
                        {startSuggestions.map((s, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSelectSuggestion(s, 'start')}
                            className="w-full text-left px-6 py-4 text-xs font-medium hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={endQuery}
                      onFocus={() => setIsMapExpanded(true)}
                      onChange={(e) => setEndQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress(e as any, 'end')}
                      placeholder="Qayerga borasiz?" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition-all font-medium"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500">
                      <i className="fas fa-location-dot"></i>
                    </span>
                    {endSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-2xl mt-2 shadow-2xl z-50 overflow-hidden">
                        {endSuggestions.map((s, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSelectSuggestion(s, 'end')}
                            className="w-full text-left px-6 py-4 text-xs font-medium hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      handleSearchAddress(e as any, 'start');
                      handleSearchAddress(e as any, 'end');
                    }}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                  >
                    {isSearching ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-route mr-2"></i>}
                    Yo'lni aniqlash
                  </button>
                  {searchError && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl animate-fade-in">
                      <p className="text-xs text-red-600 font-bold flex items-center">
                        <i className="fas fa-circle-exclamation mr-2"></i> {searchError}
                      </p>
                    </div>
                  )}
                </div>
                {routeInfo && (
                  <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Umumiy Masofa</p>
                      <p className="text-3xl font-black text-slate-900">{(routeInfo.distance / 1000).toFixed(1)} <span className="text-xs text-slate-400 uppercase">km</span></p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Harakat Vaqti</p>
                      <p className="text-3xl font-black text-emerald-600">{Math.ceil(routeInfo.duration / 60)} <span className="text-xs text-slate-400 uppercase">daq</span></p>
                    </div>
                  </div>
                )}
              </div>
              <motion.div 
                layout
                className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden flex-grow shadow-2xl relative min-h-[400px]"
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {currentLocation && (
                  <MapDisplay 
                    currentLocation={currentLocation} 
                    origin={startLocation}
                    destination={destination} 
                    onRouteFound={setRouteInfo} 
                  />
                )}
              </motion.div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
