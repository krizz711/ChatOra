const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const { authMiddleware } = require('../middleware/authMiddleware');
const { upload, cloudinary } = require('../config/cloudinary');
const passport = require('../config/passport');
const rateLimit = require('express-rate-limit');

// ── GOOGLE OAUTH ──────────────────────────────────────────────────

// Step 1: Redirect to Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2: Google callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_failed' }),
  (req, res) => {
    const { user, token } = req.user;
    const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
    // Redirect to frontend with token in query — frontend reads it and stores
    res.redirect(`${CLIENT}/auth/callback?token=${token}&userId=${user.id}`);
  }
);

// ── GUEST LOGIN ───────────────────────────────────────────────────

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many guest sessions from this IP' },
});

router.post('/guest', guestLimiter, async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' });
  }

  const clean = username.trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20);
  if (clean.length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }

  // Guest JWT — short-lived, carries guest flag, no DB record
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const token = jwt.sign(
    { userId: guestId, username: clean, isGuest: true },
    process.env.JWT_SECRET,
    { expiresIn: '4h' }  // Guests auto-expire
  );

  res.json({
    user: {
      id: guestId,
      username: clean,
      email: null,
      avatar_url: null,
      bio: '',
      isGuest: true,
    },
    token,
  });
});

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    // Check if username or email taken
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ username, email, password_hash: hashedPassword })
      .select('id, username, email, avatar_url, bio')
      .single();

    if (error) throw error;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, avatar_url, bio, password_hash')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { password_hash, ...safeUser } = user;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: safeUser, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Get star stats for a list of user IDs
router.get('/stars', authMiddleware, async (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) return res.json({ counts: {}, starredByMe: [] });

  const ids = String(idsParam)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  if (!ids.length) return res.json({ counts: {}, starredByMe: [] });

  try {
    const { data: allStars, error: allErr } = await supabase
      .from('user_stars')
      .select('starred_user_id')
      .in('starred_user_id', ids);

    if (allErr) throw allErr;

    const { data: mine, error: mineErr } = await supabase
      .from('user_stars')
      .select('starred_user_id')
      .eq('starred_by', req.user.id)
      .in('starred_user_id', ids);

    if (mineErr) throw mineErr;

    const counts = {};
    ids.forEach(id => { counts[id] = 0; });
    (allStars || []).forEach(row => {
      counts[row.starred_user_id] = (counts[row.starred_user_id] || 0) + 1;
    });

    res.json({
      counts,
      starredByMe: (mine || []).map(r => r.starred_user_id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Star or unstar another user (toggle)
router.post('/star/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'Target user is required' });
  if (userId.startsWith('guest_')) return res.status(400).json({ error: 'Cannot star a guest user' });
  if (userId === req.user.id) return res.status(400).json({ error: 'You cannot star yourself' });

  try {
    const { data: target, error: targetErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (targetErr) throw targetErr;
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { data: existing, error: existingErr } = await supabase
      .from('user_stars')
      .select('starred_user_id')
      .eq('starred_by', req.user.id)
      .eq('starred_user_id', userId)
      .maybeSingle();

    if (existingErr) throw existingErr;

    let starred;
    if (existing) {
      const { error: delErr } = await supabase
        .from('user_stars')
        .delete()
        .eq('starred_by', req.user.id)
        .eq('starred_user_id', userId);

      if (delErr) throw delErr;
      starred = false;
    } else {
      const { error: insErr } = await supabase
        .from('user_stars')
        .insert({ starred_by: req.user.id, starred_user_id: userId });

      if (insErr) throw insErr;
      starred = true;
    }

    const { count, error: countErr } = await supabase
      .from('user_stars')
      .select('starred_user_id', { count: 'exact', head: true })
      .eq('starred_user_id', userId);

    if (countErr) throw countErr;

    res.json({ userId, starred, starCount: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot update profiles' });
  }

  const { username, bio } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ username, bio })
      .eq('id', req.user.id)
      .select('id, username, email, avatar_url, bio')
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload avatar
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot upload avatars' });
  }

  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { data, error } = await supabase
      .from('users')
      .update({ avatar_url: req.file.path })
      .eq('id', req.user.id)
      .select('id, username, email, avatar_url, bio')
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get public user profile by ID
router.get('/users/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, avatar_url, bio, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
