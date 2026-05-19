const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const supabase = require('../db/supabase');
const { getActiveUser } = require('../socket/socketHandler');
const {
    handleValidationError,
    sanitizeBoolean,
    sanitizeUuid,
    sanitizeUserId,
} = require('../middleware/validation');

let _io = null;
const router = express.Router();

router.use(authMiddleware);

const friendshipKey = (a, b) => a < b ? [a, b] : [b, a];

// UUID format validator
const isValidId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
// Sanitize IDs used in .or() filter strings to prevent injection
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

const acceptRequest = async (requestId, acceptorId, requesterId, res) => {
    const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

    if (updateError) return res.status(500).json({ error: 'Database error accepting request' });

    const [user_a_id, user_b_id] = friendshipKey(acceptorId, requesterId);

    const { data: friendship, error: upsertError } = await supabase
        .from('friendships')
        .upsert(
            { user_a_id, user_b_id, friends_since: new Date().toISOString() },
            { onConflict: 'user_a_id,user_b_id' }
        )
        .select()
        .single();

    if (upsertError) return res.status(500).json({ error: 'Database error creating friendship' });

    return res.json(friendship);
};

// GET / => Query friendships table joining users on both user_a_id and user_b_id.
router.get('/', async (req, res) => {
    try {
        const { data: friendships, error } = await supabase
            .from('friendships')
            .select(`
        id,
        friends_since,
        user_a_id,
        user_b_id
      `)
            .or(`user_a_id.eq.${safeId(req.user.id)},user_b_id.eq.${safeId(req.user.id)}`);

        if (error) {
            console.error('friendships query error:', JSON.stringify(error));
            return res.status(500).json({ error: 'Database query failed', detail: error.message });
        }

        // Fetch friend user data separately to avoid FK alias issues
        const friendIds = friendships.map(f =>
            f.user_a_id === req.user.id ? f.user_b_id : f.user_a_id
        );

        const { data: friendUsers } = friendIds.length ? await supabase
            .from('users')
            .select('id, username, avatar_url, bio, star_count, country, state, gender, age, calls_enabled')
            .in('id', friendIds) : { data: [] };

        const userMap = {};
        (friendUsers || []).forEach(u => { userMap[u.id] = u; });

        const friendsList = friendships.map(f => {
            const friendId = f.user_a_id === req.user.id ? f.user_b_id : f.user_a_id;
            return {
                ...(userMap[friendId] || { id: friendId }),
                friendship_id: f.id,
                friends_since: f.friends_since,
            };
        });

        res.json(friendsList);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /list/:userId => Query friendships table joining users for specific user context
router.get('/list/:userId', async (req, res) => {
    try {
        const targetId = sanitizeUuid(req.params.userId, 'userId');

        const { hasUsersColumn } = require('../db/userColumns');
        if (targetId !== req.user.id && await hasUsersColumn('friends_list_hidden')) {
            const { data: targetUser } = await supabase
                .from('users')
                .select('friends_list_hidden')
                .eq('id', targetId)
                .maybeSingle();
            if (targetUser?.friends_list_hidden) {
                return res.json({ hidden: true, friends: [] });
            }
        }

        const { data: friendships, error } = await supabase
            .from('friendships')
            .select(`id, friends_since, user_a_id, user_b_id`)
            .or(`user_a_id.eq.${safeId(targetId)},user_b_id.eq.${safeId(targetId)}`);

        if (error) {
            console.error('friendships query error:', JSON.stringify(error));
            return res.status(500).json({ error: 'Database query failed', detail: error.message });
        }

        // Fetch friend user data
        const friendIds = friendships.map(f =>
            f.user_a_id === targetId ? f.user_b_id : f.user_a_id
        );

        const { data: friendUsers } = friendIds.length ? await supabase
            .from('users')
            .select('id, username, avatar_url, bio, star_count, country, state, gender, age')
            .in('id', friendIds) : { data: [] };

        const userMap = {};
        (friendUsers || []).forEach(u => { userMap[u.id] = u; });

        const friendsList = friendships.map(f => {
            const friendId = f.user_a_id === targetId ? f.user_b_id : f.user_a_id;
            return {
                ...(userMap[friendId] || { id: friendId }),
                friendship_id: f.id,
                friends_since: f.friends_since,
            };
        });

        res.json(friendsList);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /requests => Query friend_requests where to_user_id = current user id and status = pending.
router.get('/requests', async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('friend_requests')
            .select('id, created_at, from_user:from_user_id (id, username, avatar_url, star_count)')
            .eq('to_user_id', req.user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Database query failed' });

        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /request/:userId
router.post('/request/:userId', async (req, res) => {
    if (req.user.isGuest) return res.status(403).json({ error: 'Guests cannot send friend requests' });

    let targetId;
    try {
        targetId = sanitizeUuid(req.params.userId, 'userId');
    } catch (err) {
        return handleValidationError(res, err);
    }
    if (req.user.id === targetId) return res.status(400).json({ error: 'Cannot friend yourself' });
    if (targetId.startsWith('guest_')) return res.status(403).json({ error: 'Cannot friend guests' });
    if (!isValidId(targetId)) return res.status(400).json({ error: 'Invalid user ID format' });

    const [user_a_id, user_b_id] = friendshipKey(req.user.id, targetId);

    try {
        const { data: existingFriendship, error: friendshipError } = await supabase
            .from('friendships')
            .select('id')
            .eq('user_a_id', user_a_id)
            .eq('user_b_id', user_b_id)
            .maybeSingle();

        if (friendshipError) return res.status(500).json({ error: 'Database query failed' });
        if (existingFriendship) return res.status(409).json({ error: 'Already friends' });

        const { data: existingRequests, error: reqError } = await supabase
            .from('friend_requests')
            .select('id, from_user_id, to_user_id, status')
            .eq('status', 'pending')
            .or(`and(from_user_id.eq.${safeId(req.user.id)},to_user_id.eq.${safeId(targetId)}),and(from_user_id.eq.${safeId(targetId)},to_user_id.eq.${safeId(req.user.id)})`);

        if (reqError) return res.status(500).json({ error: 'Database query failed' });

        if (existingRequests && existingRequests.length > 0) {
            const existingReq = existingRequests[0];
            if (existingReq.from_user_id === targetId) {
                return await acceptRequest(existingReq.id, req.user.id, targetId, res);
            }
            return res.status(409).json({ error: 'Friend request already sent' });
        }

        const { data: request, error: insertError } = await supabase
            .from('friend_requests')
            .insert({
                from_user_id: req.user.id,
                to_user_id: targetId,
                status: 'pending'
            })
            .select()
            .single();

        if (insertError) {
            console.error('friend_requests insert error:', JSON.stringify(insertError));
            // 23505 = unique_violation — request already exists
            if (insertError.code === '23505') {
                return res.status(409).json({ error: 'Friend request already sent' });
            }
            return res.status(500).json({ error: 'Failed to send friend request', detail: insertError.message, code: insertError.code });
        }

        try {
            const { data: senderInfo } = await supabase
                .from('users')
                .select('id, username, avatar_url, star_count')
                .eq('id', req.user.id)
                .single();

            console.log('[friend:request] attempting to notify userId:', targetId);
            const activeTarget = getActiveUser(targetId);
            console.log('[friend:request] activeTarget found:', !!activeTarget, 'io available:', !!_io);

            if (activeTarget && _io) {
                activeTarget.socketIds.forEach(sid => {
                    const targetSocket = _io.sockets.sockets.get(sid);
                    console.log('[friend:request] socket found for sid:', sid, !!targetSocket);
                    if (targetSocket) {
                        targetSocket.emit('friend:request', {
                            request: {
                                id: request.id,
                                created_at: request.created_at,
                                from_user: senderInfo,
                            }
                        });
                    }
                });
            }
        } catch (emitErr) {
            console.error('Failed to emit friend:request', emitErr);
        }

        res.json(request);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /accept/:requestId
router.post('/accept/:requestId', async (req, res) => {
    if (req.user.isGuest) return res.status(403).json({ error: 'Guests cannot accept friend requests' });

    let requestId;
    try {
        requestId = sanitizeUuid(req.params.requestId, 'requestId');
    } catch (err) {
        return handleValidationError(res, err);
    }

    try {
        const { data: request, error } = await supabase
            .from('friend_requests')
            .select('from_user_id')
            .eq('id', requestId)
            .eq('to_user_id', req.user.id)
            .eq('status', 'pending')
            .single();

        if (error || !request) return res.status(404).json({ error: 'Friend request not found' });

        await acceptRequest(requestId, req.user.id, request.from_user_id, res);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /decline/:requestId
router.post('/decline/:requestId', async (req, res) => {
    let requestId;
    try {
        requestId = sanitizeUuid(req.params.requestId, 'requestId');
    } catch (err) {
        return handleValidationError(res, err);
    }

    try {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'declined' })
            .eq('id', requestId)
            .eq('to_user_id', req.user.id)
            .eq('status', 'pending');

        if (error) return res.status(500).json({ error: 'Failed to decline request' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /:userId
router.delete('/:userId', async (req, res) => {
    if (req.user.isGuest) return res.status(403).json({ error: 'Guests cannot have friends' });

    let targetId;
    try {
        targetId = sanitizeUuid(req.params.userId, 'userId');
    } catch (err) {
        return handleValidationError(res, err);
    }
    const [user_a_id, user_b_id] = friendshipKey(req.user.id, targetId);

    try {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('user_a_id', user_a_id)
            .eq('user_b_id', user_b_id);

        if (error) return res.status(500).json({ error: 'Failed to delete friendship' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /settings
router.put('/settings', async (req, res) => {
    if (req.user.isGuest) return res.status(403).json({ error: 'Guests cannot update settings' });

    const { calls_enabled, notification_sound, friends_list_hidden } = req.body;
    const { hasUsersColumn } = require('../db/userColumns');
    const updateData = {};
    try {
        if (calls_enabled !== undefined && await hasUsersColumn('calls_enabled')) {
            updateData.calls_enabled = sanitizeBoolean(calls_enabled, 'calls_enabled');
        }
        if (notification_sound !== undefined && await hasUsersColumn('notification_sound')) {
            updateData.notification_sound = sanitizeBoolean(notification_sound, 'notification_sound');
        }
        if (friends_list_hidden !== undefined && await hasUsersColumn('friends_list_hidden')) {
            updateData.friends_list_hidden = sanitizeBoolean(friends_list_hidden, 'friends_list_hidden');
        }
    } catch (err) {
        return handleValidationError(res, err);
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No valid settings provided' });

    try {
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', req.user.id)
            .select('calls_enabled, notification_sound')
            .single();

        if (error) return res.status(500).json({ error: 'Failed to update settings' });

        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /check/:userId
router.get('/check/:userId', async (req, res) => {
    let targetId;
    try {
        targetId = sanitizeUuid(req.params.userId, 'userId');
    } catch (err) {
        return handleValidationError(res, err);
    }
    const [user_a_id, user_b_id] = friendshipKey(safeId(req.user.id), safeId(targetId));

    try {
        const { data: friendship, error: friendError } = await supabase
            .from('friendships')
            .select('id')
            .eq('user_a_id', user_a_id)
            .eq('user_b_id', user_b_id)
            .maybeSingle();

        if (friendError && friendError.code !== 'PGRST116') {
            console.error(friendError);
        }

        if (friendship) {
            return res.json({ friends: true, pendingRequest: null });
        }

        const { data: requests, error: reqError } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('status', 'pending')
            .or(`and(from_user_id.eq.${safeId(req.user.id)},to_user_id.eq.${safeId(targetId)}),and(from_user_id.eq.${safeId(targetId)},to_user_id.eq.${safeId(req.user.id)})`);

        if (reqError) return res.status(500).json({ error: 'Database error' });

        const pendingRequest = (requests && requests.length > 0) ? requests[0] : null;

        res.json({ friends: false, pendingRequest });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = (io) => { _io = io; return router; };
