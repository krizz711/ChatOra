import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Pencil, Mail, User, MapPin, Calendar, ArrowLeft, Upload, Globe, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, uploadAvatar, updateCallSettings } from '../utils/api';
import { getStoredToken } from '../utils/token';
import axios from 'axios';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewingUser, setViewingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    country: user?.country || '',
    state: user?.state || '',
    gender: user?.gender || 'other',
    age: user?.age || '',
  });
  const [saving, setSaving] = useState(false);
  const [callsEnabled, setCallsEnabled] = useState(user?.calls_enabled ?? true);
  const [notifSound, setNotifSound] = useState(user?.notification_sound ?? true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const SERVER = import.meta.env.VITE_SERVER_URL || '';
  const initials = (name) => name?.slice(0, 2).toUpperCase() || '??';

  useEffect(() => {
    setForm({
      username: user?.username || '',
      bio: user?.bio || '',
      country: user?.country || '',
      state: user?.state || '',
      gender: user?.gender || 'other',
      age: user?.age || '',
    });
  }, [user]);

  useEffect(() => {
    setCallsEnabled(user?.calls_enabled ?? true);
    setNotifSound(user?.notification_sound ?? true);
  }, [user]);

  // Check if viewing another user
  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId) {
      setLoading(true);
      const token = getStoredToken();
      axios.get(`${SERVER}/api/auth/users/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.data)
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

  // Guest
  if (user?.isGuest) {
    return (
      <div className={styles.page}>
        <motion.div className={styles.card}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back to chat
          </button>
          <h1 className={styles.title}>Guest Session</h1>
          <div className={styles.guestInfo}>
            <p>You're chatting as <strong>{user.username}</strong> (guest).</p>
            <p>Guests can't edit profiles or upload avatars.</p>
            <p>Your session expires in 4 hours.</p>
          </div>
          <div className={styles.actions}>
            <motion.button className={styles.primaryBtn}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/login')}>
              Create a real account
            </motion.button>
            <button className={styles.ghostBtn} onClick={() => navigate('/')}>
              Back to chat
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className={styles.page}>
        <motion.div className={styles.card}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.loadingState}>Loading profile...</div>
        </motion.div>
      </div>
    );
  }

  // Viewing another user
  if (viewingUser) {
    return (
      <div className={styles.page}>
        <motion.div className={styles.card}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>

          <h1 className={styles.title}>{viewingUser.username}'s Profile</h1>

          {/* Avatar + Identity */}
          <div className={styles.profileHeader}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatarBig}>
                {viewingUser.avatar_url
                  ? <img src={viewingUser.avatar_url} alt={viewingUser.username} />
                  : initials(viewingUser.username)}
              </div>
            </div>
            <div className={styles.identity}>
              <h2>{viewingUser.username}</h2>
              <p className={styles.bio}>{viewingUser.bio || 'No bio yet.'}</p>
              <div className={styles.starBadge}>
                <Star size={14} /> {viewingUser.star_count || 0}
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <Calendar size={14} />
              <div>
                <span className={styles.infoLabel}>Member since</span>
                <span className={styles.infoValue}>{new Date(viewingUser.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Globe size={14} />
              <div>
                <span className={styles.infoLabel}>Country</span>
                <span className={styles.infoValue}>{viewingUser.country || 'Not provided'}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <MapPin size={14} />
              <div>
                <span className={styles.infoLabel}>State / Region</span>
                <span className={styles.infoValue}>{viewingUser.state || 'Not provided'}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Users size={14} />
              <div>
                <span className={styles.infoLabel}>Gender</span>
                <span className={styles.infoValue}>{viewingUser.gender || 'other'}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <User size={14} />
              <div>
                <span className={styles.infoLabel}>Age</span>
                <span className={styles.infoValue}>{viewingUser.age || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <motion.button className={styles.primaryBtn}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/')}>
              Go back to chat
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Own Profile ---
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

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await updateCallSettings({ calls_enabled: callsEnabled, notification_sound: notifSound });
      setMsg('Settings saved!');
    } catch {
      setError('Failed to save settings');
    } finally { setSettingsSaving(false); }
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
      <motion.div className={styles.card}
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>

        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Back to chat
        </button>

        <h1 className={styles.title}>My Profile</h1>

        {msg && <div className={styles.successMsg}>{msg}</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {/* Avatar + Identity */}
        <div className={styles.profileHeader}>
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
            <p className={styles.bio}>{user?.bio || 'Set your bio to help others know you better.'}</p>
            <div className={styles.starBadge}>
              <Star size={14} /> {user?.star_count || 0}
            </div>
          </div>
        </div>

        {/* Change Avatar */}
        <input type="file" ref={fileRef} onChange={handleAvatarChange}
          accept="image/*" style={{ display: 'none' }} />
        <motion.button className={styles.avatarBtn}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Change Avatar'}
        </motion.button>
        <p className={styles.avatarHint}>JPG, PNG, GIF up to 10MB</p>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{user?.star_count || 0}</span>
            <span className={styles.statLabel}>Stars</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{user?.country ? '✓' : '—'}</span>
            <span className={styles.statLabel}>Location</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{user?.gender === 'female' ? '♀' : user?.gender === 'male' ? '♂' : '⚪'}</span>
            <span className={styles.statLabel}>Gender</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{user?.age || '—'}</span>
            <span className={styles.statLabel}>Age</span>
          </div>
        </div>

        {/* Edit Form */}
        <form className={styles.formSection} onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className={styles.inputWrap}>
            <input name="username" value={form.username} onChange={handle} placeholder="Username" />
            <Pencil className={styles.inputIcon} size={14} />
          </div>
          <div className={styles.inputWrap}>
            <input value={user?.email} disabled className={styles.disabled} />
            <Mail className={styles.inputIcon} size={14} />
          </div>
          <div className={styles.inputWrap}>
            <textarea name="bio" value={form.bio} onChange={handle}
              placeholder="Tell people about yourself..." rows={3} />
          </div>
          <div className={styles.inputWrap}>
            <input name="country" value={form.country} onChange={handle} placeholder="Country" />
            <Globe className={styles.inputIcon} size={14} />
          </div>
          <div className={styles.twoCol}>
            <div className={styles.inputWrap}>
              <input name="state" value={form.state} onChange={handle} placeholder="State / Region" />
              <MapPin className={styles.inputIcon} size={14} />
            </div>
            <div className={styles.inputWrap}>
              <input name="age" type="number" min="13" max="120" value={form.age} onChange={handle} placeholder="Age" />
            </div>
          </div>
          <div className={styles.inputWrap}>
            <select name="gender" value={form.gender} onChange={handle}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ marginTop: 8, marginBottom: 2, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.1px', color: 'var(--text3)' }}>
            Settings
          </div>
          <div className={styles.inputWrap} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }} htmlFor="allow-calls">
              Allow incoming calls
            </label>
            <input
              id="allow-calls"
              type="checkbox"
              checked={callsEnabled}
              onChange={(e) => setCallsEnabled(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
            />
          </div>
          <div className={styles.inputWrap} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }} htmlFor="notif-sound">
              Notification sounds
            </label>
            <input
              id="notif-sound"
              type="checkbox"
              checked={notifSound}
              onChange={(e) => setNotifSound(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
            />
          </div>
          <motion.button className={styles.primaryBtn}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={saveSettings} disabled={settingsSaving}>
            {settingsSaving ? 'Saving...' : 'Save Settings'}
          </motion.button>

          {/* Save */}
          <motion.button type="submit" className={styles.primaryBtn}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>
        </form>

        {/* Info Footer */}
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <Calendar size={14} />
            <div>
              <span className={styles.infoLabel}>Member since</span>
              <span className={styles.infoValue}>{new Date(user?.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className={styles.infoItem}>
            <Mail size={14} />
            <div>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
