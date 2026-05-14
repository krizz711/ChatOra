import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchGroups, createGroup, joinGroup, joinByInvite, leaveGroup } from '../utils/api';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeRoom, onRoomSelect, onlineUsers, onUserClick, onUserStar, starringUserId }) {
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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-mode');
  });

  useEffect(() => { loadGroups(); }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    html.classList.toggle('dark-mode');
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('nexchat-theme', isDarkMode ? 'light' : 'dark');
  };

  const loadGroups = async () => {
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch {}
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setLoading(true);
    try {
      await createGroup(newGroupName.trim(), isPrivate);
      setNewGroupName(''); setIsPrivate(false); setShowCreate(false);
      await loadGroups();
    } catch {} finally { setLoading(false); }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await joinByInvite(inviteCode.trim());
      setInviteCode(''); setShowJoin(false);
      await loadGroups();
    } catch {} finally { setLoading(false); }
  };

  const handleJoinPublic = async (groupId) => {
    try {
      await joinGroup(groupId);
      await loadGroups();
    } catch {}
  };

  const handleLeave = async (groupId, e) => {
    e.stopPropagation();
    try { await leaveGroup(groupId); await loadGroups(); } catch {}
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const initials = (name) => name?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.logo}>NexChat</span>
        <div className={styles.headerActions}>
          <button className={styles.themeToggle} onClick={toggleTheme} title="Toggle theme">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button className={styles.iconBtn} onClick={() => navigate('/profile')} title="Profile">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={logout} title="Logout">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* User info */}
      <div className={styles.userInfo}>
        <div className="avatar">{user?.avatar_url
          ? <img src={user.avatar_url} alt={user.username} style={{width:'100%',height:'100%',borderRadius:'50%'}} />
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

      <div className={styles.scroll}>
        {/* Global Rooms */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Global Rooms</div>
          {groups.globalGroups?.map(g => (
            <button key={g.id} className={`${styles.roomBtn} ${activeRoom?.id === g.id ? styles.active : ''}`}
              onClick={() => onRoomSelect(g)}>
              <span className={styles.roomName}>{g.name}</span>
            </button>
          ))}
        </div>

        {/* My Groups */}
        <div className={styles.section}>
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
                {g.is_private ? '🔒 ' : ''}{g.name}
              </span>
              {g.invite_code && (
                <span className={styles.codeChip} onClick={e => { e.stopPropagation(); copyCode(g.invite_code); }}
                  title="Copy invite code">
                  {copiedCode === g.invite_code ? '✓' : g.invite_code}
                </span>
              )}
              <span className={styles.leaveBtn} onClick={e => handleLeave(g.id, e)} title="Leave">✕</span>
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
        </div>

        {/* Public Groups */}
        {groups.publicGroups?.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Discover</div>
            {groups.publicGroups.filter(g =>
              !groups.userGroups?.find(ug => ug.id === g.id)
            ).slice(0, 10).map(g => (
              <div key={g.id} className={styles.discoverRow}>
                <span className={styles.roomName}>{g.name}</span>
                <button className={styles.joinSmall} onClick={() => handleJoinPublic(g.id)}>Join</button>
              </div>
            ))}
          </div>
        )}

        {/* Online Users */}
        {onlineUsers?.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Popular Chatters — {onlineUsers.length}</div>
            {onlineUsers.map(u => (
              <button
                key={u.id}
                className={styles.userBtn}
                onClick={() => onUserClick(u)}
                title={`Message ${u.username}`}
              >
                <div className="avatar" style={{width:28,height:28,fontSize:11}}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.username} style={{width:'100%',height:'100%',borderRadius:'50%'}} />
                    : u.username?.slice(0,2).toUpperCase()}
                </div>
                <div className={styles.userContent}>
                  <span className={styles.userName}>{u.username}</span>
                  <div className={styles.userMeta}>
                    <button
                      className={`${styles.starBtn} ${u.starredByMe ? styles.starred : ''}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUserStar?.(u.id);
                      }}
                      disabled={starringUserId === u.id || u.id?.startsWith('guest_') || u.id === user?.id || u.starredByMe}
                      title={u.starredByMe ? 'Already starred' : 'Star this chatter'}
                    >
                      {u.starredByMe ? '★' : '☆'} {u.stars || 0}
                    </button>
                    <span className={styles.onlineDot} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
