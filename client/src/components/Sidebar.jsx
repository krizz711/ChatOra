import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import {
  fetchGroups,
  createGroup,
  joinGroup,
  joinByInvite,
  leaveGroup,
  fetchFriends,
  fetchFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
} from '../utils/api';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeRoom, onRoomSelect, onlineUsers, onUserClick, onCallUser, onUserStar, starringUserId }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState({ globalGroups: [], userGroups: [], publicGroups: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState('active');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState([]);
  const [requestCount, setRequestCount] = useState(0);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [userSort, setUserSort] = useState('popularity');
  useEffect(() => { loadGroups(); loadFriends(); }, [user]);
  useEffect(() => { if (activePanel === 'friends') loadFriends(); }, [activePanel]);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onFriendRequest = ({ request }) => {
      setFriendRequests(prev => {
        const exists = prev.find(r => r.id === request.id);
        if (exists) return prev;
        return [request, ...prev];
      });
      setRequestCount(prev => prev + 1);
    };

    socket.on('friend:request', onFriendRequest);
    return () => socket.off('friend:request', onFriendRequest);
  }, []);


  const loadGroups = async () => {
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch { }
  };

  const loadFriends = async () => {
    if (user?.isGuest) return;
    setFriendsLoading(true);
    try {
      const [friends, requests] = await Promise.all([fetchFriends(), fetchFriendRequests()]);
      setFriends(friends || []);
      setFriendRequests(requests || []);
      setRequestCount((requests || []).length);
    } catch { }
    finally { setFriendsLoading(false); }
  };

  const handleFriendRequestAction = async (action, id) => {
    try {
      await action(id);
      await loadFriends();
    } catch { }
  };

  const handleSendFriendRequest = async (userId, e) => {
    e.stopPropagation();
    try {
      await sendFriendRequest(userId);
      alert('Request sent');
      setPendingOutgoing(prev => prev.includes(userId) ? prev : [...prev, userId]);
    } catch { }
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setLoading(true);
    try {
      await createGroup(newGroupName.trim(), isPrivate);
      setNewGroupName(''); setIsPrivate(false); setShowCreate(false);
      await loadGroups();
    } catch { } finally { setLoading(false); }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await joinByInvite(inviteCode.trim());
      setInviteCode(''); setShowJoin(false);
      await loadGroups();
    } catch { } finally { setLoading(false); }
  };

  const handleJoinPublic = async (groupId) => {
    try {
      await joinGroup(groupId);
      await loadGroups();
    } catch { }
  };

  const handleLeave = async (groupId, e) => {
    e.stopPropagation();
    try { await leaveGroup(groupId); await loadGroups(); } catch { }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const initials = (name) => name?.slice(0, 2).toUpperCase() || '??';
  const sameLocationRank = (u) => {
    const sameState = user?.state && u.state && user.state.toLowerCase() === u.state.toLowerCase();
    const sameCountry = user?.country && u.country && user.country.toLowerCase() === u.country.toLowerCase();
    if (sameState) return 2;
    if (sameCountry) return 1;
    return 0;
  };

  const filteredOnlineUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return [...(onlineUsers || [])]
      .filter(u => {
        if (genderFilter !== 'all' && u.gender !== genderFilter) return false;
        if (!q) return true;
        return [u.username, u.country, u.state]
          .filter(Boolean)
          .some(value => value.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (userSort === 'nearest') {
          const byLocation = sameLocationRank(b) - sameLocationRank(a);
          if (byLocation) return byLocation;
        }
        if (userSort === 'name') return (a.username || '').localeCompare(b.username || '');
        return (b.stars || 0) - (a.stars || 0);
      });
  }, [onlineUsers, userSearch, genderFilter, userSort, user?.country, user?.state]);

  return (
    <div className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.logo}>NexChat</span>
        <div className={styles.headerActions}>

          <button className={styles.iconBtn} onClick={() => navigate('/profile')} title="Profile">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={logout} title="Logout">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* User info */}
      <div className={styles.userInfo}>
        <div className="avatar">{user?.avatar_url
          ? <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : initials(user?.username)}
        </div>
        <div>
          <div className={styles.userName}>{user?.username}</div>
          <div className={styles.userStatus}>
            <span className={styles.dot} />
            {user?.isGuest ? (
              <span style={{ color: 'var(--yellow)', fontSize: 11 }}>Guest · 4h session</span>
            ) : 'Online'}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tabBtn} ${activePanel === 'rooms' ? styles.tabActive : ''}`} onClick={() => setActivePanel('rooms')}>
          Rooms
        </button>
        <button className={`${styles.tabBtn} ${activePanel === 'active' ? styles.tabActive : ''}`} onClick={() => setActivePanel('active')}>
          Active
        </button>
        <button
          className={`${styles.tabBtn} ${activePanel === 'friends' ? styles.tabActive : ''}`}
          onClick={() => { setActivePanel('friends'); setRequestCount(0); }}
        >
          Friends
          {requestCount > 0 && (
            <span style={{
              marginLeft: 6,
              background: 'var(--red)',
              color: '#fff',
              borderRadius: '99px',
              fontSize: 10,
              fontWeight: 800,
              padding: '1px 6px',
              lineHeight: '16px',
            }}>
              {requestCount}
            </span>
          )}
        </button>
      </div>

      <div className={styles.scroll}>
        {/* Global Rooms */}
        {activePanel === 'rooms' && <div className={styles.section}>
          <div className={styles.sectionLabel}>Global Rooms</div>
          {groups.globalGroups?.map(g => (
            <button key={g.id} className={`${styles.roomBtn} ${activeRoom?.id === g.id ? styles.active : ''}`}
              onClick={() => onRoomSelect(g)}>
              <span className={styles.roomName}>{g.name}</span>
            </button>
          ))}
        </div>}

        {/* My Groups */}
        {activePanel === 'rooms' && <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>My Groups</div>
            <button className={styles.addBtn} onClick={() => setShowCreate(!showCreate)}>+</button>
          </div>

          {showCreate && (
            <div className={styles.createForm}>
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Group name" onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                Private (invite only)
              </label>
              <div className={styles.formActions}>
                <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>Create</button>
              </div>
            </div>
          )}

          {groups.userGroups?.map(g => (
            <button key={g.id} className={`${styles.roomBtn} ${activeRoom?.id === g.id ? styles.active : ''}`}
              onClick={() => onRoomSelect(g)}>
              <span className={styles.roomName}>
                {g.is_private ? '[Private] ' : ''}{g.name}
              </span>
              {g.invite_code && (
                <span className={styles.codeChip} onClick={e => { e.stopPropagation(); copyCode(g.invite_code); }}
                  title="Copy invite code">
                  {copiedCode === g.invite_code ? 'Copied' : g.invite_code}
                </span>
              )}
              <span className={styles.leaveBtn} onClick={e => handleLeave(g.id, e)} title="Leave">x</span>
            </button>
          ))}

          <button className={styles.joinLink} onClick={() => setShowJoin(!showJoin)}>
            + Join by invite code
          </button>

          {showJoin && (
            <div className={styles.createForm}>
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter code e.g. A1B2C3D4" maxLength={8}
                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()} autoFocus />
              <div className={styles.formActions}>
                <button className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleJoinByCode} disabled={loading}>Join</button>
              </div>
            </div>
          )}
        </div>}

        {/* Friends */}
        {activePanel === 'friends' && (
          <>
            {friendRequests.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Requests</div>
                {friendRequests.map(request => (
                  <div key={request.id} className={styles.discoverRow}>
                    <span className={styles.roomName}>{request.from_user?.username || 'Unknown user'}</span>
                    <div className={styles.userMeta}>
                      <button className={styles.profileSmall} type="button" onClick={() => handleFriendRequestAction(acceptFriendRequest, request.id)}>
                        Accept
                      </button>
                      <button className={styles.profileSmall} type="button" onClick={() => handleFriendRequestAction(declineFriendRequest, request.id)}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Friends</div>
              {friendsLoading && <div className={styles.emptyState}>Loading...</div>}
              {!friendsLoading && friends.length === 0 && (
                <div className={styles.emptyState}>No friends yet. Find people in the Active tab and add them.</div>
              )}
              {!friendsLoading && friends.map(friend => {
                const isOnline = onlineUsers?.some(u => u.id === friend.id);
                return (
                  <div key={friend.id} className={styles.userBtn} onClick={() => onUserClick(friend)} role="button" tabIndex={0} title={`Message ${friend.username}`}>
                    <div className="avatar" style={{ position: 'relative', width: 28, height: 28, fontSize: 11 }}>
                      {friend.avatar_url
                        ? <img src={friend.avatar_url} alt={friend.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : friend.username?.slice(0, 2).toUpperCase()}
                      {isOnline && (
                        <span style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--green)',
                          border: '1.5px solid var(--surface)',
                        }} />
                      )}
                    </div>
                    <div className={styles.userContent}>
                      <span className={styles.userName}>{friend.username}</span>
                      <div className={styles.userMeta}>
                        {isOnline && (
                          <button
                            className={styles.profileSmall}
                            onClick={e => { e.stopPropagation(); onCallUser?.(friend, 'voice'); }}
                            disabled={!friend.calls_enabled}
                            title={friend.calls_enabled ? `Call ${friend.username}` : 'Calls disabled'}
                          >
                            Call
                          </button>
                        )}
                        <button
                          className={styles.profileSmall}
                          onClick={e => { e.stopPropagation(); onUserClick(friend); }}
                        >
                          Message
                        </button>
                        <button
                          className={styles.profileSmall}
                          onClick={e => { e.stopPropagation(); unfriend(friend.friendship_id).then(loadFriends); }}
                        >
                          Unfriend
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Online Users */}
        {activePanel === 'active' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Active Users - {onlineUsers?.length || 0}</div>
            <a
              href="https://go.nordvpn.net/YOUR_AFFILIATE_LINK"
              target="_blank"
              rel="noopener noreferrer sponsored"
              style={{
                display: 'block',
                padding: '10px 12px',
                marginBottom: 8,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                fontSize: 12,
                color: 'var(--text2)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>Sponsored</span>
              Stay private while chatting — NordVPN
            </a>
            <div className={styles.userFilters}>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search active users"
              />
              <div className={styles.filterRow}>
                <select value={userSort} onChange={e => setUserSort(e.target.value)}>
                  <option value="popularity">Most starred</option>
                  <option value="nearest">Nearest</option>
                  <option value="name">Name</option>
                </select>
                <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
                  <option value="all">All genders</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {filteredOnlineUsers.length === 0 && (
              <div className={styles.emptyState}>No active users match these filters.</div>
            )}

            {filteredOnlineUsers.map(u => (
              <div
                key={u.id}
                className={styles.userBtn}
                onClick={() => onUserClick(u)}
                onKeyDown={(e) => e.key === 'Enter' && onUserClick(u)}
                role="button"
                tabIndex={0}
                title={`Message ${u.username}`}
              >
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : u.username?.slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.userContent}>
                  <span className={styles.userName}>{u.username}</span>
                  <div className={styles.userMeta}>
                    {u.id !== user?.id && (
                      friends.some(f => f.id === u.id) ? (
                        <button
                          className={styles.profileSmall}
                          type="button"
                          disabled
                          style={{ color: 'var(--green)', opacity: 1 }}
                          title="Already friends"
                        >
                          Friend
                        </button>
                      ) : pendingOutgoing.includes(u.id) ? (
                        <button
                          className={styles.profileSmall}
                          type="button"
                          disabled
                          title="Friend request pending"
                        >
                          Pending
                        </button>
                      ) : (
                        <button
                          className={styles.profileSmall}
                          type="button"
                          onClick={(e) => handleSendFriendRequest(u.id, e)}
                          disabled={u.id?.startsWith('guest_')}
                          title={u.id?.startsWith('guest_') ? 'Guest users cannot receive friend requests' : `Send friend request to ${u.username}`}
                        >
                          Add friend
                        </button>
                      )
                    )}
                    {u.id !== user?.id && (
                      <button
                        className={styles.profileSmall}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCallUser?.(u, 'voice');
                        }}
                        disabled={u.id?.startsWith('guest_')}
                        title={u.id?.startsWith('guest_') ? 'Guest users cannot be called' : `Call ${u.username}`}
                      >
                        Call
                      </button>
                    )}
                    <button
                      className={styles.profileSmall}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile?user=${u.id}`);
                      }}
                    >
                      Profile
                    </button>
                    <button
                      className={`${styles.starBtn} ${u.starredByMe ? styles.starred : ''}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUserStar?.(u.id);
                      }}
                      disabled={starringUserId === u.id || u.id?.startsWith('guest_') || u.id === user?.id}
                      title={u.starredByMe ? 'Already starred' : 'Star this chatter'}
                    >
                      <span className={styles.starIcon} aria-hidden="true" />
                      {u.stars || 0}
                    </button>
                    <span className={styles.onlineDot} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
