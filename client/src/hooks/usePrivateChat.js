import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, onSocketReset, offSocketReset } from '../socket';
import { generateKeyPair, deriveSharedKey, encryptMessage, decryptMessage } from '../utils/encryption';
import { playNotificationSound } from '../utils/notifications';

const MAX_MESSAGES = 200;

export const usePrivateChat = (currentUserId, currentUser = null) => {
  const [conversations, setConversations] = useState({}); // { userId: [messages] }
  const [activeChat, setActiveChat] = useState(null);
  const myKeyPair = useRef(null);
  const sharedKeys = useRef({}); // { [userId]: sharedKeyB64 }

  useEffect(() => {
    myKeyPair.current = generateKeyPair();
  }, []);

  useEffect(() => {
    let currentSocket = getSocket();
    if (!currentSocket) return;

    const subscribe = (socket) => {
      // Key exchange handler: derive shared keys and respond with our public key
      const onKeyExchange = ({ fromUserId, publicKey }) => {
        if (!myKeyPair.current) return;
        if (sharedKeys.current[fromUserId]) return; // already have shared key
        try {
          const shared = deriveSharedKey(myKeyPair.current.secretKey, publicKey);
          sharedKeys.current[fromUserId] = shared;
          const sock = getSocket();
          if (sock) sock.emit('key:exchange', { toUserId: fromUserId, publicKey: myKeyPair.current.publicKey });
        } catch (err) {
          console.error('key exchange error', err);
        }
      };

      socket.on('key:exchange', onKeyExchange);

      const onPrivateMessage = (msg) => {
        // Decrypt if needed
        let displayMsg = msg;
        try {
          if (msg.encrypted && msg.ciphertext && msg.nonce) {
            const senderId = msg.sender?.id;
            const sharedKey = sharedKeys.current[senderId === currentUserId ? msg.toUserId : senderId];
            if (sharedKey) {
              const plaintext = decryptMessage(msg.ciphertext, msg.nonce, sharedKey);
              displayMsg = { ...msg, text: plaintext || '[encrypted]', encrypted: false };
            }
          }
        } catch (err) {
          console.error('decrypt error', err);
        }

        // Play notification sound if enabled and message not from current user
        if (currentUser?.notification_sound && displayMsg.sender?.id !== currentUserId) {
          playNotificationSound();
        }

        const key = displayMsg.sender.id === currentUserId ? displayMsg.toUserId : displayMsg.sender.id;
        setConversations(prev => {
          const existing = prev[key] || [];
          const updated = [...existing, displayMsg].slice(-MAX_MESSAGES);
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
        socket.off('key:exchange', onKeyExchange);
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
  }, [currentUserId, currentUser?.notification_sound]);

  const sendPrivateMessage = useCallback((toUserId, text) => {
    const socket = getSocket();
    if (!socket || !text.trim()) return;
    const sharedKey = sharedKeys.current[toUserId];
    if (sharedKey) {
      try {
        const { ciphertext, nonce } = encryptMessage(text.trim(), sharedKey);
        socket.emit('private:send', { toUserId, ciphertext, nonce, encrypted: true });
      } catch (err) {
        console.error('encrypt error', err);
      }
    } else {
      socket.emit('private:send', { toUserId, text: text.trim() });
    }
  }, []);

  const sendPrivateFile = useCallback((toUserId, fileUrl, fileName, fileType) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('private:send', { toUserId, fileUrl, fileName, fileType });
  }, []);

  const openChat = (userId) => {
    setActiveChat(userId);
    const socket = getSocket();
    if (socket && userId) {
      socket.emit('private:history', { withUserId: userId });
      if (myKeyPair.current) {
        socket.emit('key:exchange', { toUserId: userId, publicKey: myKeyPair.current.publicKey });
      }
    }
  };
  const closeChat = () => setActiveChat(null);
  const getMessages = (userId) => conversations[userId] || [];

  return { activeChat, conversations, openChat, closeChat, getMessages, sendPrivateMessage, sendPrivateFile };
};
