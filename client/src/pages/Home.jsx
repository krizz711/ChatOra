import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
  import { getSocket, onSocketReset, offSocketReset } from '../socket';
import useCall from '../hooks/useCall';
import { usePrivateChat } from '../hooks/usePrivateChat';
import { fetchStars, toggleStar } from '../utils/api';
import Sidebar from '../components/Sidebar';
import ChatRoom from '../components/ChatRoom';
import PrivateChat from '../components/PrivateChat';
import IncomingCall from '../components/IncomingCall';
import CallingScreen from '../components/CallingScreen';
import SplashScreen from '../components/SplashScreen';
import styles from './Home.module.css';
import PageBack from '../components/PageBack';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [splashDone, setSplashDone] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);
  const [privateChatUser, setPrivateChatUser] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'room' | 'dm'
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [starringUserId, setStarringUserId] = useState('');
  const [activePanel, setActivePanel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebarActivePanel') || 'active';
    }
    return 'active';
  });
  const { activeChat, openChat, closeChat, getMessages, sendPrivateMessage, sendPrivateFile } = usePrivateChat(user.id, user);
  const { callState, callType, remoteUser, incomingCall, startCall, acceptCall, declineCall, endCall, localVideoRef, remoteVideoRef } = useCall(user);
  const [isSocketLoaded, setIsSocketLoaded] = useState(false);

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
    } finally {
      // Mark as loaded even if stars fail, just to ensure splash continues
      setIsSocketLoaded(true);
    }
  };

  useEffect(() => {
    let currentSocket = getSocket();

    const subscribe = (socket) => {
      if (!socket) return () => {};

      const handleUsersList = async (users) => {
        const others = users.filter(u => u.id !== user.id);
        // Show users immediately without stars
        setOnlineUsers(others);
        setIsSocketLoaded(true);
        // Then fetch stars and update
        try {
          const stats = await fetchStars(others.map(u => u.id));
          setOnlineUsers(
            others
              .map(u => ({
                ...u,
                stars: stats.counts?.[u.id] || 0,
                starredByMe: (stats.starredByMe || []).includes(u.id),
              }))
              .sort((a, b) => (b.stars || 0) - (a.stars || 0))
          );
        } catch {
          // stars failed, users still visible
        }
      };

      const handleUserOnline = () => socket.emit('users:online');
      const handleUserOffline = () => socket.emit('users:online');

      socket.on('users:list', handleUsersList);
      socket.on('user:online', handleUserOnline);
      socket.on('user:offline', handleUserOffline);

      socket.emit('users:online');

      return () => {
        socket.off('users:list', handleUsersList);
        socket.off('user:online', handleUserOnline);
        socket.off('user:offline', handleUserOffline);
      };
    };

    let cleanup = subscribe(currentSocket);

    const handleReset = (newSocket) => {
      if (cleanup) cleanup();
      cleanup = subscribe(newSocket);
    };

    onSocketReset(handleReset);

    return () => {
      if (cleanup) cleanup();
      offSocketReset(handleReset);
    };
  }, [user.id]);

  // Failsafe timeout to ensure splash screen doesn't get stuck forever
  useEffect(() => {
    const fw = setTimeout(() => {
      setIsSocketLoaded(true);
    }, 4500); // Wait max 4.5 seconds for socket data before forcing completion
    return () => clearTimeout(fw);
  }, []);

  // media query fallback for mobile detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleUserClick = useCallback((u) => {
    setPrivateChatUser(u);
    openChat(u.id);
    if (isMobile) setMobileView('dm');
  }, [openChat, isMobile]);

  const handleRoomSelect = useCallback((room) => {
    setActiveRoom(room);
    if (isMobile) setMobileView('room');
  }, [isMobile]);

  const handleCall = useCallback((targetUser, type = 'voice') => {
    startCall(targetUser, type);
  }, [startCall]);

  const handleViewProfile = useCallback((u) => {
    navigate(`/profile?user=${u.id}`);
  }, [navigate]);

  const handleUserStar = useCallback(async (targetUserId) => {
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
      // no-op: keep chat flow uninterrupted if starring fails
    } finally {
      setStarringUserId('');
    }
  }, [user.id, starringUserId]);

  const handleSetActivePanel = useCallback((panel) => {
    setActivePanel(panel);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarActivePanel', panel);
    }
  }, []);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  if (!splashDone) {
    return <SplashScreen onDone={handleSplashDone} isLoaded={isSocketLoaded} />;
  }

  return (
    <div className={styles.layout}>
      {/* Mobile: show only list or full-screen chat views */}
      {isMobile ? (
        mobileView === 'list' ? (
          <Sidebar
            activeRoom={activeRoom}
            onRoomSelect={handleRoomSelect}
            onlineUsers={onlineUsers}
            onUserClick={handleUserClick}
            onCallUser={handleCall}
            onUserStar={handleUserStar}
            starringUserId={starringUserId}
            activePanel={activePanel}
            onSetActivePanel={handleSetActivePanel}
          />
        ) : mobileView === 'room' ? (
          <div className={styles.mobileChatView}>
            <header className={styles.mobileBackBar}>
              <PageBack label="Chats" onClick={() => { setMobileView('list'); setActiveRoom(null); }} />
              <h1 className={styles.mobileChatTitle}>{activeRoom?.name || 'Room'}</h1>
            </header>
            {activeRoom && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ChatRoom key={activeRoom.id} room={activeRoom} onUserClick={handleUserClick} />
              </div>
            )}
          </div>
        ) : (
          <div className={styles.mobileChatView}>
            <header className={styles.mobileBackBar}>
              <PageBack label="Chats" onClick={() => { setMobileView('list'); closeChat(); setPrivateChatUser(null); }} />
              <h1 className={styles.mobileChatTitle}>{privateChatUser?.username || 'Direct Message'}</h1>
            </header>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeChat && privateChatUser && (
                <PrivateChat
                  targetUser={privateChatUser}
                  messages={getMessages(activeChat)}
                  onSend={(text) => sendPrivateMessage(activeChat, text)}
                  onSendFile={(url, name, type) => sendPrivateFile(activeChat, url, name, type)}
                  onClose={() => { closeChat(); setPrivateChatUser(null); setMobileView('list'); }}
                  onCallUser={handleCall}
                  onStarUser={handleUserStar}
                  starringUserId={starringUserId}
                  onViewProfile={handleViewProfile}
                  fullScreen={true}
                />
              )}
            </div>
          </div>
        )
      ) : (
        <>
          <Sidebar
            activeRoom={activeRoom}
            onRoomSelect={handleRoomSelect}
            onlineUsers={onlineUsers}
            onUserClick={handleUserClick}
            onCallUser={handleCall}
            onUserStar={handleUserStar}
            starringUserId={starringUserId}
            activePanel={activePanel}
            onSetActivePanel={handleSetActivePanel}
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

          {/* Private chat popup (desktop) */}
          {activeChat && privateChatUser && (
            <div className={styles.privateWrap}>
              <PrivateChat
                targetUser={privateChatUser}
                messages={getMessages(activeChat)}
                onSend={(text) => sendPrivateMessage(activeChat, text)}
                onSendFile={(url, name, type) => sendPrivateFile(activeChat, url, name, type)}
                onClose={closeChat}
                onCallUser={handleCall}
                onStarUser={handleUserStar}
                starringUserId={starringUserId}
                onViewProfile={handleViewProfile}
              />
            </div>
          )}
          {incomingCall && callState === 'incoming' && (
            <IncomingCall
              incomingCall={incomingCall}
              onAccept={acceptCall}
              onDecline={declineCall}
            />
          )}
          {(callState === 'calling' || callState === 'connected' || callState === 'ended') && remoteUser && (
            <CallingScreen
              remoteUser={remoteUser}
              callState={callState}
              callType={callType}
              onEnd={endCall}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
            />
          )}
        </>
      )}
    </div>
  );
}
