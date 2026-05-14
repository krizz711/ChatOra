const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const supabase = require('../db/supabase');
const jwt = require('jsonwebtoken');
const { stripUnsupportedUserFields, getUserColumns } = require('../db/userColumns');
// Fail fast if critical env vars are missing
if (!process.env.SERVER_URL) throw new Error('SERVER_URL env var is required for Google OAuth');
if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID env var is required for Google OAuth');
if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET env var is required for Google OAuth');
// Debug: Log OAuth config on startup
console.log('🔐 Google OAuth Configuration:');
console.log(`   CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '❌ MISSING'}`);
console.log(`   CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '❌ MISSING'}`);
console.log(`   SERVER_URL: ${process.env.SERVER_URL || 'http://localhost:5000'}`);
console.log(`   CALLBACK_URL: ${process.env.SERVER_URL}/api/auth/google/callback`);

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('✅ Google OAuth Profile Received:', {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
    });

    const googleId = profile.id;
    const email = profile.emails?.[0]?.value || null;
    const name = profile.displayName || profile.name?.givenName || 'User';
    const avatar = profile.photos?.[0]?.value || null;

    // Determine which user columns are available in this database
    const oauthCols = await getUserColumns({ includeAuthProvider: true });

    // Try to find by google_id first
    let { data: user } = await supabase
      .from('users')
      .select(oauthCols)
      .eq('google_id', googleId)
      .single();

    if (!user && email) {
      // Try to find by email (account merge)
      const { data: byEmail } = await supabase
        .from('users')
        .select(oauthCols)
        .eq('email', email)
        .single();

      if (byEmail) {
        // Link google_id to existing account
        await supabase
          .from('users')
          .update({ google_id: googleId, auth_provider: 'google', avatar_url: byEmail.avatar_url || avatar })
          .eq('id', byEmail.id);
        user = { ...byEmail, google_id: googleId };
      }
    }

    if (!user) {
      // New user — create account
      // Ensure unique username
      let baseUsername = name.replace(/\s+/g, '_').toLowerCase().slice(0, 20);
      let username = baseUsername;
      let attempt = 0;
      while (true) {
        const { data: existing } = await supabase
          .from('users').select('id').eq('username', username).single();
        if (!existing) break;
        attempt++;
        username = `${baseUsername}_${attempt}`;
      }

      const { data: created, error } = await supabase
        .from('users')
        .insert(await stripUnsupportedUserFields({
          username,
          email,
          google_id: googleId,
          avatar_url: avatar,
          auth_provider: 'google',
          password_hash: null,
        }))
        .select(oauthCols)
        .single();

      if (error) return done(error);
      user = created;
    }

    // Issue JWT same as email flow
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return done(null, { user, token });
  } catch (err) {
    return done(err);
  }
}));

module.exports = passport;
