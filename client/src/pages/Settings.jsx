import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageBack from '../components/PageBack';
import {
  fetchSettings,
  updateSettings,
  sendHelpMessage,
  unblockUser,
} from '../utils/api';
import { setNotificationSoundEnabled } from '../utils/notifications';
import styles from './Settings.module.css';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helpText, setHelpText] = useState('');
  const [helpStatus, setHelpStatus] = useState('');
  const [error, setError] = useState('');

  const [friendsListHidden, setFriendsListHidden] = useState(false);
  const [notificationSound, setNotificationSound] = useState(true);
  const [blocked, setBlocked] = useState([]);

  useEffect(() => {
    if (user?.isGuest) {
      navigate('/profile');
      return;
    }
    fetchSettings()
      .then((data) => {
        setFriendsListHidden(!!data.friends_list_hidden);
        setNotificationSound(data.notification_sound !== false);
        setNotificationSoundEnabled(data.notification_sound !== false);
        setBlocked(data.blocked || []);
      })
      .catch(() => setError('Could not load settings'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const persist = async (patch) => {
    setSaving(true);
    setError('');
    try {
      const data = await updateSettings(patch);
      if (patch.friends_list_hidden !== undefined) {
        setFriendsListHidden(!!data.friends_list_hidden);
        updateUser({ ...user, friends_list_hidden: data.friends_list_hidden });
      }
      if (patch.notification_sound !== undefined) {
        const on = data.notification_sound !== false;
        setNotificationSound(on);
        setNotificationSoundEnabled(on);
        updateUser({ ...user, notification_sound: on });
      }
    } catch {
      setError('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await unblockUser(userId);
      setBlocked((list) => list.filter((b) => b.blocked?.id !== userId));
    } catch {
      setError('Failed to unblock user');
    }
  };

  const handleHelp = async (e) => {
    e.preventDefault();
    if (helpText.trim().length < 10) {
      setHelpStatus('Please write at least 10 characters.');
      return;
    }
    setHelpStatus('');
    try {
      const res = await sendHelpMessage(helpText.trim());
      setHelpText('');
      setHelpStatus(res.delivered
        ? 'Message sent. We will get back to you soon.'
        : 'Message received. Thank you for reaching out.');
    } catch {
      setHelpStatus('Could not send message. Try again later.');
    }
  };

  if (user?.isGuest) return null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <PageBack label="Back" onClick={() => navigate(-1)} />

        <h1 className={styles.title}>Settings</h1>
        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <p className={styles.muted}>Loading...</p>
        ) : (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Privacy</h2>
              <label className={styles.toggleRow}>
                <span>
                  <strong>Hide friends list</strong>
                  <small>Others cannot see your full friends list on your profile</small>
                </span>
                <input
                  type="checkbox"
                  checked={friendsListHidden}
                  disabled={saving}
                  onChange={(e) => persist({ friends_list_hidden: e.target.checked })}
                />
              </label>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Notifications</h2>
              <label className={styles.toggleRow}>
                <span>
                  <strong>Notification sounds</strong>
                  <small>Play sounds for calls and alerts</small>
                </span>
                <input
                  type="checkbox"
                  checked={notificationSound}
                  disabled={saving}
                  onChange={(e) => persist({ notification_sound: e.target.checked })}
                />
              </label>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Blocked users</h2>
              {blocked.length === 0 ? (
                <p className={styles.muted}>You have not blocked anyone.</p>
              ) : (
                <ul className={styles.blockList}>
                  {blocked.map((row) => {
                    const u = row.blocked;
                    if (!u) return null;
                    return (
                      <li key={row.id} className={styles.blockRow}>
                        <span>{u.username}</span>
                        <button
                          type="button"
                          className={styles.unblockBtn}
                          onClick={() => handleUnblock(u.id)}
                        >
                          Unblock
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Help & support</h2>
              <p className={styles.muted}>
                Send a message to the NexChat team. It goes to our support inbox.
              </p>
              <form onSubmit={handleHelp} className={styles.helpForm}>
                <textarea
                  className={styles.textarea}
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  placeholder="Describe your issue or question..."
                  rows={4}
                  maxLength={2000}
                />
                <button type="submit" className={styles.submitBtn} disabled={helpText.trim().length < 10}>
                  Send message
                </button>
                {helpStatus && <p className={styles.helpStatus}>{helpStatus}</p>}
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
