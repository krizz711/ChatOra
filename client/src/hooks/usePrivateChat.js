import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../socket';

const MAX_MESSAGES = 200;

export const usePrivateChat = () => {
  const [conversations, setConversations] = useState({}); // { userId: [messages] }
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPrivateMessage = (msg) => {
      const key = msg.toUserId ?? msg.sender.id;
      setConversations(prev => {
        const existing = prev[key] || [];
        const updated = [...existing, msg].slice(-MAX_MESSAGES);
        return { ...prev, [key]: updated };
      });
    };

    socket.on('private:receive', onPrivateMessage);
    return () => socket.off('private:receive', onPrivateMessage);
  }, []);

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

  const openChat = (userId) => setActiveChat(userId);
  const closeChat = () => setActiveChat(null);
  const getMessages = (userId) => conversations[userId] || [];

  return { activeChat, conversations, openChat, closeChat, getMessages, sendPrivateMessage, sendPrivateFile };
};
