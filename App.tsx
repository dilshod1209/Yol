
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import MapDisplay from './components/MapDisplay';
import LiveVision from './components/LiveVision';
import UserProfile from './components/UserProfile';
import CommandCenter from './components/CommandCenter';
import LoginForm from './components/LoginForm';
import LandingPage from './components/LandingPage';
import { analyzeRoadIssue } from './geminiService';
import { Report, LocationData, AnalysisResult, RoadHealth, User, UserRole, RouteData, ReportStatus, Notification, DefectType, Severity, Language } from './types';
import { useLanguage } from './src/lib/LanguageContext';
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
  setDoc,
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

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const trafficData = [
  { time: '00:00', value: 30 },
  { time: '04:00', value: 15 },
  { time: '08:00', value: 85 },
  { time: '12:00', value: 65 },
  { time: '16:00', value: 95 },
  { time: '20:00', value: 50 },
  { time: '23:59', value: 25 },
];

const App: React.FC = () => {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [activeView, setActiveView] = useState<'monitor' | 'navigator' | 'profile' | 'admin'>('monitor');
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
  const [manualLocation, setManualLocation] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

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
      window.speechSynthesis.cancel();
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
      id: auth.currentUser?.uid || 'demo-admin',
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
        setDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true }, { merge: true });
        
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden') {
            setDoc(doc(db, 'users', firebaseUser.uid), { isOnline: false }, { merge: true });
          } else {
            setDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true }, { merge: true });
          }
        };
        const handleBeforeUnload = () => {
          setDoc(doc(db, 'users', firebaseUser.uid), { isOnline: false, isCameraActive: false }, { merge: true });
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
        setDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false, isCameraActive: false }, { merge: true });
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
      setDoc(doc(db, 'users', auth.currentUser.uid), { isCameraActive: isCameraNowActive }, { merge: true });
      
      if (isCameraNowActive) {
        // Notify admin about active camera
        addDoc(collection(db, 'notifications'), {
          userId: 'admin', // Special ID for admin notifications
          title: "Kamera faollashtirildi",
          message: `${currentUser.firstName} ${currentUser.lastName} kamerani yoqdi.`,
          timestamp: Date.now(),
          isRead: false,
          type: 'camera_active',
          userPhone: currentUser.phone || 'Noma\'lum'
        }).catch(err => console.error("Admin notification failed:", err));
      }
    }
  }, [activeTab, activeView, currentUser, isDemoAdmin]);

  // Real-time synchronization
  useEffect(() => {
    if (!currentUser) return;

    // Set up listeners. Note: auth.currentUser check removed to allow Demo Admin (who is now Firebase authenticated as well)
    // but we still want to be safe. If they are not real Firebase users, Firestore will deny access anyway.

    // Reports
    const reportsQuery = currentUser.role === UserRole.ADMIN 
      ? query(collection(db, 'reports'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'reports'), where('userId', '==', currentUser.id), orderBy('timestamp', 'desc'));

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(reportsData);
    }, (error) => {
      // Supress errors for demo mode to keep UI clean, but log for real users
      if (!isDemoAdmin) handleFirestoreError(error, OperationType.LIST, 'reports');
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
      if (!isDemoAdmin) handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    // Users (Admin only)
    let unsubUsers = () => {};
    if (currentUser.role === UserRole.ADMIN) {
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        // Show all users. Filter out self if preferred, but usually keep for management.
        // We'll show all users so the admin can see everyone registered.
        setUsers(usersData.filter(u => u.id !== currentUser.id));
      }, (error) => {
        if (!isDemoAdmin) handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => {
      unsubReports();
      unsubNotifications();
      unsubUsers();
    };
  }, [currentUser, isDemoAdmin]);

  const handleLogout = async () => {
    if (isDemoAdmin) {
      setCurrentUser(null);
      setIsDemoAdmin(false);
      setActiveView('monitor');
      showToast("Tizimdan chiqildi (Demo)", "info");
    } else {
      await signOut(auth);
      showToast("Tizimdan chiqildi", "info");
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

  const markAllNotificationsAsRead = async () => {
    if (!auth.currentUser) return;
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications/all');
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

  const submitReport = async (id: string, address?: string) => {
    if (!auth.currentUser) {
      alert("Demo rejimida hisobot yuborish imkonsiz.");
      return;
    }
    try {
      const updateData: any = { status: ReportStatus.SUBMITTED };
      if (address) {
        updateData.address = address;
      }
      await updateDoc(doc(db, 'reports', id), updateData);
      
      // Notify Admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: "Yangi hisobot kelib tushdi",
        message: `${currentUser?.firstName} ${currentUser?.lastName} yangi nosozlik haqida hisobot yubordi.`,
        timestamp: Date.now(),
        isRead: false,
        type: 'new_report'
      });

      alert("Hisobot muvaffaqiyatli yuborildi! Endi uni admin ko'ra oladi.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
      alert("Hisobotni yuborishda xatolik yuz berdi.");
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
            showToast("Rasm tahlilida xatolik.", "error");
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
    
    // Voice alert for defects
    if (result.type !== DefectType.SMOOTH && result.type !== DefectType.UNKNOWN) {
      const speak = (text: string) => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'uz-UZ';
          window.speechSynthesis.speak(utterance);
        }
      };
      speak("Yo'lda nosozlik");
    }

    // Save every analysis result to profile as requested
    handleSaveReport(result, frame);
  };

  const deleteReport = async (id: string) => {
    if (!auth.currentUser) {
      showToast("Demo rejimida o'chirish imkonsiz.", "error");
      return;
    }
    try {
      await deleteDoc(doc(db, 'reports', id));
      showToast("Hisobot o'chirildi.", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reports/${id}`);
      showToast("Hisobotni o'chirishda xatolik.", "error");
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

  const sendTelegramNotification = async (message: string) => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      });
    } catch (err) {
      console.error("Telegram notification error:", err);
    }
  };

  const handleSaveReport = async (analysis: AnalysisResult, image: string) => {
    if (!currentUser) return;

    // If demo admin, just add to local state for visualization
    if (isDemoAdmin) {
      const demoReport: Report = {
        id: `demo-${Date.now()}`,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        image: image, // Use base64 directly for demo
        location: currentLocation || { lat: 41.2995, lng: 69.2401 },
        problemType: analysis.type,
        analysis,
        timestamp: Date.now(),
        status: ReportStatus.DRAFT,
        region: currentUser.region || 'Toshkent shahri'
      };
      setReports(prev => [demoReport, ...prev]);
      if (activeTab === 'manual') {
        showToast("Hisobot saqlandi (Demo)!", "success");
      }
      return;
    }

    if (!auth.currentUser) return;
    
    try {
      // Upload image to Storage
      const storageRef = ref(storage, `reports/${currentUser.id}/${Date.now()}.jpg`);
      await uploadString(storageRef, image, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      const reportData = {
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        image: downloadURL,
        location: currentLocation || { lat: 41.2995, lng: 69.2401 },
        analysis,
        timestamp: Date.now(),
        status: ReportStatus.DRAFT,
        region: currentUser.region || 'Toshkent shahri'
      };

      await addDoc(collection(db, 'reports'), {
        ...reportData,
        userId: auth.currentUser?.uid || reportData.userId // Ensure it matches auth
      });
      
      // Notify admin via Telegram if high severity
      if (analysis.severity === Severity.HIGH) {
        sendTelegramNotification(`<b>🚨 YUQORI XAVF ANIQLANDI!</b>\n\n<b>Turi:</b> ${analysis.type}\n<b>Hudud:</b> ${reportData.region}\n<b>Foydalanuvchi:</b> ${reportData.userName}\n\n<a href="${downloadURL}">Rasmni ko'rish</a>`);
      }
      
      // Silent save for live updates, toast only for manual
      if (activeTab === 'manual') {
        showToast("Hisobot saqlandi! Uni profil bo'limidan yuborishingiz mumkin.", "success");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
      showToast("Hisobotni saqlashda xatolik.", "error");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (showLanding && !currentUser) {
    return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  if (!currentUser) return <LoginForm onDemoAdminLogin={handleDemoAdminLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600/10">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-[100] pointer-events-none"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center space-x-3 ${
              toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
              toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
              'bg-blue-500/20 border-blue-500/50 text-blue-400'
            }`}>
              <i className={`fas ${
                toast.type === 'success' ? 'fa-check-circle' :
                toast.type === 'error' ? 'fa-exclamation-circle' :
                'fa-info-circle'
              }`}></i>
              <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeView !== 'admin' && (
        <>
          <Header 
            user={currentUser} 
            onLogout={handleLogout} 
            notifications={notifications}
            onMarkAsRead={markNotificationAsRead}
            onMarkAllAsRead={markAllNotificationsAsRead}
            activeView={activeView}
            setActiveView={setActiveView}
          />
          
          <div className="bg-white border-b border-slate-200 sticky top-16 z-40 backdrop-blur-xl transition-all">
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
              <div className="flex space-x-12">
                {currentUser.role !== UserRole.ADMIN && (
                  <>
                    <button 
                      onClick={() => setActiveView('monitor')} 
                      className={`py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center relative ${activeView === 'monitor' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <i className="fas fa-satellite-dish mr-3 text-xs"></i> Monitoring
                      {activeView === 'monitor' && <motion.div layoutId="nav" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.2)]"></motion.div>}
                    </button>
                    <button 
                      onClick={() => setActiveView('navigator')} 
                      className={`py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center relative ${activeView === 'navigator' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <i className="fas fa-compass mr-3 text-xs"></i> Navigator
                      {activeView === 'navigator' && <motion.div layoutId="nav" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.2)]"></motion.div>}
                    </button>
                    <button onClick={() => setActiveView('profile')} className={`py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center relative ${activeView === 'profile' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                      <i className="fas fa-user-circle mr-3 text-xs"></i> Profile
                      {activeView === 'profile' && <motion.div layoutId="nav" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.2)]"></motion.div>}
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex space-x-12">
                {currentUser.role === UserRole.ADMIN && (
                  <button onClick={() => setActiveView('admin')} className={`py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center relative ${activeView === 'admin' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <i className="fas fa-shield-halved mr-3 text-xs"></i> Admin Panel
                    {activeView === 'admin' && <motion.div layoutId="nav" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.2)]"></motion.div>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {quotaError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-3 text-red-500">
              <i className="fas fa-triangle-exclamation text-xl"></i>
              <p className="text-sm font-black uppercase tracking-widest">Tahlil to'xtatildi, limit tugadi (429 Error).</p>
            </div>
            <button onClick={() => setQuotaError(false)} className="text-red-500/50 hover:text-red-500"><i className="fas fa-xmark"></i></button>
          </div>
        )}

        {activeView === 'profile' && <UserProfile user={currentUser} userReports={reports} onDelete={deleteReport} onSubmit={submitReport} />}
        {activeView === 'admin' && (
          <CommandCenter 
            allReports={reports} 
            onDelete={deleteReport} 
            onUpdateStatus={updateReportStatus}
            users={users}
            onToggleBlock={toggleUserBlock}
            onDeleteUser={deleteUser}
            onSendGlobalNotification={sendGlobalNotification}
            currentLocation={currentLocation}
            currentUser={currentUser}
            onLogout={handleLogout}
            setActiveView={setActiveView}
          />
        )}

        {activeView === 'monitor' && (
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 h-[calc(100vh-140px)]">
            {/* Central View (70% width) */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Neural_Live_Feed</h2>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('live')} 
                    className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${activeTab === 'live' ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-400 border-slate-200 hover:border-blue-200 bg-white'}`}
                  >
                    Kamera
                  </button>
                  <button 
                    onClick={() => setActiveTab('manual')} 
                    className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${activeTab === 'manual' ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-400 border-slate-200 hover:border-blue-200 bg-white'}`}
                  >
                    Fayl
                  </button>
                </div>
              </div>

              <div className="flex-1 relative bg-white border border-slate-200 rounded-[2.5rem] p-1 overflow-hidden group shadow-xl">
                <div className={`h-full transition-transform duration-700 preserve-3d group-hover:rotate-x-1 ${activeTab === 'manual' ? 'hidden' : ''}`}>
                  <LiveVision 
                    isActive={activeTab === 'live'} 
                    onAnalysisUpdate={handleLiveUpdate} 
                    onSave={handleSaveReport}
                    onStartAnalysis={() => setIsAnalyzing(true)}
                    onError={(msg) => msg === "QUOTA_EXHAUSTED" && setQuotaError(true)} 
                  />
                </div>

                {activeTab === 'manual' && (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6 bg-white/50 backdrop-blur-sm rounded-3xl">
                    <motion.div 
                      initial={{ scale: 0.8, rotateY: -20 }}
                      animate={{ scale: 1, rotateY: 0 }}
                      whileHover={{ scale: 1.1, rotateY: 10 }}
                      className="w-24 h-24 rounded-[2rem] bg-blue-50 flex items-center justify-center border border-blue-100 shadow-xl shadow-blue-500/10"
                    >
                      <i className="fas fa-cloud-arrow-up text-3xl text-blue-500"></i>
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Neural Tahlil</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] leading-relaxed max-w-xs">
                        Tasvirni yuklang va AI optik tizimi orqali tahlildan o'tkazing
                      </p>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                      {isUploading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-camera mr-2"></i>}
                      {isUploading ? 'Tahlil qilinmoqda...' : 'Rasm Tanlash'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleManualUpload} className="hidden" accept="image/*" />
                  </div>
                )}
                
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-xl">
                    <div className="flex relative">
                      <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                         <i className="fas fa-brain text-blue-600 animate-pulse"></i>
                      </div>
                    </div>
                    <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mt-6">Neural_Processing...</p>
                  </div>
                )}
              </div>
              
              {/* Analysis Result Mini Card */}
              {lastAnalysis && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/80 backdrop-blur-md border border-slate-200 p-6 flex items-center justify-between rounded-[2rem] shadow-xl"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Detected Object</span>
                      <span className="text-sm font-black uppercase tracking-tight text-blue-600">{lastAnalysis.type}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-100"></div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Severity Index</span>
                      <span className={`text-sm font-black uppercase tracking-tight ${lastAnalysis.severity === Severity.HIGH ? 'text-red-600' : 'text-blue-400'}`}>
                        {lastAnalysis.severity}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Health Status</span>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">{lastAnalysis.health}</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Sidebar (30% width) */}
            <div className="lg:col-span-3 flex flex-col space-y-6">
              {/* SYSTEM STATUS */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="glass-panel p-8 flex flex-col gap-6 rounded-[2.5rem] bg-white border border-slate-200"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tizim Holati</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Faol</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Kamerlar</span>
                    <span className="text-2xl font-black text-slate-900">4 Nodes</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Barqarorlik</span>
                    <span className="text-2xl font-black text-blue-600">99.8%</span>
                  </div>
                </div>
              </motion.div>

              {/* TRAFFIC FLOW GRAPH */}
              <div className="glass-panel p-8 flex-1 flex flex-col gap-6 rounded-[2.5rem] bg-white border border-slate-200">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Trafik Oqimi (24s)</h3>
                <div className="flex-1 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trafficData}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#2563eb" 
                        fillOpacity={1} 
                        fill="url(#colorVal)" 
                        strokeWidth={3}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: 'none',
                          borderRadius: '16px',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                        itemStyle={{ color: '#2563eb' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ACTIVE ALERTS */}
              <div className="glass-panel p-8 flex flex-col gap-6 h-72 rounded-[2.5rem] bg-white border border-slate-200 overflow-hidden">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Ogohlantirishlar</h3>
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  {reports.filter(r => r.analysis.severity === Severity.HIGH).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 opacity-20">
                      <i className="fas fa-check-circle text-4xl mb-2"></i>
                      <p className="text-[8px] font-black uppercase">Muammolar yo'q</p>
                    </div>
                  ) : (
                    reports.filter(r => r.analysis.severity === Severity.HIGH).slice(0, 5).map(report => (
                      <motion.div 
                        key={report.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-4 p-4 bg-red-50/50 border border-red-100 rounded-2xl group hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20">
                          <i className="fas fa-triangle-exclamation text-[10px]"></i>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-tight text-red-600 mb-0.5">{report.analysis.type}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight leading-none">{report.region}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'navigator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[700px]">
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center">
                    <i className="fas fa-map-location-dot mr-3 text-blue-600"></i> Smart Navigator
                  </h3>
                  <div className="flex items-center space-x-2">
                    {routeInfo && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">Optimal Yo'l Topildi</span>}
                  </div>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={startQuery}
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
            </div>
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl relative min-h-[400px]">
              {currentLocation && (
                <MapDisplay 
                  currentLocation={currentLocation} 
                  origin={startLocation}
                  destination={destination} 
                  onRouteFound={setRouteInfo} 
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
