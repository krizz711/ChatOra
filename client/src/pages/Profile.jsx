import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, uploadAvatar } from '../utils/api';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewingUser, setViewingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: user?.username || '', bio: user?.bio || '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const SERVER = import.meta.env.VITE_SERVER_URL || '';
  const initials = (name) => name?.slice(0, 2).toUpperCase() || '??';

  // Check if viewing another user
  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId) {
      setLoading(true);
      fetch(`${SERVER}/api/auth/users/${userId}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) setViewingUser(data.user);
          else setViewingUser(null);
        })
        .catch(() => setViewingUser(null))
        .finally(() => setLoading(false));
      return;
    }
    setViewingUser(null);
    setLoading(false);
  }, [searchParams, SERVER]);

  // Guest user check
  if (user?.isGuest) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <button className={styles.back} onClick={() => navigate('/')}>← Back to chat</button>
          <h1 className={styles.title}>Guest Session</h1>
          <div style={{ padding: '20px 0', color: 'var(--text2)', fontSize: 14, lineHeight: 1.7 }}>
            <p>You're chatting as <strong>{user.username}</strong> (guest).</p>
            <p style={{ marginTop: 8 }}>Guests can't edit profiles or upload avatars.</p>
            <p style={{ marginTop: 8 }}>Your session expires in 4 hours.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Create a real account
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              Back to chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while fetching other user
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  // Viewing another user's profile
  if (viewingUser) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <button className={styles.back} onClick={() => navigate(-1)}>← Back</button>

          <h1 className={styles.title}>{viewingUser.username}'s Profile</h1>

          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatarBig}>
                {viewingUser.avatar_url
                  ? <img src={viewingUser.avatar_url} alt={viewingUser.username} />
                  : initials(viewingUser.username)}
              </div>
            </div>
            <div className={styles.identity}>
              <h2>{viewingUser.username}</h2>
              <p>{viewingUser.bio || 'No bio yet.'}</p>
            </div>
          </div>

          {/* Info */}
          <div className={styles.info}>
            <div className={styles.infoRow}>
              <span>Member since</span>
              <span>{new Date(viewingUser.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Go back to chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const save = async () => {
    setSaving(true); setMsg(''); setError('');
    try {
      const data = await updateProfile(form);
      updateUser(data.user);
      setMsg('Profile updated!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadAvatar(file);
      updateUser(data.user);
      setMsg('Avatar updated!');
    } catch { setError('Avatar upload failed'); }
    finally { setUploading(false); fileRef.current.value = ''; }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.back} onClick={() => navigate('/')}>Back to chat</button>

        <h1 className={styles.title}>My Profile</h1>

        {msg && <div className={styles.success}>{msg}</div>}
        {error && <div className={styles.error}>{error}</div>}

        {/* Avatar */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarBig}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt={user.username} />
                : initials(user?.username)}
            </div>
            <span className={styles.statusDot} />
          </div>
          <div className={styles.identity}>
            <h2>{user?.username}</h2>
            <p>{user?.bio || 'Set your bio to help others know you better.'}</p>
            <input type="file" ref={fileRef} onChange={handleAvatarChange}
              accept="image/*" style={{display:'none'}} />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Change avatar'}
            </button>
            <div className={styles.avatarHint}>JPG, PNG, GIF up to 10MB</div>
          </div>
        </div>

        {/* Form */}
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Username</label>
            <input name="username" value={form.username} onChange={handle} />
          </div>
          <div className={styles.field}>
            <label>Email</label>
            <input value={user?.email} disabled className={styles.disabled} />
          </div>
          <div className={styles.field}>
            <label>Bio</label>
            <textarea name="bio" value={form.bio} onChange={handle}
              placeholder="Tell people about yourself..." rows={3}
              style={{resize:'vertical'}} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.infoRow}>
            <span>Member since</span>
            <span>{new Date(user?.created_at).toLocaleDateString()}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Email</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
