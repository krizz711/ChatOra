import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket';

const MAX_MESSAGES = 200; // keep last 200 per room in memory

export const useChat = (roomId) => {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineCount, setOnlineCount] = useState(0);
  const typingRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) return;

    // Join room
    socket.emit('room:join', { roomId });

    // Receive messages
    const onMessage = (msg) => {
      if (msg.roomId !== roomId) return;
      setMessages(prev => {
        const updated = [...prev, msg];
        return updated.slice(-MAX_MESSAGES); // keep last 200
      });
    };

    // Typing
    const onTyping = ({ userId, username, typing }) => {
      setTypingUsers(prev => {
        if (typing) return { ...prev, [userId]: username };
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    // Room count
    const onCount = ({ roomId: rid, count }) => {
      if (rid === roomId) setOnlineCount(count);
    };

    socket.on('message:receive', onMessage);
    socket.on('typing:update', onTyping);
    socket.on('room:count', onCount);

    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('message:receive', onMessage);
      socket.off('typing:update', onTyping);
      socket.off('room:count', onCount);
      setMessages([]); // clear on room leave
    };
  }, [roomId]);

  const sendMessage = useCallback((text, replyTo = null) => {
    const socket = getSocket();
    if (!socket || !text.trim()) return;
    socket.emit('message:send', { roomId, text: text.trim(), replyTo });
    sendTypingStop();
  }, [roomId]);

  const sendFile = useCallback((fileUrl, fileName, fileType, fileSize) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('message:file', { roomId, fileUrl, fileName, fileType, fileSize });
  }, [roomId]);

  const sendTypingStart = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing:start', { roomId });
    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => {
      const s = getSocket();
      if (s) s.emit('typing:stop', { roomId });
      if (typingRef.current) clearTimeout(typingRef.current);
    }, 3000);
  }, [roomId]);

  const sendTypingStop = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing:stop', { roomId });
    if (typingRef.current) clearTimeout(typingRef.current);
  }, [roomId]);

  return { messages, typingUsers, onlineCount, sendMessage, sendFile, sendTypingStart, sendTypingStop };
};
