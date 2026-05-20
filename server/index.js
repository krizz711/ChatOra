require('dotenv').config();
const helmet = require('helmet');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { socketAuth } = require('./middleware/authMiddleware');
const socketHandler = require('./socket/socketHandler');
const passport = require('./config/passport');
const supabase = require('./db/supabase');
const { authMiddleware } = require('./middleware/authMiddleware');

const app = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
const normalizeOrigin = (value) => (value || '').replace(/\/$/, '');
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // same-origin or server-to-server
  return allowedOrigins.includes(normalizeOrigin(origin));
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
const jsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => {
  if (req.originalUrl === '/api/billing/webhook') return next();
  return jsonParser(req, res, next);
});
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
      connectSrc: ["'self'", ...allowedOrigins, 'wss:', 'ws:'],
      mediaSrc: ["'self'", 'https://res.cloudinary.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cookieParser());
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { error: 'Too many requests, slow down' },
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth')(io));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/friends', require('./routes/friends')(io));
app.use('/api/settings', require('./routes/settings'));
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), require('./routes/billing').webhook);
app.use('/api/billing', authMiddleware, require('./routes/billing'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Socket.io Auth + Handler
io.use(socketAuth);
socketHandler(io);

// Start Server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(async () => {
  try {
    const { error } = await supabase
      .from('private_messages')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (error) console.error('[cleanup] DM cleanup failed:', error.message);
    else console.log('[cleanup] Expired DMs purged');
  } catch (err) {
    console.error('[cleanup] Error:', err.message);
  }
}, 60 * 60 * 1000);
