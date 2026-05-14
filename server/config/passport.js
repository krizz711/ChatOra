const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const supabase = require('../db/supabase');
const jwt = require('jsonwebtoken');

// Fail fast if critical env vars are missing
if (!process.env.SERVER_URL) throw new Error('SERVER_URL env var is required for Google OAuth');
if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID env var is required for Google OAuth');
if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET env var is required for Google OAuth');

console.log('Google OAuth Configuration:');
console.log(`   CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'Set' : 'MISSING'}`);
console.log(`   CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'MISSING'}`);
console.log(`   SERVER_URL: ${process.env.SERVER_URL || 'http://localhost:5000'}`);
console.log(`   CALLBACK_URL: ${process.env.SERVER_URL}/api/auth/google/callback`);

// Base columns that must exist
const BASE_COLS = 'id, username, email, avatar_url, bio, star_count, created_at';

// Check which optional columns exist (cached per process)
const colCache = new Map();
async function colExists(name) {
  if (colCache.has(name)) return colCache.get(name);
  const { error } = await supabase.from('users').select(name).limit(1);
  const exists = !error;
  colCache.set(name, exists);
  return exists;
}

async function buildSelectCols(extras = []) {
  const cols = [BASE_COLS];
  for (const col of extras) {
    if (await colExists(col)) cols.push(col);
  }
  return cols.join(', ');
}

async function buildInsertPayload(raw) {
  const payload = {};
  const always = ['username', 'email', 'avatar_url', 'password_hash'];
  for (const k of always) {
    if (raw[k] !== undefined) payload[k] = raw[k];
  }
  // Optional columns: only include if they exist in DB
  const optional = ['google_id', 'auth_provider', 'country', 'state', 'gender', 'age'];
  for (const k of optional) {
    if (raw[k] !== undefined && await colExists(k)) {
      payload[k] = raw[k];
    }
  }
  return payload;
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth Profile Received:', {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
    });

    const googleId = profile.id;
    const email = profile.emails?.[0]?.value || null;
    const name = profile.displayName || profile.name?.givenName || 'User';
    const avatar = profile.photos?.[0]?.value || null;

    const hasGoogleId = await colExists('google_id');
    const hasAuthProvider = await colExists('auth_provider');

    const selectCols = await buildSelectCols(
      ['google_id', 'auth_provider', 'country', 'state', 'gender', 'age']
    );

    let user = null;

    // Try to find by google_id if column exists
    if (hasGoogleId) {
      const { data } = await supabase
        .from('users')
        .select(selectCols)
        .eq('google_id', googleId)
        .maybeSingle();
      user = data;
    }

    // Try to find by email (account merge)
    if (!user && email) {
      const { data: byEmail } = await supabase
        .from('users')
        .select(selectCols)
        .eq('email', email)
        .maybeSingle();

      if (byEmail) {
        // Link google_id to existing account if possible
        const updatePayload = {};
        if (hasGoogleId) updatePayload.google_id = googleId;
        if (hasAuthProvider) updatePayload.auth_provider = 'google';
        if (!byEmail.avatar_url && avatar) updatePayload.avatar_url = avatar;

        if (Object.keys(updatePayload).length) {
          await supabase.from('users').update(updatePayload).eq('id', byEmail.id);
        }
        user = { ...byEmail, google_id: googleId };
      }
    }

    if (!user) {
      // New user: create account
      let baseUsername = name.replace(/\s+/g, '_').toLowerCase().slice(0, 20);
      let username = baseUsername;
      let attempt = 0;
      while (true) {
        const { data: existing } = await supabase
          .from('users').select('id').eq('username', username).maybeSingle();
        if (!existing) break;
        attempt++;
        username = `${baseUsername}_${attempt}`;
      }

      const insertPayload = await buildInsertPayload({
        username,
        email,
        google_id: googleId,
        avatar_url: avatar,
        auth_provider: 'google',
        password_hash: null,
      });

      const { data: created, error } = await supabase
        .from('users')
        .insert(insertPayload)
        .select(selectCols)
        .single();

      if (error) {
        console.error('Failed to create Google user:', error);
        return done(error);
      }
      user = created;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return done(null, { user, token });
  } catch (err) {
    console.error('Google OAuth strategy error:', err);
    return done(err);
  }
}));

module.exports = passport;
