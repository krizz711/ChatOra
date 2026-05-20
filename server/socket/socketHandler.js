const redis = require('../redis/redisClient');
const supabase = require('../db/supabase');
const { v4: uuidv4 } = require('uuid');
const { getUserColumns } = require('../db/userColumns');
const {
  ensureSizeUnder,
  sanitizeFileName,
  sanitizeString,
  sanitizeText,
  sanitizeUrl,
  sanitizeUserId,
  sanitizeUuid,
} = require('../middleware/validation');

// ─── PROFANITY FILTER ────────────────────────────────────────────
const BAD_WORDS = [
  'spam', 'scam', 'nigger', 'nigga', 'faggot', 'retard',
  'slut', 'whore', 'bitch', 'asshole', 'dickhead', 'cunt',
];
const BAD_PATTERNS = BAD_WORDS.map(w => {
  // Match leetspeak: a->@/4, e->3, i->1/!, o->0, s->$/5
  const leet = w.replace(/a/gi, '[a@4]').replace(/e/gi, '[e3]')
    .replace(/i/gi, '[i1!]').replace(/o/gi, '[o0]').replace(/s/gi, '[s$5]');
  // Allow spaces/dots between chars
  return new RegExp(leet.split('').join('[\\s._-]*'), 'gi');
});
const filterMessage = (text) => {
  let filtered = text;
  BAD_PATTERNS.forEach(re => {
    filtered = filtered.replace(re, m => '*'.repeat(m.replace(/[\s._-]/g, '').length));
  });
  return filtered;
};

// ─── XSS SANITIZER ───────────────────────────────────────────────
const sanitize = (str) => {
  const cleaned = sanitizeText(str, { field: 'text', min: 1, max: 2000, allowNewlines: true });
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

// ─── SOCKET RATE LIMITER ─────────────────────────────────────────
const rateBuckets = new Map();
const RATE_LIMITS = {
  'message:send': { max: 20, windowMs: 60000 },
  'message:file': { max: 10, windowMs: 60000 },
  'private:send': { max: 30, windowMs: 60000 },
  'private:history': { max: 15, windowMs: 60000 },
  'typing:start': { max: 30, windowMs: 60000 },
  'room:join': { max: 20, windowMs: 60000 },
  'users:online': { max: 10, windowMs: 60000 },
  'call:offer': { max: 5, windowMs: 60000 },
};
const checkRate = (socketId, event) => {
  const cfg = RATE_LIMITS[event];
  if (!cfg) return true;
  const key = `${socketId}:${event}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + cfg.windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count <= cfg.max;
};
// Periodic cleanup of stale rate limit buckets
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}, 120000);

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

const { withOwnerFlag } = require('../utils/owner');

const publicUser = (user) => {
  const u = withOwnerFlag(user);
  return {
    id: u.id,
    username: u.username,
    avatar_url: u.avatar_url,
    country: u.country || null,
    state: u.state || null,
    gender: u.gender || 'other',
    age: u.age || null,
    star_count: u.star_count || 0,
    is_owner: Boolean(u.is_owner),
    flair: u.flair || null,
    flairs: Array.isArray(u.flairs) ? u.flairs : (u.flair ? [u.flair] : []),
  };
};

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

// ─── INTERVAL-BASED CLEANUP (replaces per-message cleanup) ───────
const cleanedRooms = new Map(); // roomId -> lastCleanedAt
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const maybeCleanupRoom = async (roomId) => {
  const now = Date.now();
  const lastCleaned = cleanedRooms.get(roomId) || 0;
  if (now - lastCleaned < CLEANUP_INTERVAL_MS) return;
  cleanedRooms.set(roomId, now);
  await cleanupExpiredRoomMessages(roomId);
};
// Global cleanup every 10 min to sweep stale room entries
setInterval(() => {
  const now = Date.now();
  for (const [roomId, ts] of cleanedRooms) {
    if (now - ts > 30 * 60 * 1000) cleanedRooms.delete(roomId);
  }
}, 10 * 60 * 1000);

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

// ─── CACHED USER LIST (avoid re-serializing on every poll) ───────
let cachedUserList = null;
let cachedUserListAt = 0;
const USER_LIST_CACHE_MS = 3000; // 3 second cache

const handler = (io) => {
  const emitValidationError = (socket, event, message) => {
    socket.emit(event, { error: message });
  };

  // Track typing timeouts (with size guard)
  const typingTimeouts = new Map();
  const MAX_TYPING_ENTRIES = 5000;

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
      try {
        roomId = sanitizeUuid(roomId, 'roomId');
      } catch {
        return;
      }
      if (!checkRate(socket.id, 'room:join')) return socket.emit('error', { message: 'Too many requests, slow down' });
      socket.join(roomId);

      await maybeCleanupRoom(roomId);
      const history = await fetchRoomHistory(roomId);
      if (Array.isArray(history)) socket.emit('message:history', { roomId, messages: history });

      // Count members in room
      const roomSockets = await io.in(roomId).allSockets();
      io.to(roomId).emit('room:count', { roomId, count: roomSockets.size });

      socket.emit('room:joined', { roomId });
    });

    // ─── LEAVE ROOM ─────────────────────────────────────────────
    socket.on('room:leave', async ({ roomId }) => {
      try {
        roomId = sanitizeUuid(roomId, 'roomId');
      } catch {
        return;
      }
      socket.leave(roomId);
      const roomSockets = await io.in(roomId).allSockets();
      io.to(roomId).emit('room:count', { roomId, count: roomSockets.size });
    });

    // ─── SEND MESSAGE TO ROOM ────────────────────────────────────
    socket.on('message:send', async ({ roomId, text, replyTo }) => {
      try {
        roomId = sanitizeUuid(roomId, 'roomId');
        ensureSizeUnder({ roomId, text, replyTo }, 'message', 8192);
        replyTo = replyTo ? sanitizeUuid(replyTo, 'replyTo') : null;
      } catch {
        return emitValidationError(socket, 'message:error', 'Invalid message payload');
      }
      if (!checkRate(socket.id, 'message:send')) return socket.emit('message:error', { error: 'You are sending messages too fast. Slow down.' });

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

      await maybeCleanupRoom(roomId);
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
      try {
        roomId = sanitizeUuid(roomId, 'roomId');
        fileUrl = sanitizeUrl(fileUrl, { field: 'fileUrl', max: 2048, allowedHosts: ['res.cloudinary.com', 'cloudinary.com'] });
        fileName = sanitizeFileName(fileName);
        fileType = sanitizeString(String(fileType || ''), { field: 'fileType', min: 1, max: 100, pattern: /^[A-Za-z0-9.+\/-]+$/ });
        if (fileSize !== undefined && fileSize !== null) {
          const parsedSize = Number(fileSize);
          if (!Number.isInteger(parsedSize) || parsedSize < 1 || parsedSize > 10 * 1024 * 1024) throw new Error('Invalid file size');
          fileSize = parsedSize;
        }
        ensureSizeUnder({ roomId, fileUrl, fileName, fileType, fileSize }, 'file message', 16384);
      } catch {
        return emitValidationError(socket, 'message:error', 'Invalid file payload');
      }
      if (!checkRate(socket.id, 'message:file')) return socket.emit('message:error', { error: 'Too many file uploads. Slow down.' });

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
        fileName,
        fileType,
        fileSize,
        sender: buildSender(user),
        timestamp: new Date().toISOString(),
        type: 'file',
      };

      await maybeCleanupRoom(roomId);
      const insertError = await insertRoomMessage({
        id: message.id,
        room_id: roomId,
        sender_id: user.id,
        file_url: fileUrl,
        file_name: fileName,
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
      try {
        roomId = sanitizeUuid(roomId, 'roomId');
      } catch {
        return;
      }
      if (!checkRate(socket.id, 'typing:start')) return;
      socket.to(roomId).emit('typing:update', {
        userId: user.id,
        username: user.username,
        roomId,
        typing: true,
      });

      // Auto-clear typing after 3s (with size guard)
      const key = `${user.id}:${roomId}`;
      if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key));
      if (typingTimeouts.size >= MAX_TYPING_ENTRIES) return;
      typingTimeouts.set(key, setTimeout(() => {
        socket.to(roomId).emit('typing:update', {
          userId: user.id, username: user.username, roomId, typing: false,
        });
        typingTimeouts.delete(key);
      }, 3000));
    });

    socket.on('typing:stop', ({ roomId }) => {
      try {
        roomId = sanitizeUuid(roomId, 'roomId');
      } catch {
        return;
      }
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
      try {
        withUserId = sanitizeUserId(withUserId, 'withUserId', { allowGuest: true });
      } catch {
        return socket.emit('private:history', { withUserId, messages: [] });
      }
      if (!checkRate(socket.id, 'private:history')) return socket.emit('private:history', { withUserId, messages: [] });

      try {
        // Check if either user has blocked the other
        const { data: blocks, error: blockError } = await supabase
          .from('user_blocks')
          .select('id')
          .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${withUserId}),and(blocker_id.eq.${withUserId},blocked_id.eq.${user.id})`)
          .limit(1);

        if (blockError || (blocks && blocks.length > 0)) {
          return socket.emit('private:history', { withUserId, messages: [] });
        }

        // Use separate filter conditions instead of string interpolation
        const { data, error } = await supabase
          .from('private_messages')
          .select('*')
          .or(`and(sender_key.eq.${user.id},recipient_key.eq.${String(withUserId).replace(/[^a-zA-Z0-9_-]/g, '')}),and(sender_key.eq.${String(withUserId).replace(/[^a-zA-Z0-9_-]/g, '')},recipient_key.eq.${user.id})`)
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
      try {
        toUserId = sanitizeUserId(toUserId, 'toUserId', { allowGuest: true });
        ensureSizeUnder({ toUserId, text, fileUrl, fileName, fileType }, 'private message', 32768);
        if (fileUrl) fileUrl = sanitizeUrl(fileUrl, { field: 'fileUrl', max: 2048, allowedHosts: ['res.cloudinary.com', 'cloudinary.com'] });
        if (fileName) fileName = sanitizeFileName(fileName);
        if (fileType) fileType = sanitizeString(String(fileType), { field: 'fileType', min: 1, max: 100, pattern: /^[A-Za-z0-9.+\/-]+$/ });
      } catch {
        return socket.emit('message:error', { error: 'Invalid private message payload' });
      }
      if (!text?.trim() && !fileUrl) return;
      if (!checkRate(socket.id, 'private:send')) return socket.emit('message:error', { error: 'You are sending messages too fast. Slow down.' });

      try {
        // Check if recipient has blocked the sender
        const { data: blocks, error: blockError } = await supabase
          .from('user_blocks')
          .select('id')
          .eq('blocker_id', toUserId)
          .eq('blocked_id', user.id)
          .limit(1);

        if (blockError || (blocks && blocks.length > 0)) {
          return socket.emit('message:error', { error: 'This user has blocked you' });
        }
      } catch (err) {
        console.error('Failed to check block status:', err);
        return socket.emit('message:error', { error: 'Failed to send message' });
      }

      const safeText = text ? filterMessage(sanitize(text)) : '';

      const message = buildPrivateMessage({
        fromUser: user,
        toUserId,
        text: safeText,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
      });

      const activeRecipient = getActiveUser(toUserId);
      let recipient = activeRecipient?.user || { id: toUserId };
      let recipientRaw = null;

      await storePrivateMessage(message, recipient);
      socket.emit('private:receive', message);

      if (activeRecipient?.socketIds?.size) {
        activeRecipient.socketIds.forEach(sid => {
          if (sid === socket.id) return; // skip sender's own socket to avoid duplicate
          const recipientSocket = io.sockets.sockets.get(sid);
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
      if (!checkRate(socket.id, 'users:online')) return;

      // Serve from cache if fresh enough
      const now = Date.now();
      if (cachedUserList && (now - cachedUserListAt) < USER_LIST_CACHE_MS) {
        socket.emit('users:list', cachedUserList);
        return;
      }

      const memoryUsers = listActiveUsers();
      if (memoryUsers.length) {
        cachedUserList = memoryUsers;
        cachedUserListAt = now;
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

        cachedUserList = users;
        cachedUserListAt = now;
        socket.emit('users:list', users);
      } catch (err) {
        console.error('Failed to read Redis presence:', err.message);
        socket.emit('users:list', []);
      }
    });

    socket.on('call:offer', async ({ toUserId, offer, callType }) => {
      try {
        toUserId = sanitizeUserId(toUserId, 'toUserId', { allowGuest: true });
        ensureSizeUnder({ toUserId, offer, callType }, 'call offer', 65536);
        callType = callType ? sanitizeString(String(callType), { field: 'callType', min: 3, max: 16, pattern: /^(voice|video)$/i }) : 'voice';
      } catch {
        return socket.emit('call:error', { message: 'Invalid call payload' });
      }
      if (!checkRate(socket.id, 'call:offer')) return socket.emit('call:error', { message: 'Too many call attempts' });
      if (user.isGuest) return socket.emit('call:error', { message: 'Guests cannot make calls' });
      const { data: target } = await supabase.from('users').select('id, calls_enabled').eq('id', toUserId).maybeSingle();
      if (!target) return socket.emit('call:error', { message: 'User not found' });
      if (target.calls_enabled === false) return socket.emit('call:declined', { reason: 'calls_disabled', toUserId });
      const activeTarget = getActiveUser(toUserId);
      if (!activeTarget) return socket.emit('call:declined', { reason: 'offline', toUserId });
      activeTarget.socketIds.forEach(sid => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('call:incoming', { fromUserId: user.id, fromUsername: user.username, fromAvatar: user.avatar_url, offer, callType: callType || 'voice' });
      });
    });

    socket.on('call:answer', ({ toUserId, answer }) => {
      try {
        toUserId = sanitizeUserId(toUserId, 'toUserId', { allowGuest: true });
        ensureSizeUnder({ toUserId, answer }, 'call answer', 65536);
      } catch {
        return;
      }
      const activeTarget = getActiveUser(toUserId);
      if (!activeTarget) return;
      activeTarget.socketIds.forEach(sid => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('call:answered', { fromUserId: user.id, answer });
      });
    });

    socket.on('call:ice', ({ toUserId, candidate }) => {
      try {
        toUserId = sanitizeUserId(toUserId, 'toUserId', { allowGuest: true });
        ensureSizeUnder({ toUserId, candidate }, 'call candidate', 65536);
      } catch {
        return;
      }
      const activeTarget = getActiveUser(toUserId);
      if (!activeTarget) return;
      activeTarget.socketIds.forEach(sid => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('call:ice', { fromUserId: user.id, candidate });
      });
    });

    socket.on('call:decline', ({ toUserId }) => {
      try {
        toUserId = sanitizeUserId(toUserId, 'toUserId', { allowGuest: true });
      } catch {
        return;
      }
      const activeTarget = getActiveUser(toUserId);
      if (!activeTarget) return;
      activeTarget.socketIds.forEach(sid => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('call:declined', { fromUserId: user.id, reason: 'rejected' });
      });
    });

    socket.on('call:end', ({ toUserId }) => {
      try {
        toUserId = sanitizeUserId(toUserId, 'toUserId', { allowGuest: true });
      } catch {
        return;
      }
      const activeTarget = getActiveUser(toUserId);
      if (!activeTarget) return;
      activeTarget.socketIds.forEach(sid => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('call:ended', { fromUserId: user.id });
      });
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
        if (key.startsWith(user.id + ':')) {
          clearTimeout(timeout);
          typingTimeouts.delete(key);
        }
      });
    });
  });
};

module.exports = handler;
module.exports.getActiveUser = getActiveUser;
