import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import { usePrivateChat } from '../hooks/usePrivateChat';
import { fetchStars, toggleStar } from '../utils/api';
import Sidebar from '../components/Sidebar';
import ChatRoom from '../components/ChatRoom';
import PrivateChat from '../components/PrivateChat';
import styles from './Home.module.css';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRoom, setActiveRoom] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [starringUserId, setStarringUserId] = useState('');
  const { activeChat, openChat, closeChat, getMessages, sendPrivateMessage, sendPrivateFile } = usePrivateChat();
  const [privateChatUser, setPrivateChatUser] = useState(null);

  const applyStarStats = async (users) => {
    if (!users?.length) return users;
    try {
      const stats = await fetchStars(users.map(u => u.id));
      return users
        .map(u => ({
          ...u,
          stars: stats.counts?.[u.id] || 0,
          starredByMe: (stats.starredByMe || []).includes(u.id),
        }))
        .sort((a, b) => (b.stars || 0) - (a.stars || 0));
    } catch {
      return users;
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Get online users
    socket.emit('users:online');
    socket.on('users:list', async (users) => {
      const others = users.filter(u => u.id !== user.id);
      const withStats = await applyStarStats(others);
      setOnlineUsers(withStats);
    });
    socket.on('user:online', () => socket.emit('users:online'));
    socket.on('user:offline', () => socket.emit('users:online'));

    return () => {
      socket.off('users:list');
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [user.id]);

  const handleUserClick = (u) => {
    setPrivateChatUser(u);
    openChat(u.id);
  };

  const handleViewProfile = (u) => {
    navigate(`/profile?user=${u.id}`);
  };

  const handleUserStar = async (targetUserId) => {
    if (!targetUserId || starringUserId || targetUserId === user.id) return;
    setStarringUserId(targetUserId);
    try {
      const data = await toggleStar(targetUserId);
      setOnlineUsers(prev => prev
        .map(u => (u.id === targetUserId
          ? { ...u, stars: data.starCount, starredByMe: data.starred }
          : u
        ))
        .sort((a, b) => (b.stars || 0) - (a.stars || 0))
      );
      setPrivateChatUser(prev => (
        prev && prev.id === targetUserId
          ? { ...prev, stars: data.starCount, starredByMe: data.starred }
          : prev
      ));
    } catch (err) {
      if (err.response?.status !== 409) {
        // no-op: keep chat flow uninterrupted if starring fails
      }
    } finally {
      setStarringUserId('');
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        activeRoom={activeRoom}
        onRoomSelect={setActiveRoom}
        onlineUsers={onlineUsers}
        onUserClick={handleUserClick}
        onUserStar={handleUserStar}
        starringUserId={starringUserId}
      />

      <main className={styles.main}>
        {activeRoom ? (
          <ChatRoom key={activeRoom.id} room={activeRoom} onUserClick={handleUserClick} />
        ) : (
          <div className={styles.welcome}>
            <div className={styles.welcomeInner}>
              <div className={styles.welcomeLogo}>NexChat</div>
              <p>Select a room from the sidebar to start chatting.</p>
              <p className={styles.hint}>Messages are not stored — they live only while you're connected.</p>
            </div>
          </div>
        )}
      </main>

      {/* Private chat popup */}
      {activeChat && privateChatUser && (
        <div className={styles.privateWrap}>
          <PrivateChat
            targetUser={privateChatUser}
            messages={getMessages(activeChat)}
            onSend={(text) => sendPrivateMessage(activeChat, text)}
            onSendFile={(url, name, type) => sendPrivateFile(activeChat, url, name, type)}
            onClose={closeChat}
            onStarUser={handleUserStar}
            starringUserId={starringUserId}
            onViewProfile={handleViewProfile}
          />
        </div>
      )}
    </div>
  );
}
