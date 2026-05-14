const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');

const authUserColumns = 'id, username, email, avatar_url, bio, star_count, created_at';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guest path — no DB lookup
    if (decoded.isGuest) {
      if (typeof decoded.userId !== 'string' || !decoded.userId.startsWith('guest_')) {
        return res.status(401).json({ error: 'Invalid guest token' });
      }
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: null,
        avatar_url: null,
        bio: '',
        country: null,
        state: null,
        gender: 'other',
        age: null,
        star_count: 0,
        isGuest: true,
      };
      return next();
    }

    // Registered user path — DB lookup
    const { data: user, error } = await supabase
      .from('users')
      .select(authUserColumns)
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    const needsProfile = user.age == null || user.country == null || !user.gender || user.gender === 'other';
    req.user = { ...user, needsProfile };
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
};

// Socket.io auth
const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guest path
    if (decoded.isGuest) {
      if (typeof decoded.userId !== 'string' || !decoded.userId.startsWith('guest_')) {
        return next(new Error('Invalid guest token'));
      }
      socket.user = {
        id: decoded.userId,
        username: decoded.username,
        avatar_url: null,
        country: null,
        state: null,
        gender: 'other',
        age: null,
        star_count: 0,
        isGuest: true,
      };
      return next();
    }

    // Registered user path
    const { data: user, error } = await supabase
      .from('users')
      .select(authUserColumns)
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return next(new Error('Invalid token'));
    const needsProfile = user.age == null || user.country == null || !user.gender || user.gender === 'other';
    socket.user = { ...user, needsProfile };
    next();
  } catch {
    next(new Error('Token expired'));
  }
};

module.exports = { authMiddleware, socketAuth };
