import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', country: '', state: '', gender: 'other', age: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form.username, form.email, form.password, {
        country: form.country,
        state: form.state,
        gender: form.gender,
        age: form.age,
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>NexChat</div>
        <p className={styles.sub}>Create your account</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.field}>
            <label>Username</label>
            <input name="username" value={form.username} onChange={handle}
              placeholder="coolname123" required autoFocus />
          </div>
          <div className={styles.field}>
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handle}
              placeholder="you@example.com" required />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input name="password" type="password" value={form.password} onChange={handle}
              placeholder="min. 6 characters" required />
          </div>
          <div className={styles.field}>
            <label>Country</label>
            <input name="country" value={form.country} onChange={handle}
              placeholder="e.g. United States" />
          </div>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label>State / Region</label>
              <input name="state" value={form.state} onChange={handle}
                placeholder="e.g. California" />
            </div>
            <div className={styles.field}>
              <label>Age</label>
              <input name="age" type="number" min="13" max="120" value={form.age} onChange={handle}
                placeholder="18" />
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
