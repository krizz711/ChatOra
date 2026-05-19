const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const { authMiddleware } = require('../middleware/authMiddleware');
const { upload, cloudinary } = require('../config/cloudinary');
const passport = require('../config/passport');
const rateLimit = require('express-rate-limit');
const { getUserColumns, stripUnsupportedUserFields, hasUsersColumn } = require('../db/userColumns');
const { withOwnerFlag } = require('../utils/owner');
const {
  sanitizeChosenFlair,
  sanitizeFlairsList,
  normalizeFlairsArray,
  toggleChosenFlair,
} = require('../utils/flairs');
const {
  handleValidationError,
  sanitizeAge,
  sanitizeEmail,
  sanitizeGender,
  sanitizeIdsQuery,
  sanitizeName,
  sanitizeOptionalString,
  sanitizePassword,
  sanitizeString,
  sanitizeText,
  sanitizeUsername,
  sanitizeUuid,
} = require('../middleware/validation');

// Dedicated auth rate limiter for credential entry points
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many signup attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// UUID format validator
const isValidId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const normalizeGender = (value) => {
  const gender = String(value || 'other').toLowerCase();
  return ['female', 'male', 'other'].includes(gender) ? gender : 'other';
};

const parseAge = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const age = Number(value);
  if (!Number.isInteger(age) || age < 13 || age > 120) return null;
  return age;
};

// ── GOOGLE OAUTH ──────────────────────────────────────────────────

// Step 1: Redirect to Google with CSRF state cookie
router.get('/google', (req, res, next) => {
  const state = require('crypto').randomBytes(16).toString('hex');
  const cookieOpts = { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 };
  if (process.env.NODE_ENV === 'production') cookieOpts.secure = true;
  res.cookie('chatora_oauth_state', state, cookieOpts);
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});

// Step 2: Google callback with detailed error logging and state check
router.get('/google/callback', (req, res, next) => {
  const CLIENT = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const stateCookie = req.cookies && req.cookies.nexchat_oauth_state;
  const stateQuery = req.query.state;
  try {
    const safeStateCookie = sanitizeString(String(stateCookie || ''), { field: 'state', min: 8, max: 64, pattern: /^[a-f0-9]+$/i });
    const safeStateQuery = sanitizeString(String(stateQuery || ''), { field: 'state', min: 8, max: 64, pattern: /^[a-f0-9]+$/i });
    if (safeStateCookie !== safeStateQuery) {
      // Clear cookie and abort
      res.clearCookie('chatora_oauth_state');
      return res.redirect(`${CLIENT}/login?error=csrf`);
    }
  } catch {
    res.clearCookie('chatora_oauth_state');
    return res.redirect(`${CLIENT}/login?error=csrf`);
  }
  // Clear state cookie after validation
  res.clearCookie('chatora_oauth_state');

  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) {
      console.error('❌ Google OAuth Error Details:', {
        message: err.message,
        code: err.code,
        status: err.status,
        body: err.body,
        fullError: JSON.stringify(err, null, 2),
      });
      const errorMsg = err.code || err.message || 'google_failed';
      return res.redirect(`${CLIENT}/login?error=${encodeURIComponent(errorMsg)}`);
    }

    if (!user) {
      console.error('❌ Google OAuth: No user returned', info);
      return res.redirect(`${CLIENT}/login?error=no_user&info=${encodeURIComponent(JSON.stringify(info))}`);
    }

    console.log('✅ Google OAuth Success:', { userId: user.user?.id, username: user.user?.username });
    const { user: userData, token } = user;

    // Set short-lived httpOnly cookie with the JWT instead of exposing it in the URL
    const cookieOpts = { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 };
    if (process.env.NODE_ENV === 'production') cookieOpts.secure = true;
    res.cookie('chatora_oauth_token', token, cookieOpts);

    // Redirect to client callback WITHOUT token in URL
    return res.redirect(`${CLIENT}/auth/callback`);
  })(req, res, next);
});

// Exchange cookie for token and user
router.get('/oauth-token', async (req, res) => {
  try {
    const token = req.cookies && req.cookies.nexchat_oauth_token;
    if (!token) return res.status(401).json({ error: 'no_token' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    if (decoded.isGuest) return res.status(401).json({ error: 'invalid_token' });

    const cols = await getUserColumns();
    const { data: user, error } = await supabase
      .from('users')
      .select(cols)
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return res.status(401).json({ error: 'invalid_token' });

    // Clear the cookie now that token is exchanged
    res.clearCookie('chatora_oauth_token');

    return res.json({ user, token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GUEST LOGIN ───────────────────────────────────────────────────

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many guest sessions from this IP' },
});

router.post('/guest', guestLimiter, async (req, res) => {
  try {
    const { username, country, state, gender, age } = req.body;
    const clean = sanitizeUsername(username);
    const safeCountry = sanitizeOptionalString(country, { field: 'country', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    const safeState = sanitizeOptionalString(state, { field: 'state', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    const safeGender = sanitizeGender(gender);
    const parsedAge = sanitizeAge(age);

    if (!safeCountry || !safeState || !safeGender || parsedAge === null) {
      return res.status(400).json({ error: 'Please provide country, state, gender and age for guest sessions' });
    }

    // Guest JWT — short-lived, carries guest flag and includes profile info (not stored in DB)
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const token = jwt.sign(
      {
        userId: guestId,
        username: clean,
        isGuest: true,
        country: safeCountry,
        state: safeState,
        gender: safeGender,
        age: parsedAge,
      },
      process.env.JWT_SECRET,
      { expiresIn: '4h' } // Guests auto-expire
    );

    res.json({
      user: {
        id: guestId,
        username: clean,
        email: null,
        avatar_url: null,
        bio: '',
        isGuest: true,
        country: safeCountry,
        state: safeState,
        gender: safeGender,
        age: parsedAge,
      },
      token,
    });
  } catch (err) {
    return handleValidationError(res, err);
  }
});

// Register
router.post('/register', signupLimiter, async (req, res) => {
  try {
    const { username, email, password, country, state, gender, age } = req.body;
    const safeUsername = sanitizeUsername(username);
    const safeEmail = sanitizeEmail(email);
    const safePassword = sanitizePassword(password);
    const safeCountry = sanitizeOptionalString(country, { field: 'country', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    const safeState = sanitizeOptionalString(state, { field: 'state', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    const safeGender = sanitizeGender(gender);
    const safeAge = sanitizeAge(age);

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${safeUsername},email.eq.${safeEmail}`)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const hashedPassword = await bcrypt.hash(safePassword, 12);
    const canStoreAge = await hasUsersColumn('age');
    const { data: user, error } = await supabase
      .from('users')
      .insert(await stripUnsupportedUserFields({
        username: safeUsername,
        email: safeEmail,
        password_hash: hashedPassword,
        country: safeCountry,
        state: safeState,
        gender: safeGender,
        age: canStoreAge ? safeAge : undefined,
      }))
      .select(await getUserColumns())
      .single();

    if (error) throw error;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    return handleValidationError(res, err) || res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, country, state, gender, age } = req.body;
    const safeEmail = sanitizeEmail(email);
    const safePassword = sanitizePassword(password);
    const safeCountry = sanitizeOptionalString(country, { field: 'country', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    const safeState = sanitizeOptionalString(state, { field: 'state', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    const safeGender = sanitizeGender(gender);
    const safeAge = sanitizeAge(age);

    const userColumns = await getUserColumns({ includePasswordHash: true });
    const { data: user, error } = await supabase
      .from('users')
      .select(userColumns)
      .eq('email', safeEmail)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(safePassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const profilePatch = {};
    if (country !== undefined) profilePatch.country = safeCountry;
    if (state !== undefined) profilePatch.state = safeState;
    if (gender !== undefined) profilePatch.gender = safeGender;
    if (age !== undefined && await hasUsersColumn('age')) profilePatch.age = safeAge;

    let safeUser = user;
    if (Object.keys(profilePatch).length) {
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update(profilePatch)
        .eq('id', user.id)
        .select(await getUserColumns())
        .single();

      if (updateError) throw updateError;
      safeUser = updated;
    } else {
      const { password_hash, ...rest } = user;
      safeUser = rest;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: safeUser, token });
  } catch (err) {
    return handleValidationError(res, err) || res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Get star stats for a list of user IDs
router.get('/stars', authMiddleware, async (req, res) => {
  let ids;
  try {
    ids = sanitizeIdsQuery(req.query.ids, { maxItems: 50 });
  } catch (err) {
    return handleValidationError(res, err);
  }

  if (!ids.length) return res.json({ counts: {}, starredByMe: [] });

  try {
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, star_count')
      .in('id', ids);

    if (usersErr) throw usersErr;

    const { data: mine, error: mineErr } = await supabase
      .from('user_stars')
      .select('starred_user_id')
      .eq('starred_by', req.user.id)
      .in('starred_user_id', ids);

    if (mineErr) throw mineErr;

    const counts = {};
    ids.forEach(id => { counts[id] = 0; });
    (users || []).forEach(row => {
      counts[row.id] = row.star_count || 0;
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
  let userId;
  try {
    userId = sanitizeUuid(req.params.userId, 'userId');
  } catch (err) {
    return handleValidationError(res, err);
  }
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

    let starred = false;

    if (existing) {
      const { error: deleteErr } = await supabase
        .from('user_stars')
        .delete()
        .eq('starred_by', req.user.id)
        .eq('starred_user_id', userId);

      if (deleteErr) throw deleteErr;
      starred = false;
    } else {
      const { error: insErr } = await supabase
        .from('user_stars')
        .insert({ starred_by: req.user.id, starred_user_id: userId });

      if (insErr) throw insErr;
      starred = true;
    }

    // Count actual rows to avoid race-condition drift
    const { count: nextCount, error: countErr } = await supabase
      .from('user_stars')
      .select('*', { count: 'exact', head: true })
      .eq('starred_user_id', userId);

    if (countErr) throw countErr;

    const { error: updateErr } = await supabase
      .from('users')
      .update({ star_count: nextCount || 0 })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    res.json({ starred, starCount: nextCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile flairs (add/toggle/remove or set full list)
router.put('/flair', authMiddleware, async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot set flairs' });
  }

  const hasFlairsCol = await hasUsersColumn('flairs');
  const hasFlairCol = await hasUsersColumn('flair');
  if (!hasFlairsCol && !hasFlairCol) {
    return res.status(503).json({ error: 'Flairs are not available yet. Run the latest database migration.' });
  }

  try {
    const current = normalizeFlairsArray(req.user);
    let next = current;

    if (req.body?.flairs !== undefined) {
      next = sanitizeFlairsList(req.body.flairs);
    } else if (req.body?.flair !== undefined) {
      const action = req.body?.action === 'remove' ? 'remove' : 'toggle';
      if (req.body.flair === null || req.body.flair === '') {
        next = [];
      } else {
        next = toggleChosenFlair(current, req.body.flair, action);
      }
    } else {
      return res.status(400).json({ error: 'Provide flair or flairs' });
    }

    const patch = {};
    if (hasFlairsCol) patch.flairs = next;
    if (hasFlairCol) patch.flair = next[0] || null;

    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.user.id)
      .select(await getUserColumns())
      .single();

    if (error) throw error;

    const { email, password_hash, google_id, ...publicUser } = withOwnerFlag(data);
    res.json({ user: publicUser });
  } catch (err) {
    return handleValidationError(res, err) || res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot update profiles' });
  }

  try {
    const { username, bio, country, state, gender, age } = req.body;
    const profilePatch = {};
    if (username !== undefined) profilePatch.username = sanitizeUsername(username);
    if (bio !== undefined) profilePatch.bio = sanitizeText(bio, { field: 'bio', min: 0, max: 500, allowNewlines: true });
    if (country !== undefined) profilePatch.country = sanitizeOptionalString(country, { field: 'country', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    if (state !== undefined) profilePatch.state = sanitizeOptionalString(state, { field: 'state', min: 2, max: 80, pattern: /^[A-Za-z0-9 .,'-]+$/ });
    if (gender !== undefined) profilePatch.gender = sanitizeGender(gender);
    if (age !== undefined && await hasUsersColumn('age')) profilePatch.age = sanitizeAge(age);

    const { data, error } = await supabase
      .from('users')
      .update(profilePatch)
      .eq('id', req.user.id)
      .select(await getUserColumns())
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    return handleValidationError(res, err) || res.status(500).json({ error: err.message });
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
      .select(await getUserColumns())
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get public user profile by ID
router.get('/users/:userId', async (req, res) => {
  let userId;
  try {
    userId = sanitizeUuid(req.params.userId, 'userId');
  } catch (err) {
    return handleValidationError(res, err);
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(await getUserColumns())
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const flagged = withOwnerFlag(user);
    const { email, password_hash, google_id, ...publicUser } = flagged;
    res.json({ success: true, user: publicUser });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
