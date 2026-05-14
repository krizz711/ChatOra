# Auth System Setup Guide

## Environment Variables Required

### Server (.env)

```env
# JWT Secret (should be a long random string)
JWT_SECRET=your_jwt_secret_key_here

# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Server URLs
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Database
DATABASE_URL=your_database_url

# Redis (Upstash)
REDIS_URL=your_redis_url

# Port
PORT=5000
```

## Database Migration Required

Run this SQL in your Supabase SQL Editor to update the users table:

```sql
-- Allow null password for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add Google OAuth fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'google', 'guest'));

-- Index for fast Google ID lookup
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Update existing rows to set auth_provider
UPDATE users SET auth_provider = 'email' WHERE auth_provider IS NULL;
```

## Google OAuth Setup

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Create "OAuth 2.0 Client ID" (type: Web application)
5. Set authorized redirect URIs:
   - `http://localhost:5000/api/auth/google/callback` (development)
   - `https://your-production-url.com/api/auth/google/callback` (production)
6. Copy Client ID and Secret to `.env`

## Testing the Auth Flows

### 1. Email/Password Login
- Still works as before
- User account stored in Supabase with `auth_provider = 'email'`

### 2. Google OAuth
- Click "Continue with Google"
- Redirects to Google login
- Returns token via URL query params
- Frontend catches token and logs in user
- User account created/linked in Supabase with `auth_provider = 'google'`

### 3. Guest Login
- Click "Continue as guest"
- Enter display name
- JWT token issued with `isGuest: true` flag
- No database record created (RAM only)
- Token expires in 4 hours
- Guests can read/send messages but cannot edit profile or upload avatar

## Security Notes

1. **Guest tokens**: Expire in 4 hours automatically
2. **Guest IDs**: Always start with `guest_` prefix for identification
3. **Guests cannot**: Update profile, upload avatars
4. **Guests can**: Send text messages, view rooms, DM users
5. **Rate limiting**: Guest endpoint limited to 10 requests per 15 minutes per IP
6. **OAuth token handling**: Token passed via URL query params - frontend must consume immediately

## Files Changed

### Server
- `server/config/passport.js` (NEW)
- `server/routes/auth.js` - Added Google OAuth and guest endpoints
- `server/middleware/authMiddleware.js` - Updated for guest support
- `server/index.js` - Added passport initialization
- `server/db/schema.sql` - Added OAuth fields to users table

### Client
- `client/src/pages/AuthCallback.jsx` (NEW)
- `client/src/pages/Login.jsx` - Rewritten with three auth paths
- `client/src/pages/Auth.module.css` - Added new styles
- `client/src/pages/Profile.jsx` - Added guest user info page
- `client/src/context/AuthContext.jsx` - Added loginWithToken and loginAsGuest
- `client/src/App.jsx` - Added /auth/callback route
- `client/src/components/Sidebar.jsx` - Shows guest badge

## Version 1 Branch

All changes committed to the `version-1` branch. Ready to push to GitHub.
