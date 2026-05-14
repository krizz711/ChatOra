const redis = require('../redis/redisClient');
const supabase = require('../db/supabase');
const { v4: uuidv4 } = require('uuid');

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

module.exports = (io) => {
  // Track typing timeouts
  const typingTimeouts = new Map();

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`✅ Connected: ${user.username} (${socket.id})`);

    // Set user online in Redis
    await redis.hset('online_users', user.id, JSON.stringify({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      country: user.country || null,
      state: user.state || null,
      gender: user.gender || 'other',
      age: user.age || null,
      star_count: user.star_count || 0,
      socketId: socket.id,
    }));

    io.emit('user:online', { userId: user.id, username: user.username });

    // ─── JOIN ROOM ──────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);

      const { data: history, error } = await supabase
        .from('messages')
        .select(`
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
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && Array.isArray(history)) {
        socket.emit('message:history', { roomId, messages: history.reverse().map(mapStoredMessage) });
      }

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

      const { error: insertError } = await supabase.from('messages').insert({
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

      const { error: insertError } = await supabase.from('messages').insert({
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
    socket.on('private:send', async ({ toUserId, text, fileUrl, fileName, fileType }) => {
      if (!toUserId || (!text && !fileUrl)) return;

      // Find recipient socket
      const recipientRaw = await redis.hget('online_users', toUserId);
      if (!recipientRaw) {
        return socket.emit('private:error', { error: 'User is offline' });
      }
      const recipient = safeParseUser(recipientRaw);
      if (!recipient || !recipient.socketId) {
        await redis.hdel('online_users', toUserId);
        return socket.emit('private:error', { error: 'User is offline' });
      }
      const recipientSocket = io.sockets.sockets.get(recipient.socketId);
      if (!recipientSocket) {
        await redis.hdel('online_users', toUserId);
        return socket.emit('private:error', { error: 'User is offline' });
      }

      const message = {
        id: uuidv4(),
        text: text ? filterMessage(sanitize(text)) : '',
        fileUrl: fileUrl || null,
        fileName: fileName ? sanitize(fileName) : null,
        fileType: fileType || null,
        sender: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          gender: user.gender || 'other',
        },
        timestamp: new Date().toISOString(),
        type: fileUrl ? 'file' : 'text',
      };

      // Send to recipient
      recipientSocket.emit('private:receive', message);
      // Echo to sender
      socket.emit('private:receive', { ...message, toUserId });
    });

    // ─── GET ONLINE USERS ────────────────────────────────────────
    socket.on('users:online', async () => {
      const all = await redis.hgetall('online_users');
      const users = [];

      if (all) {
        const invalidKeys = [];

        Object.entries(all).forEach(([key, value]) => {
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
      }

      socket.emit('users:list', users);
    });

    // ─── DISCONNECT ──────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Disconnected: ${user.username}`);
      await redis.hdel('online_users', user.id);
      io.emit('user:offline', { userId: user.id });

      // Cleanup typing
      typingTimeouts.forEach((timeout, key) => {
        if (key.startsWith(user.id)) {
          clearTimeout(timeout);
          typingTimeouts.delete(key);
        }
      });
    });
  });
};
