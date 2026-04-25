
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import db from './db.ts';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'road-monitoring-secret-key';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Multer configuration for image uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/road_images/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage });

  // Middleware to verify JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };

  // --- Auth Routes ---

  app.post('/api/auth/register', async (req, res) => {
    const { firstName, lastName, region, district, phone, personalCode, email, password } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = uuidv4();
      const createdAt = Date.now();

      const stmt = db.prepare(`
        INSERT INTO users (id, first_name, last_name, region, district, phone, personal_code, email, password, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, firstName, lastName, region, district, phone, personalCode, email, hashedPassword, 'USER', createdAt);

      res.status(201).json({ message: 'User registered successfully' });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Email or Personal Code already exists' });
      } else {
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    // Special case for root admin if not in DB
    if ((email === 'admin@system.com' || email === 'admin') && password === 'admin') {
       const admin = db.prepare('SELECT * FROM users WHERE email = ?').get(email === 'admin' ? 'admin@system.com' : email) as any;
       if (!admin) {
          const id = 'admin_root';
          const hashedPassword = await bcrypt.hash('admin', 10);
          db.prepare(`
            INSERT INTO users (id, first_name, last_name, region, district, phone, personal_code, email, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, 'System', 'Admin', 'Toshkent shahri', 'Yunusobod tumani', '+998901234567', 'ADMIN001', 'admin@system.com', hashedPassword, 'ADMIN', Date.now());
       }
       
       // Allow 'admin' to proceed as 'admin@system.com'
       if (email === 'admin') {
         const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@system.com') as any;
         const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
         return res.json({
           token,
           user: {
             id: user.id,
             name: `${user.first_name} ${user.last_name}`,
             email: user.email,
             role: user.role,
             region: user.region,
             district: user.district
           }
         });
       }
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    if (user.is_blocked === 1) {
      return res.status(403).json({ error: 'Sizning hisobingiz bloklangan. Iltimos, administrator bilan bog\'laning.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        region: user.region,
        district: user.district
      }
    });
  });

  // --- Report Routes ---

  app.post('/api/reports', authenticateToken, upload.single('image'), (req: any, res) => {
    const { location, problemType, description, severity, analysis, region } = req.body;
    const id = uuidv4();
    const userId = req.user.id;
    const createdAt = Date.now();
    const imagePath = req.file ? `/uploads/road_images/${req.file.filename}` : null;

    try {
      const stmt = db.prepare(`
        INSERT INTO road_reports (id, user_id, image, location, problem_type, description, severity, analysis, status, region, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, userId, imagePath, location, problemType, description, severity, analysis, 'DRAFT', region, createdAt);

      res.status(201).json({ id, message: 'Report created successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create report' });
    }
  });

  app.get('/api/reports/my', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const reports = db.prepare(`
      SELECT r.*, u.first_name || ' ' || u.last_name as userName 
      FROM road_reports r 
      JOIN users u ON r.user_id = u.id 
      WHERE r.user_id = ? 
      ORDER BY r.created_at DESC
    `).all(userId);
    res.json(reports);
  });

  app.patch('/api/reports/:id/submit', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const report = db.prepare('SELECT * FROM road_reports WHERE id = ? AND user_id = ?').get(id, userId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    db.prepare("UPDATE road_reports SET status = 'SUBMITTED' WHERE id = ?").run(id);

    // Notify admin
    const adminId = 'admin_root';
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, timestamp, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), adminId, 'Yangi hisobot', 'Yangi yo\'l nosozligi haqida hisobot kelib tushdi.', Date.now(), 'system');

    res.json({ message: 'Report submitted successfully' });
  });

  // --- Admin Routes ---

  app.get('/api/admin/reports', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const reports = db.prepare(`
      SELECT r.*, u.first_name || ' ' || u.last_name as userName 
      FROM road_reports r 
      JOIN users u ON r.user_id = u.id 
      ORDER BY r.created_at DESC
    `).all();
    res.json(reports);
  });

  app.patch('/api/admin/reports/:id/status', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { status } = req.body;

    const report = db.prepare('SELECT * FROM road_reports WHERE id = ?').get(id) as any;
    if (!report) return res.status(404).json({ error: 'Report not found' });

    db.prepare('UPDATE road_reports SET status = ? WHERE id = ?').run(status, id);

    // Notify user
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, timestamp, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), 
      report.user_id, 
      "Hisobot holati o'zgardi", 
      `Sizning "${report.problem_type}" bo'yicha hisobotingiz holati "${status}" ga o'zgartirildi.`, 
      Date.now(), 
      'status_change'
    );

    res.json({ message: 'Status updated successfully' });
  });

  app.get('/api/admin/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const users = db.prepare("SELECT id, first_name || ' ' || last_name as name, email, role, region, district, phone, personal_code, is_blocked, created_at FROM users WHERE role != 'ADMIN'").all();
    const mappedUsers = users.map((u: any) => ({
      ...u,
      isBlocked: u.is_blocked === 1
    }));
    res.json(mappedUsers);
  });

  app.get('/api/admin/stats', authenticateToken, (req: any, res) => {
     if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
     
     const totalReports = db.prepare('SELECT COUNT(*) as count FROM road_reports').get() as any;
     const fixedReports = db.prepare("SELECT COUNT(*) as count FROM road_reports WHERE status = 'FIXED'").get() as any;
     const highRisk = db.prepare("SELECT COUNT(*) as count FROM road_reports WHERE severity = 'Yuqori'").get() as any;
     const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
     
     const regionStats = db.prepare(`
       SELECT region, COUNT(*) as count 
       FROM road_reports 
       GROUP BY region 
       ORDER BY count DESC
     `).all();

     res.json({
       totalReports: totalReports.count,
       fixedReports: fixedReports.count,
       highRisk: highRisk.count,
       totalUsers: totalUsers.count,
       regionStats
     });
  });

  app.get('/api/notifications', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
    res.json(notifications);
  });

  app.patch('/api/notifications/:id/read', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ message: 'Notification marked as read' });
  });

  app.delete('/api/reports/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    try {
      if (role === 'ADMIN') {
        db.prepare('DELETE FROM road_reports WHERE id = ?').run(id);
      } else {
        db.prepare('DELETE FROM road_reports WHERE id = ? AND user_id = ?').run(id, userId);
      }
      res.json({ message: 'Report deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete report' });
    }
  });

  app.delete('/api/admin/users/:userId', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const { userId } = req.params;

    try {
      db.prepare('DELETE FROM road_reports WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.patch('/api/admin/users/:userId/toggle-block', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const { userId } = req.params;

    try {
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
      if (user?.role === 'ADMIN') return res.status(403).json({ error: 'Cannot block admin' });

      db.prepare('UPDATE users SET is_blocked = CASE WHEN is_blocked = 1 THEN 0 ELSE 1 END WHERE id = ?').run(userId);
      res.json({ message: 'User block status toggled' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle block status' });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      configFile: path.resolve(__dirname, 'vite.config.ts'),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
