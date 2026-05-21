import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

export default function Register() {
  const navigate = useNavigate();

  const handleGoogle = () => {
    window.location.href = `${SERVER}/api/auth/google`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.topLeftLogo}>ChatOra</div>
      <div className={styles.card}>
        <p className={styles.sub}>Create your account</p>

        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text2)' }}>
          <p>Sign up using Google to create your account.</p>
        </div>

        <button className={styles.oauthBtn} onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign up with Google
        </button>

        <p className={styles.switch}>
          Already have an account? <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}>Sign in</button>
        </p>
      </div>
    </div>
  );
}
