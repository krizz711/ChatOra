import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';
import { Country, State } from 'country-state-city';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

const ERROR_MESSAGES = {
  oauth_failed: 'Google sign-in failed. Check your Google OAuth callback URL and try again.',
  oauth_cancelled: 'Google sign-in was cancelled or did not complete.',
  no_user: 'Google did not return a user profile. Please try again.',
  auth_failed: 'Could not finish sign-in. Please try again.',
  no_token: 'Sign-in completed, but no token was returned. Please try again.',
  invalid_guest_token: 'Guest session token is invalid. Please start a new guest session.',
};

const getLoginErrorMessage = (code) => {
  if (!code) return '';
  return ERROR_MESSAGES[code] || `Authentication failed: ${code}`;
};


export default function Login() {
  const { loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ country: '', state: '', gender: 'other', age: '' });
  const [guestName, setGuestName] = useState('');
  const [mode, setMode] = useState('options'); // 'options' | 'guest'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('error');
    setError(getLoginErrorMessage(code));
  }, [searchParams]);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleCountryChange = e => {
    setForm(p => ({ ...p, country: e.target.value, state: '' }));
  };

  const selectedCountryObj = Country.getAllCountries().find(c => c.name === form.country);
  const availableStates = selectedCountryObj ? State.getStatesOfCountry(selectedCountryObj.isoCode) : [];

  const submitGuest = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await loginAsGuest(guestName, {
        country: form.country,
        state: form.state,
        gender: form.gender,
        age: form.age,
      });
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
      <div className={styles.topLeftLogo}>ChatOra</div>
      <div className={styles.card}>

          <p className={styles.sub}>
            {mode === 'options' && 'Choose how to continue'}
            {mode === 'guest' && 'Continue as guest'}
          </p>

          {/* Online pulse */}
          {mode === 'options' && (
            <div className={styles.onlinePulse}>
              <span className={styles.pulseDot} />
              People are chatting right now
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {/* OPTIONS SCREEN */}
          {mode === 'options' && (
            <div className={styles.optionList}>
              {/* Google */}
              <button className={styles.oauthBtn} onClick={handleGoogle} id="google-login-btn">
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              <div className={styles.divider}><span>or</span></div>

              {/* Guest */}
              <button className={`btn btn-ghost ${styles.altBtn} ${styles.guestBtn}`} onClick={() => setMode('guest')} id="guest-login-btn">
                Continue as guest
                <span className={styles.guestHint}>No account needed · messages not saved</span>
              </button>
            </div>
          )}

          {/* GUEST FORM (now requires full details) */}
          {mode === 'guest' && (
            <form onSubmit={submitGuest} className={styles.form}>
              <div className={styles.guestInfo}>
                <span>🎭</span>
                <p>Provide your display name and profile details. Messages are not stored after your session ends.</p>
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
                  id="guest-name-input"
                />
                <span className={styles.fieldHint}>Letters, numbers, _ and - only</span>
              </div>
              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label>Country</label>
                  <select name="country" value={form.country} onChange={handleCountryChange} required id="guest-country-select">
                    <option value="">Select Country</option>
                    {Country.getAllCountries().map(c => (
                      <option key={c.isoCode} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>State / Region</label>
                  <select name="state" value={form.state} onChange={handle} required={!!availableStates.length} disabled={!availableStates.length && !!form.country} id="guest-state-select">
                    <option value="">Select State</option>
                    {availableStates.map(s => (
                      <option key={`${selectedCountryObj?.isoCode}-${s.isoCode}`} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label>Gender</label>
                  <select name="gender" value={form.gender} onChange={handle} id="guest-gender-select">
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Age</label>
                  <input name="age" type="number" min="13" max="120" value={form.age} onChange={handle} placeholder="21" required id="guest-age-input" />
                </div>
              </div>
              <button className={`btn btn-primary ${styles.submit}`} disabled={loading || !guestName.trim()} id="guest-submit-btn">
                {loading ? 'Starting...' : 'Enter as guest'}
              </button>
              <button type="button" className={`btn btn-ghost ${styles.backBtn}`} 
                onClick={() => setMode('options')} id="guest-back-btn">← Back</button>
            </form>
          )}

          {mode === 'options' && (
            <>
              <p className={styles.switch}>
                No account? <Link to="/register">Create one free</Link>
              </p>
              <div className={styles.securityFooter}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Encrypted & secure · No data sold
              </div>
            </>
          )}
        </div>
    </div>
  );
}
