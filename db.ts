
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'road_monitoring.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    region TEXT NOT NULL,
    district TEXT NOT NULL,
    phone TEXT NOT NULL,
    personal_code TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'USER',
    is_blocked INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS road_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    image TEXT,
    location TEXT, -- JSON string
    problem_type TEXT NOT NULL,
    description TEXT,
    severity TEXT,
    analysis TEXT, -- JSON string
    status TEXT DEFAULT 'DRAFT',
    region TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    is_read INTEGER DEFAULT 0,
    type TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'uploads', 'road_images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export default db;
