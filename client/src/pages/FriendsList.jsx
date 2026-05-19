import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageBack from '../components/PageBack';
import { fetchFriendsForUser, fetchUserProfile, unfriend } from '../utils/api';
import styles from './FriendsList.module.css';
import { X } from 'lucide-react';

const initials = (name) => name?.slice(0, 2).toUpperCase() || '??';

export default function FriendsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user') || user?.id;
  const isOwn = !searchParams.get('user') || searchParams.get('user') === user?.id;

  const [friends, setFriends] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [unfriending, setUnfriending] = useState(null);

  useEffect(() => {
    if (!targetUserId) return;
    if (!isOwn) {
      fetchUserProfile(targetUserId)
        .then((data) => setDisplayName(data?.user?.username || 'User'))
        .catch(() => setDisplayName('User'));
    } else {
      setDisplayName(user?.username || 'You');
    }
  }, [targetUserId, isOwn, user?.username]);

  useEffect(() => {
    if (!targetUserId) return;
    setLoading(true);
    fetchFriendsForUser(targetUserId)
      .then((data) => {
        if (data?.hidden) {
          setHidden(true);
          setFriends([]);
        } else {
          setHidden(false);
          setFriends(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        setFriends([]);
        setHidden(false);
      })
      .finally(() => setLoading(false));
  }, [targetUserId]);

  const handleUnfriend = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
    setUnfriending(friendId);
    try {
      await unfriend(friendId);
      setFriends(friends.filter(f => f.id !== friendId));
    } catch (err) {
      alert('Failed to remove friend');
    } finally {
      setUnfriending(null);
    }
  };

  const title = isOwn ? 'My Friends' : `${displayName}'s Friends`;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <PageBack label="Back" onClick={() => navigate(-1)} />

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>
          {hidden
            ? 'This user has hidden their friends list.'
            : `${friends.length} friend${friends.length === 1 ? '' : 's'}`}
        </p>

        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : hidden ? (
          <div className={styles.empty}>
            <span className={styles.lockIcon}>🔒</span>
            Friends list is private
          </div>
        ) : friends.length === 0 ? (
          <div className={styles.empty}>No friends yet.</div>
        ) : (
          <ul className={styles.list}>
            {friends.map((f) => (
              <li key={f.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => navigate(`/profile?user=${f.id}`)}
                >
                  <div className={styles.avatar}>
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt="" />
                    ) : (
                      initials(f.username)
                    )}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>{f.username}</div>
                    {f.bio && <div className={styles.bio}>{f.bio}</div>}
                  </div>
                </button>
                {isOwn && (
                  <button
                    type="button"
                    className={styles.unfriendBtn}
                    onClick={() => handleUnfriend(f.id)}
                    disabled={unfriending === f.id}
                    title="Remove friend"
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
