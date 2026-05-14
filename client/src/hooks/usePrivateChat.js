import { useState, useEffect, useCallback } from 'react';
import { getSocket, onSocketReset, offSocketReset } from '../socket';

const MAX_MESSAGES = 200;

export const usePrivateChat = (currentUserId) => {
  const [conversations, setConversations] = useState({}); // { userId: [messages] }
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    let currentSocket = getSocket();
    if (!currentSocket) return;

    const subscribe = (socket) => {
      const onPrivateMessage = (msg) => {
        const key = msg.sender.id === currentUserId ? msg.toUserId : msg.sender.id;
        setConversations(prev => {
          const existing = prev[key] || [];
          const updated = [...existing, msg].slice(-MAX_MESSAGES);
          return { ...prev, [key]: updated };
        });
      };

      const onPrivateHistory = ({ withUserId, messages }) => {
        if (!withUserId) return;
        setConversations(prev => ({
          ...prev,
          [withUserId]: (Array.isArray(messages) ? messages : []).slice(-MAX_MESSAGES),
        }));
      };

      socket.on('private:receive', onPrivateMessage);
      socket.on('private:history', onPrivateHistory);

      return () => {
        socket.off('private:receive', onPrivateMessage);
        socket.off('private:history', onPrivateHistory);
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
  }, [currentUserId]);

  const sendPrivateMessage = useCallback((toUserId, text) => {
    const socket = getSocket();
    if (!socket || !text.trim()) return;
    socket.emit('private:send', { toUserId, text: text.trim() });
  }, []);

  const sendPrivateFile = useCallback((toUserId, fileUrl, fileName, fileType) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('private:send', { toUserId, fileUrl, fileName, fileType });
  }, []);

  const openChat = (userId) => {
    setActiveChat(userId);
    const socket = getSocket();
    if (socket && userId) socket.emit('private:history', { withUserId: userId });
  };
  const closeChat = () => setActiveChat(null);
  const getMessages = (userId) => conversations[userId] || [];

  return { activeChat, conversations, openChat, closeChat, getMessages, sendPrivateMessage, sendPrivateFile };
};
