require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { socketAuth } = require('./middleware/authMiddleware');
const socketHandler = require('./socket/socketHandler');
const passport = require('./config/passport');

const app = express();
const httpServer = createServer(app);
const allowedOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const normalizeOrigin = (value) => (value || '').replace(/\/$/, '');

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || normalizeOrigin(origin) === allowedOrigin) {
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

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || normalizeOrigin(origin) === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { error: 'Too many requests, slow down' },
});
app.use('/api/', limiter);

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/upload', require('./routes/upload'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Socket.io Auth + Handler ────────────────────────────────────
io.use(socketAuth);
socketHandler(io);

// ── Start Server ────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
