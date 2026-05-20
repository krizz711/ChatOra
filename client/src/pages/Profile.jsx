import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload } from 'lucide-react';
import PageBack from '../components/PageBack';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import {
  updateProfile,
  uploadAvatar,
  blockUser,
  updateFlairs,
  fetchMe,
  fetchUserProfile,
  fetchFriendsForUser,
} from '../utils/api';
import styles from './Profile.module.css';
import { getUserFlairs } from '../utils/flairs';
import FlairPicker from '../components/FlairPicker';
import FlairBadge from '../components/FlairBadge';
import { getCode } from 'country-list';
import 'flag-icons/css/flag-icons.min.css';
import { Country, State } from 'country-state-city';

const getCountryCode = (country) => {
  if (!country) return null;
  let code = country.length === 2 ? country.toUpperCase() : getCode(country);
  return code ? code.toLowerCase() : null;
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewingUser, setViewingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [friendsHidden, setFriendsHidden] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    country: user?.country || '',
    state: user?.state || '',
    gender: user?.gender || 'other',
    age: user?.age || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const [showFlairPicker, setShowFlairPicker] = useState(false);

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

  // Check if viewing another user
  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId) {
      setLoading(true);
      fetchUserProfile(userId)
        .then((data) => {
          if (data?.success) setViewingUser(data.user);
          else setViewingUser(null);
        })
        .catch(() => setViewingUser(null))
        .finally(() => setLoading(false));
      return;
    }
    setViewingUser(null);
    setLoading(false);
  }, [searchParams]);

  // Fetch friends of target user
  let target = viewingUser || user;

  useEffect(() => {
    if (target?.id) {
      fetchFriendsForUser(target.id)
        .then((data) => {
          if (data?.hidden) {
            setFriendsHidden(true);
            setFriendsList([]);
          } else {
            setFriendsHidden(false);
            setFriendsList(Array.isArray(data) ? data : []);
          }
        })
        .catch(() => {
          setFriendsHidden(false);
          setFriendsList([]);
        });
    } else {
      setFriendsList([]);
    }
  }, [target?.id]);

  // Listen for real-time friend updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleFriendRemoved = ({ removedUserId }) => {
      setFriendsList(prev => prev.filter(f => f.id !== removedUserId));
    };

    socket.on('friend:removed', handleFriendRemoved);

    return () => socket.off('friend:removed', handleFriendRemoved);
  }, []);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleCountryChange = e => {
    setForm(p => ({ ...p, country: e.target.value, state: '' }));
  };

  const selectedCountryObj = Country.getAllCountries().find(c => c.name === form.country);
  const availableStates = selectedCountryObj ? State.getStatesOfCountry(selectedCountryObj.isoCode) : [];

  const saveProfile = async () => {
    setSaving(true); setMsg(''); setError('');
    try {
      const data = await updateProfile(form);
      updateUser(data.user);
      setMsg('Profile updated!');
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(''); setError('');
    try {
      const data = await uploadAvatar(file);
      updateUser(data.user);
      setMsg('Avatar updated!');
    } catch { setError('Avatar upload failed'); }
    finally { setUploading(false); fileRef.current.value = ''; }
  };

  // Guest view
  if (user?.isGuest && !viewingUser) {
    return (
      <div className={styles.page}>
        <motion.div className={styles.card} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <PageBack label="Back to chat" onClick={() => navigate('/')} className={styles.backBtnWrap} />
          <div className={styles.sectionTitle} style={{ marginTop: 16 }}>Guest Session</div>
          <div>
            <p>You're chatting as <strong>{user.username}</strong> (guest).</p>
            <p>Guests can't edit profiles or upload avatars. Your session expires in 4 hours.</p>
          </div>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => navigate('/login')}>
            Create a real account
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className={styles.page}><div className={styles.card}>Loading profile...</div></div>;
  if (!target) return <div className={styles.page}><div className={styles.card}>User not found.</div></div>;

  const isMe = !viewingUser;

  return (
    <div className={styles.page}>
      <motion.div className={styles.card}
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>

        <PageBack label="Back" onClick={() => navigate(-1)} className={styles.backBtnWrap} />

        {msg && <div className={styles.successMsg}>{msg}</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {/* PROFILE HEADER */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarCol}>
            <div className={styles.avatarBig}>
              {target.avatar_url
                ? <img src={target.avatar_url} alt={target.username} />
                : initials(target.username)}
            </div>
            {isMe && (
              <>
                <input type="file" ref={fileRef} onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />
                <button
                  className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={12} /> {uploading ? '...' : 'Edit PFP'}
                </button>
              </>
            )}
          </div>
          <div className={styles.infoCol}>
            <div className={styles.nameRow}>
              {!isEditing && getCountryCode(target.country) && (
                <span
                  className={`fi fi-${getCountryCode(target.country)} ${styles.countryFlagIcon}`}
                  title={target.country}
                ></span>
              )}
              <h1 className={styles.userName}>
                {isEditing ? (
                  <input name="username" value={form.username} onChange={handle} className={styles.detailInput} style={{ fontSize: 20, padding: '4px 8px' }} />
                ) : target.username}
              </h1>
            </div>

            <div className={styles.badgesRow}>
              {target.role === 'admin' && <div className={styles.badge} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>Admin</div>}
              {getUserFlairs(target, { showPrivate: isMe }).map(f => (
                <FlairBadge key={f.id} flair={f} />
              ))}
            </div>

            {!isMe && !user?.isGuest && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                style={{ color: 'var(--red)', borderColor: 'var(--red)', marginTop: 4 }}
                onClick={async () => {
                  if (!window.confirm(`Block ${target.username}? They will not be able to interact with you.`)) return;
                  try {
                    await blockUser(target.id);
                    setMsg('User blocked. Manage blocked users in Settings.');
                  } catch {
                    setError('Could not block user. Run the latest database migration if needed.');
                  }
                }}
              >
                Block user
              </button>
            )}

            {isMe && (
              <div className={styles.headerActions}>
                {isEditing ? (
                  <button className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`} onClick={saveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                ) : (
                  <button className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`} onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </button>
                )}
                <button className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`} onClick={() => setShowFlairPicker(true)}>
                  {(user?.flair || (user?.flairs && user.flairs.length > 0)) ? 'Change Flair' : 'Add Flair'}
                </button>
                {(user?.flair || (user?.flairs && user.flairs.length > 0)) && (
                  <button
                    className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
                    style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                    onClick={async () => {
                      try {
                        const data = await updateFlairs([]);
                        if (data?.user) updateUser(data.user);
                        else {
                          const me = await fetchMe();
                          if (me?.user) updateUser(me.user);
                        }
                      } catch (e) {
                        alert(e.response?.data?.error || 'Failed to remove flair');
                      }
                    }}
                  >
                    Remove Flair
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* STATS SECTION */}
        <div className={styles.statsSection}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{new Date(target.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
            <span className={styles.statLabel}>Member Since</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{target.star_count || 0}</span>
            <span className={styles.statLabel}>Stars</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{friendsList.length}</span>
            <span className={styles.statLabel}>Friends</span>
          </div>
        </div>

        {/* BIO SECTION */}
        <div className={styles.bioSection}>
          <div className={styles.sectionTitle}>About Me</div>
          {isEditing ? (
            <textarea
              name="bio"
              className={styles.bioInput}
              value={form.bio}
              onChange={handle}
              placeholder="Tell people about yourself..."
            />
          ) : (
            <div className={styles.bioCard}>
              {target.bio || 'This user has not set a bio yet.'}
            </div>
          )}
        </div>

        {/* DETAILS SECTION */}
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Location</span>
            {isEditing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <select name="country" value={form.country} onChange={handleCountryChange} className={styles.detailInput}>
                  <option value="">Select Country</option>
                  {Country.getAllCountries().map(c => (
                    <option key={c.isoCode} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <select name="state" value={form.state} onChange={handle} className={styles.detailInput} disabled={!availableStates.length && !!form.country}>
                  <option value="">Select State</option>
                  {availableStates.map(s => (
                    <option key={`${selectedCountryObj?.isoCode}-${s.isoCode}`} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.detailValue}>
                {target.state || target.country ? `${target.state ? target.state + ', ' : ''}${target.country || ''}` : 'Not provided'}
              </div>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Gender</span>
            {isEditing ? (
              <select name="gender" value={form.gender} onChange={handle} className={styles.detailInput}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <div className={styles.detailValue}>
                {target.gender ? target.gender.charAt(0).toUpperCase() + target.gender.slice(1) : 'Not provided'}
              </div>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Age</span>
            {isEditing ? (
              <input name="age" type="number" value={form.age} onChange={handle} className={styles.detailInput} />
            ) : (
              <div className={styles.detailValue}>
                {target.age || 'Not provided'}
              </div>
            )}
          </div>
        </div>

        {/* FRIENDS PREVIEW SECTION */}
        <div className={styles.sectionTitle} style={{ marginTop: 8 }}>Friends Network</div>
        <div className={styles.friendsPreview}>
          <div className={styles.friendsAvatars}>
            {friendsList.slice(0, 3).map((f, i) => (
              <div key={i} className={styles.friendAvatar}>
                {f.avatar_url ? <img src={f.avatar_url} alt={f.username} title={f.username} /> : <span title={f.username}>{initials(f.username)}</span>}
              </div>
            ))}
            {friendsList.length > 3 && (
              <div className={styles.friendAvatar} style={{ background: 'var(--border)', color: 'var(--text)' }}>
                +{friendsList.length - 3}
              </div>
            )}
            {friendsList.length === 0 && !friendsHidden && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 8 }}>No friends yet.</div>
            )}
            {friendsHidden && !isMe && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 8 }}>Friends list is private</div>
            )}
          </div>
          {(isMe || !friendsHidden) && (
            <button
              type="button"
              className={styles.viewAllBtn}
              onClick={() => navigate(isMe ? '/friends' : `/friends?user=${target.id}`)}
            >
              View All <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
        </div>

      </motion.div>
      {showFlairPicker && (
        <FlairPicker
          user={user}
          onSave={async (flairIds) => {
            try {
              const data = await updateFlairs(flairIds);
              if (data?.user) updateUser(data.user);
              else {
                const me = await fetchMe();
                if (me?.user) updateUser(me.user);
              }
            } catch (e) {
              const msg = e.response?.data?.error || 'Failed to save flairs';
              console.error('Failed to save flairs', e);
              alert(msg);
            }
          }}
          onClose={() => setShowFlairPicker(false)}
        />
      )}
    </div>
  );
}
