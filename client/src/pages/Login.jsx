import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

export default function Login() {
  const { login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ email: '', password: '', country: '', state: '', gender: 'other', age: '' });
  const [guestName, setGuestName] = useState('');
  const [mode, setMode] = useState('options'); // 'options' | 'email' | 'guest'
  const [error, setError] = useState(searchParams.get('error') ? 'Authentication failed. Please try again.' : '');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submitEmail = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password, {
        country: form.country,
        state: form.state,
        gender: form.gender,
        age: form.age,
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const submitGuest = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await loginAsGuest(guestName);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start guest session');
    } finally { setLoading(false); }
  };

  const handleGoogle = () => {
    window.location.href = `${SERVER}/api/auth/google`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>NexChat</div>
        <p className={styles.sub}>
          {mode === 'options' && 'Choose how to continue'}
          {mode === 'email' && 'Sign in with email'}
          {mode === 'guest' && 'Continue as guest'}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        {/* OPTIONS SCREEN */}
        {mode === 'options' && (
          <div className={styles.optionList}>
            {/* Google */}
            <button className={styles.oauthBtn} onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>

            <div className={styles.divider}><span>or</span></div>

            {/* Email */}
            <button className={`btn btn-ghost ${styles.altBtn}`} onClick={() => setMode('email')}>
              Sign in with email
            </button>

            {/* Guest */}
            <button className={`btn btn-ghost ${styles.altBtn} ${styles.guestBtn}`} onClick={() => setMode('guest')}>
              Continue as guest
              <span className={styles.guestHint}>No account needed · messages not saved</span>
            </button>
          </div>
        )}

        {/* EMAIL FORM */}
        {mode === 'email' && (
          <form onSubmit={submitEmail} className={styles.form}>
            <div className={styles.field}>
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={handle}
                placeholder="you@example.com" required autoFocus />
            </div>
            <div className={styles.field}>
              <label>Password</label>
              <input name="password" type="password" value={form.password} onChange={handle}
                placeholder="••••••••" required />
            </div>
            <div className={styles.profileNote}>Optional profile details can be added here or later from your profile page.</div>
            <div className={styles.field}>
              <label>Country</label>
              <input name="country" value={form.country} onChange={handle} placeholder="e.g. Canada" />
            </div>
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label>State / Region</label>
                <input name="state" value={form.state} onChange={handle} placeholder="e.g. Ontario" />
              </div>
              <div className={styles.field}>
                <label>Age</label>
                <input name="age" type="number" min="13" max="120" value={form.age} onChange={handle} placeholder="21" />
              </div>
            </div>
            <div className={styles.field}>
              <label>Gender</label>
              <select name="gender" value={form.gender} onChange={handle}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" className={`btn btn-ghost ${styles.backBtn}`}
              onClick={() => setMode('options')}>← Back</button>
          </form>
        )}

        {/* GUEST FORM */}
        {mode === 'guest' && (
          <form onSubmit={submitGuest} className={styles.form}>
            <div className={styles.guestInfo}>
              <span>🎭</span>
              <p>Pick a display name. Your messages vanish when you leave. No data saved.</p>
            </div>
            <div className={styles.field}>
              <label>Display name</label>
              <input
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="e.g. curious_panda"
                maxLength={20}
                required
                autoFocus
              />
              <span className={styles.fieldHint}>Letters, numbers, _ and - only</span>
            </div>
            <button className={`btn btn-primary ${styles.submit}`} disabled={loading || !guestName.trim()}>
              {loading ? 'Starting...' : 'Enter as guest'}
            </button>
            <button type="button" className={`btn btn-ghost ${styles.backBtn}`}
              onClick={() => setMode('options')}>← Back</button>
          </form>
        )}

        {mode === 'options' && (
          <p className={styles.switch}>
            No account? <Link to="/register">Create one free</Link>
          </p>
        )}
      </div>
    </div>
  );
}
