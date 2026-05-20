import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import { getUserFlairs } from '../utils/flairs';
import FlairBadge from './FlairBadge';
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

export default function Sidebar({ activeRoom, onRoomSelect, onlineUsers, onUserClick, onCallUser, onUserStar, starringUserId, activePanel, onSetActivePanel }) {
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
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState([]);
  const [requestCount, setRequestCount] = useState(0);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [sortNearest, setSortNearest] = useState(true);
  const [sortPopularity, setSortPopularity] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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
      setPendingOutgoing(prev => [...prev, userId]);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to send request';
      alert(msg);
    }
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
        if (sortNearest) {
          const byLocation = sameLocationRank(b) - sameLocationRank(a);
          if (byLocation !== 0) return byLocation;
        }
        if (sortPopularity) {
          const byStars = (b.stars || 0) - (a.stars || 0);
          if (byStars !== 0) return byStars;
        }
        return (a.username || '').localeCompare(b.username || '');
      });
  }, [onlineUsers, userSearch, genderFilter, sortNearest, sortPopularity, user?.country, user?.state]);

  return (
    <div className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.logo}>ChatOra</span>
        <div className={styles.headerActions}>

          <button className={styles.iconBtn} onClick={() => navigate('/profile')} title="Profile">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          {!user?.isGuest && (
            <button className={styles.iconBtn} onClick={() => navigate('/settings')} title="Settings">
              <Settings size={16} />
            </button>
          )}
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

      <div className={styles.glassRadioGroup}>
        <input type="radio" value="active" id="panel-active" name="sidebar-panel" className={styles.radioInput} checked={activePanel === 'active'} onChange={() => onSetActivePanel('active')} />
        <label htmlFor="panel-active" className={styles.glassRadioLabel}>Active</label>

        <input type="radio" value="rooms" id="panel-rooms" name="sidebar-panel" className={styles.radioInput} checked={activePanel === 'rooms'} onChange={() => onSetActivePanel('rooms')} />
        <label htmlFor="panel-rooms" className={styles.glassRadioLabel}>Rooms</label>

        <input type="radio" value="friends" id="panel-friends" name="sidebar-panel" className={styles.radioInput} checked={activePanel === 'friends'} onChange={() => { onSetActivePanel('friends'); setRequestCount(0); }} />
        <label htmlFor="panel-friends" className={styles.glassRadioLabel}>
          Friends
          {requestCount > 0 && <span className={styles.requestBadge}>{requestCount}</span>}
        </label>

        <div className={styles.glassGlider} />
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span className={styles.userName}>{friend.username}</span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {getUserFlairs(friend).map((f) => (
                            <FlairBadge key={f.id} flair={f} size="xs" />
                          ))}
                        </div>
                      </div>
                      <div className={styles.userMeta}>
                        {isOnline && (
                          <>
                            <button
                              className={styles.profileSmall}
                              disabled
                              style={{ textDecoration: 'line-through', cursor: 'not-allowed' }}
                              title="Currently not available"
                            >
                              Call
                            </button>
                            <button
                              className={styles.profileSmall}
                              disabled
                              style={{ textDecoration: 'line-through', cursor: 'not-allowed' }}
                              title="Currently not available"
                            >
                              Video
                            </button>
                          </>
                        )}
                        <button
                          className={styles.profileSmall}
                          onClick={e => { e.stopPropagation(); onUserClick(friend); }}
                        >
                          Message
                        </button>
                        <button
                          className={styles.profileSmall}
                          onClick={e => { e.stopPropagation(); unfriend(friend.id).then(loadFriends).catch(() => alert('Failed to remove friend')); }}
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
            <div className={styles.sectionLabel}>Active Users ({onlineUsers?.length || 0})</div>
            <div className={styles.userFilters}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search active users"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`${styles.iconBtn} ${showFilters ? styles.filterToggleBtnActive : ''}`}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    flexShrink: 0,
                    padding: 0
                  }}
                  title="Toggle Filters"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                </button>
              </div>

              {showFilters && (
                <div className={styles.filterExpanded}>
                  <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>GENDER</div>
                    <div className={styles.filterChips}>
                      {['all', 'female', 'male', 'other'].map(g => (
                        <button
                          key={g}
                          onClick={() => setGenderFilter(g)}
                          className={`${styles.filterChip} ${genderFilter === g ? styles.filterChipActive : ''}`}
                        >
                          {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>SORT BY</div>
                    <div className={styles.filterChips}>
                      <button
                        onClick={() => setSortNearest(!sortNearest)}
                        className={`${styles.filterChip} ${sortNearest ? styles.filterChipActive : ''}`}
                      >
                        Nearest
                      </button>
                      <button
                        onClick={() => setSortPopularity(!sortPopularity)}
                        className={`${styles.filterChip} ${sortPopularity ? styles.filterChipActive : ''}`}
                      >
                        Most Starred
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className={styles.userName}>{u.username}</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {getUserFlairs(u).map((f) => (
                        <FlairBadge key={f.id} flair={f} size="xs" />
                      ))}
                    </div>
                  </div>
                  <div className={styles.userMeta}>
                    {u.id !== user?.id && (
                      friends.some(f => f.id === u.id) ? (
                        <button className={styles.profileSmall} disabled style={{ color: 'var(--green)' }}>
                          Friends
                        </button>
                      ) : pendingOutgoing.includes(u.id) ? (
                        <button className={styles.profileSmall} disabled>
                          Pending
                        </button>
                      ) : (
                        <button
                          className={styles.profileSmall}
                          onClick={(e) => handleSendFriendRequest(u.id, e)}
                          disabled={u.id?.startsWith('guest_')}
                        >
                          Add friend
                        </button>
                      )
                    )}
                    {u.id !== user?.id && (
                      <>
                        <button
                          className={styles.profileSmall}
                          type="button"
                          disabled
                          style={{ textDecoration: 'line-through', cursor: 'not-allowed' }}
                          title="Currently not available"
                        >
                          Call
                        </button>
                        <button
                          className={styles.profileSmall}
                          type="button"
                          disabled
                          style={{ textDecoration: 'line-through', cursor: 'not-allowed' }}
                          title="Currently not available"
                        >
                          Video
                        </button>
                      </>
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
