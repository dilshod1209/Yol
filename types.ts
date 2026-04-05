
export enum DefectType {
  POTHOLE = "Chuqur (Pothole)",
  CRACK = "Yoriq (Crack)",
  OBSTACLE = "To'siq (Obstacle)",
  FADED_MARKINGS = "O'chgan chiziqlar",
  SMOOTH = "Tekis yo'l",
  UNKNOWN = "Noma'lum"
}

export enum Severity {
  LOW = "Past",
  MEDIUM = "O'rtacha",
  HIGH = "Yuqori",
  NONE = "Yo'q"
}

export enum RoadHealth {
  EXCELLENT = "A'lo",
  GOOD = "Yaxshi",
  FAIR = "Qoniqarsiz",
  POOR = "Yomon"
}

export enum ReportStatus {
  DRAFT = "Qoralama",
  SUBMITTED = "Yuborilgan",
  UNDER_REVIEW = "Ko'rib chiqilmoqda",
  IN_REPAIR = "Ta'mirlanmoqda",
  FIXED = "Tuzatilgan",
  REJECTED = "Rad etilgan"
}

export enum UserRole {
  USER = "USER",
  STAFF = "STAFF",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN"
}

export enum Language {
  UZ = "uz",
  QR = "qr",
  EN = "en",
  RU = "ru"
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  personalCode?: string;
  region: string;
  district: string;
  isBlocked?: boolean;
  isOnline?: boolean;
  isCameraActive?: boolean;
  language?: Language;
  createdAt: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  type: 'status_change' | 'system' | 'admin_broadcast';
}

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

export interface RouteData {
  distance: number; // in meters
  duration: number; // in seconds
  coordinates: [number, number][];
}

export interface AnalysisResult {
  type: DefectType;
  severity: Severity;
  health: RoadHealth;
  description: string;
  recommendation: string;
  estimatedCost?: number; // in USD or local currency (UZS)
  estimatedTime?: string; // e.g., "2 kun", "5 soat"
  estimatedArea?: number; // in square meters
  materials?: {
    name: string;
    amount: string;
    unit: string;
    cost: number;
  }[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  trafficLight?: {
    detected: boolean;
    state: 'red' | 'green' | 'yellow' | 'none';
    distance?: number; // Estimated distance in meters
  };
}

export interface Report {
  id: string;
  userId: string;
  userName: string;
  image: string;
  location: LocationData;
  problemType: string;
  description?: string;
  analysis: AnalysisResult;
  timestamp: number;
  status: ReportStatus;
  region: string;
  repairStartedAt?: number;
  fixedAt?: number;
}
