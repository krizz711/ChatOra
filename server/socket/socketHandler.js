const redis = require('../redis/redisClient');
const supabase = require('../db/supabase');
const { v4: uuidv4 } = require('uuid');
const { getUserColumns } = require('../db/userColumns');

// Simple profanity filter - add words as needed
const BAD_WORDS = ['spam', 'scam']; // extend as needed
const filterMessage = (text) => {
  let filtered = text;
  BAD_WORDS.forEach(word => {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '*'.repeat(word.length));
  });
  return filtered;
};

const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
};

const buildSender = (user) => ({
  id: user.id,
  username: user.username,
  avatar_url: user.avatar_url,
  country: user.country || null,
  state: user.state || null,
  gender: user.gender || 'other',
  age: user.age || null,
  star_count: user.star_count || 0,
});

const mapStoredMessage = (row) => ({
  id: row.id,
  roomId: row.room_id,
  text: row.text || '',
  fileUrl: row.file_url || null,
  fileName: row.file_name || null,
  fileType: row.file_type || null,
  fileSize: row.file_size || null,
  sender: row.sender ? {
    id: row.sender.id,
    username: row.sender.username,
    avatar_url: row.sender.avatar_url,
    country: row.sender.country || null,
    state: row.sender.state || null,
    gender: row.sender.gender || 'other',
    age: row.sender.age || null,
    star_count: row.sender.star_count || 0,
  } : null,
  replyTo: row.reply_to || null,
  timestamp: row.created_at,
  type: row.file_url ? 'file' : 'text',
});

const safeParseUser = (raw) => {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const activeUsers = new Map();

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  avatar_url: user.avatar_url,
  country: user.country || null,
  state: user.state || null,
  gender: user.gender || 'other',
  age: user.age || null,
  star_count: user.star_count || 0,
});

const addActiveSocket = (user, socketId) => {
  const existing = activeUsers.get(user.id);
  if (existing) {
    existing.socketIds.add(socketId);
    existing.socketId = socketId;
    existing.lastSeen = Date.now();
    existing.user = { ...existing.user, ...publicUser(user) };
    return existing;
  }

  const entry = {
    ...publicUser(user),
    user: publicUser(user),
    socketId,
    socketIds: new Set([socketId]),
    lastSeen: Date.now(),
  };
  activeUsers.set(user.id, entry);
  return entry;
};

const removeActiveSocket = (userId, socketId) => {
  const existing = activeUsers.get(userId);
  if (!existing) return false;

  existing.socketIds.delete(socketId);
  if (existing.socketIds.size > 0) {
    existing.socketId = [...existing.socketIds][existing.socketIds.size - 1];
    existing.lastSeen = Date.now();
    return true;
  }

  activeUsers.delete(userId);
  return false;
};

const listActiveUsers = () => [...activeUsers.values()].map(entry => ({
  ...entry.user,
  socketId: entry.socketId,
}));

const getActiveUser = (userId) => activeUsers.get(userId) || null;

const ROOM_MESSAGE_TTL_MINUTES = Number(process.env.ROOM_MESSAGE_TTL_MINUTES || 30);
const roomTtlMs = () => ROOM_MESSAGE_TTL_MINUTES * 60 * 1000;
const nowIso = () => new Date().toISOString();
const roomCutoffIso = () => new Date(Date.now() - roomTtlMs()).toISOString();
const roomExpiryIso = () => new Date(Date.now() + roomTtlMs()).toISOString();

const roomMessageSelect = `
  id,
  room_id,
  text,
  file_url,
  file_name,
  file_type,
  file_size,
  reply_to,
  created_at,
  sender:users (
    id,
    username,
    avatar_url,
    country,
    state,
    gender,
    age,
    star_count
  )
`;

const cleanupExpiredRoomMessages = async (roomId) => {
  try {
    await supabase
      .from('messages')
      .delete()
      .eq('room_id', roomId)
      .lte('expires_at', nowIso());
  } catch {
    // The migration may not be applied yet; chat delivery should still work.
  }
};

const fetchRoomHistory = async (roomId) => {
  const baseQuery = () => supabase
    .from('messages')
    .select(roomMessageSelect)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(100);

  const ttlQuery = await baseQuery().gt('expires_at', nowIso());
  if (!ttlQuery.error && Array.isArray(ttlQuery.data)) {
    return ttlQuery.data.reverse().map(mapStoredMessage);
  }

  const fallbackQuery = await baseQuery().gte('created_at', roomCutoffIso());
  if (!fallbackQuery.error && Array.isArray(fallbackQuery.data)) {
    return fallbackQuery.data.reverse().map(mapStoredMessage);
  }

  return null;
};

const insertRoomMessage = async (payload) => {
  const { error } = await supabase.from('messages').insert({
    ...payload,
    expires_at: roomExpiryIso(),
  });

  if (!error) return null;

  const fallback = await supabase.from('messages').insert(payload);
  return fallback.error;
};

const buildPrivateMessage = ({ fromUser, toUserId, text = '', fileUrl = null, fileName = null, fileType = null }) => ({
  id: uuidv4(),
  text,
  fileUrl,
  fileName,
  fileType,
  sender: buildSender(fromUser),
  toUserId,
  timestamp: new Date().toISOString(),
  type: fileUrl ? 'file' : 'text',
});

const mapPrivateMessage = (row) => ({
  id: row.id,
  text: row.text || '',
  fileUrl: row.file_url || null,
  fileName: row.file_name || null,
  fileType: row.file_type || null,
  sender: row.sender_snapshot || { id: row.sender_key, username: 'Unknown' },
  toUserId: row.recipient_key,
  timestamp: row.created_at,
  type: row.file_url ? 'file' : 'text',
});

const storePrivateMessage = async (message, recipient) => {
  try {
    const { error } = await supabase.from('private_messages').insert({
      id: message.id,
      sender_key: message.sender.id,
      recipient_key: message.toUserId,
      sender_snapshot: message.sender,
      recipient_snapshot: recipient || { id: message.toUserId },
      text: message.text || '',
      file_url: message.fileUrl || null,
      file_name: message.fileName || null,
      file_type: message.fileType || null,
      created_at: message.timestamp,
    });

    if (error) console.error('Failed to store private message', error);
  } catch (err) {
    console.error('Failed to store private message', err.message);
  }
};

module.exports = (io) => {
  // Track typing timeouts
  const typingTimeouts = new Map();

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`Connected: ${user.username} (${socket.id})`);

    const activeEntry = addActiveSocket(user, socket.id);
    try {
      await redis.hset('online_users', {
        [user.id]: JSON.stringify({
          ...activeEntry.user,
          socketId: socket.id,
        }),
      });
    } catch (err) {
      console.error('Failed to update Redis presence:', err.message);
    }

    io.emit('user:online', { userId: user.id, username: user.username });

    // ─── JOIN ROOM ──────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);

      await cleanupExpiredRoomMessages(roomId);
      const history = await fetchRoomHistory(roomId);
      if (Array.isArray(history)) socket.emit('message:history', { roomId, messages: history });

      // Count members in room
      const roomSockets = await io.in(roomId).allSockets();
      io.to(roomId).emit('room:count', { roomId, count: roomSockets.size });

      socket.emit('room:joined', { roomId });
    });

    // ─── LEAVE ROOM ─────────────────────────────────────────────
    socket.on('room:leave', async ({ roomId }) => {
      socket.leave(roomId);
      const roomSockets = await io.in(roomId).allSockets();
      io.to(roomId).emit('room:count', { roomId, count: roomSockets.size });
    });

    // ─── SEND MESSAGE TO ROOM ────────────────────────────────────
    socket.on('message:send', async ({ roomId, text, replyTo }) => {
      if (!roomId || !text) return;

      const clean = filterMessage(sanitize(text));
      if (!clean) return;

      const message = {
        id: uuidv4(),
        roomId,
        text: clean,
        sender: buildSender(user),
        replyTo: replyTo || null,
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      await cleanupExpiredRoomMessages(roomId);
      const insertError = await insertRoomMessage({
        id: message.id,
        room_id: roomId,
        sender_id: user.id,
        text: clean,
        reply_to: replyTo || null,
      });

      if (insertError) {
        console.error('Failed to store message', insertError);
        socket.emit('message:error', { error: 'Failed to store message' });
        return;
      }

      // Broadcast to everyone in room including sender
      io.to(roomId).emit('message:receive', message);
    });

    // ─── SEND FILE/IMAGE IN ROOM ─────────────────────────────────
    socket.on('message:file', async ({ roomId, fileUrl, fileName, fileType, fileSize }) => {
      if (!roomId || !fileUrl) return;

      const { data: group } = await supabase.from('groups').select('is_global').eq('id', roomId).single();
      if (group?.is_global) {
        if ((fileType?.startsWith('image/') && fileType !== 'image/gif') || fileType?.startsWith('video/')) {
          socket.emit('message:error', { error: 'Images and videos are not allowed in global rooms. Only GIFs are permitted.' });
          return;
        }
      }

      const message = {
        id: uuidv4(),
        roomId,
        text: '',
        fileUrl,
        fileName: sanitize(fileName),
        fileType,
        fileSize,
        sender: buildSender(user),
        timestamp: new Date().toISOString(),
        type: 'file',
      };

      await cleanupExpiredRoomMessages(roomId);
      const insertError = await insertRoomMessage({
        id: message.id,
        room_id: roomId,
        sender_id: user.id,
        file_url: fileUrl,
        file_name: sanitize(fileName),
        file_type: fileType,
        file_size: fileSize || null,
      });

      if (insertError) {
        console.error('Failed to store file message', insertError);
        socket.emit('message:error', { error: 'Failed to store file message' });
        return;
      }

      io.to(roomId).emit('message:receive', message);
    });

    // ─── TYPING INDICATOR ────────────────────────────────────────
    socket.on('typing:start', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('typing:update', {
        userId: user.id,
        username: user.username,
        roomId,
        typing: true,
      });

      // Auto-clear typing after 3s
      const key = `${user.id}:${roomId}`;
      if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key));
      typingTimeouts.set(key, setTimeout(() => {
        socket.to(roomId).emit('typing:update', {
          userId: user.id, username: user.username, roomId, typing: false,
        });
        typingTimeouts.delete(key);
      }, 3000));
    });

    socket.on('typing:stop', ({ roomId }) => {
      if (!roomId) return;
      const key = `${user.id}:${roomId}`;
      if (typingTimeouts.has(key)) {
        clearTimeout(typingTimeouts.get(key));
        typingTimeouts.delete(key);
      }
      socket.to(roomId).emit('typing:update', {
        userId: user.id, username: user.username, roomId, typing: false,
      });
    });

    // ─── PRIVATE MESSAGES ────────────────────────────────────────
    socket.on('private:history', async ({ withUserId }) => {
      if (!withUserId) return;

      try {
        const { data, error } = await supabase
          .from('private_messages')
          .select('*')
          .in('sender_key', [user.id, withUserId])
          .in('recipient_key', [user.id, withUserId])
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          socket.emit('private:history', { withUserId, messages: [] });
          return;
        }

        socket.emit('private:history', {
          withUserId,
          messages: (data || []).reverse().map(mapPrivateMessage),
        });
      } catch {
        socket.emit('private:history', { withUserId, messages: [] });
      }
    });

    socket.on('private:send', async ({ toUserId, text, fileUrl, fileName, fileType }) => {
      if (!toUserId || (!text && !fileUrl)) return;

      const message = buildPrivateMessage({
        fromUser: user,
        toUserId,
        text: text ? filterMessage(sanitize(text)) : '',
        fileUrl: fileUrl || null,
        fileName: fileName ? sanitize(fileName) : null,
        fileType: fileType || null,
      });

      const activeRecipient = getActiveUser(toUserId);
      let recipient = activeRecipient?.user || { id: toUserId };
      let recipientRaw = null;

      await storePrivateMessage(message, recipient);
      socket.emit('private:receive', message);

      if (activeRecipient?.socketIds?.size) {
        activeRecipient.socketIds.forEach(socketId => {
          const recipientSocket = io.sockets.sockets.get(socketId);
          if (recipientSocket) recipientSocket.emit('private:receive', message);
        });
        return;
      }

      try {
        recipientRaw = await redis.hget('online_users', toUserId);
        recipient = safeParseUser(recipientRaw) || recipient;
      } catch (err) {
        console.error('Failed to read Redis presence:', err.message);
      }

      if (!recipient || !recipient.socketId) {
        if (recipientRaw && recipient?.id) {
          try {
            const currentRaw = await redis.hget('online_users', recipient.id);
            const current = safeParseUser(currentRaw);
            if (current?.socketId === recipient.socketId) {
              await redis.hdel('online_users', recipient.id);
            }
          } catch (err) {
            console.error('Failed to clean Redis presence:', err.message);
          }
        }
        return;
      }

      const recipientSocket = io.sockets.sockets.get(recipient.socketId);
      if (!recipientSocket) {
        try {
          const currentRaw = await redis.hget('online_users', toUserId);
          const current = safeParseUser(currentRaw);
          if (current?.socketId === recipient.socketId) {
            await redis.hdel('online_users', toUserId);
          }
        } catch (err) {
          console.error('Failed to clean Redis presence:', err.message);
        }
        return;
      }

      recipientSocket.emit('private:receive', message);
    });

    // ─── GET ONLINE USERS ────────────────────────────────────────
    socket.on('users:online', async () => {
      const memoryUsers = listActiveUsers();
      if (memoryUsers.length) {
        socket.emit('users:list', memoryUsers);
        return;
      }

      try {
        const all = await redis.hgetall('online_users');
        const users = [];
        const invalidKeys = [];

        Object.entries(all || {}).forEach(([key, value]) => {
          const parsed = safeParseUser(value);
          if (parsed && parsed.id && parsed.socketId) {
            users.push(parsed);
            return;
          }
          invalidKeys.push(key);
        });

        if (invalidKeys.length) {
          await Promise.all(invalidKeys.map(key => redis.hdel('online_users', key)));
        }

        socket.emit('users:list', users);
      } catch (err) {
        console.error('Failed to read Redis presence:', err.message);
        socket.emit('users:list', []);
      }
    });

    // ─── DISCONNECT ──────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`Disconnected: ${user.username}`);
      const stillOnline = removeActiveSocket(user.id, socket.id);

      try {
        if (stillOnline) {
          const activeEntry = getActiveUser(user.id);
          await redis.hset('online_users', {
            [user.id]: JSON.stringify({
              ...activeEntry.user,
              socketId: activeEntry.socketId,
            }),
          });
        } else {
          const currentRaw = await redis.hget('online_users', user.id);
          const current = safeParseUser(currentRaw);
          if (!current || current?.socketId === socket.id) {
            await redis.hdel('online_users', user.id);
          }
        }
      } catch (err) {
        console.error('Failed to update Redis presence on disconnect:', err.message);
      }

      io.emit(stillOnline ? 'user:online' : 'user:offline', { userId: user.id });

      // Cleanup typing
      typingTimeouts.forEach((timeout, key) => {
        const [userKey] = key.split(':');
        if (userKey === user.id) {
          clearTimeout(timeout);
          typingTimeouts.delete(key);
        }
      });
    });
  });
};
