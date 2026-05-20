const express = require('express');
const nodemailer = require('nodemailer');
const supabase = require('../db/supabase');
const { authMiddleware } = require('../middleware/authMiddleware');
const { hasUsersColumn } = require('../db/userColumns');
const {
  handleValidationError,
  sanitizeBoolean,
  sanitizeText,
  sanitizeUuid,
} = require('../middleware/validation');

const router = express.Router();
router.use(authMiddleware);

const HELP_EMAIL = process.env.HELP_EMAIL || 'maxmunal777@gmail.com';

async function selectUserSettings(userId) {
  const cols = ['id'];
  if (await hasUsersColumn('calls_enabled')) cols.push('calls_enabled');
  if (await hasUsersColumn('notification_sound')) cols.push('notification_sound');
  if (await hasUsersColumn('friends_list_hidden')) cols.push('friends_list_hidden');

  const { data, error } = await supabase
    .from('users')
    .select(cols.join(', '))
    .eq('id', userId)
    .single();

  if (error) throw error;
  return {
    calls_enabled: data.calls_enabled !== false,
    notification_sound: data.notification_sound !== false,
    friends_list_hidden: !!data.friends_list_hidden,
  };
}

// GET /api/settings
router.get('/', async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot access settings' });
  }

  try {
    const prefs = await selectUserSettings(req.user.id);
    let blocked = [];

    const { error: blocksTableErr } = await supabase.from('user_blocks').select('id').limit(1);
    if (!blocksTableErr) {
      const { data: blocks, error } = await supabase
        .from('user_blocks')
        .select('id, created_at, blocked:blocked_id (id, username, avatar_url)')
        .eq('blocker_id', req.user.id)
        .order('created_at', { ascending: false });

      if (!error) blocked = blocks || [];
    }

    res.json({ ...prefs, blocked });
  } catch (err) {
    console.error('[settings GET]', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot update settings' });
  }

  const { calls_enabled, notification_sound, friends_list_hidden } = req.body;
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

  if (!Object.keys(updateData).length) {
    return res.status(400).json({ error: 'No valid settings provided' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id);

    if (error) return res.status(500).json({ error: 'Failed to update settings' });

    const prefs = await selectUserSettings(req.user.id);
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/help
router.post('/help', async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({ error: 'Guests cannot send help messages' });
  }

  let message;
  try {
    message = sanitizeText(req.body.message, { field: 'message', min: 10, max: 2000 });
  } catch (err) {
    return handleValidationError(res, err);
  }

  const payload = {
    from: process.env.SMTP_USER || process.env.GMAIL_USER || 'chatora-app',
    to: HELP_EMAIL,
    subject: `ChatOra Help — ${req.user.username}`,
    text: [
      `From: ${req.user.username}`,
      `Email: ${req.user.email || 'n/a'}`,
      `User ID: ${req.user.id}`,
      '',
      message,
    ].join('\n'),
  };

  try {
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail(payload);
      return res.json({ success: true, delivered: true });
    }

    console.log('[HELP MESSAGE]', JSON.stringify({ to: HELP_EMAIL, user: req.user.username, message }));
    res.json({
      success: true,
      delivered: false,
      note: 'Message logged. Configure SMTP_USER and SMTP_PASS to email support.',
    });
  } catch (err) {
    console.error('[settings help]', err);
    res.status(500).json({ error: 'Failed to send help message' });
  }
});

// POST /api/settings/block/:userId
router.post('/block/:userId', async (req, res) => {
  if (req.user.isGuest) return res.status(403).json({ error: 'Guests cannot block users' });

  let targetId;
  try {
    targetId = sanitizeUuid(req.params.userId, 'userId');
  } catch (err) {
    return handleValidationError(res, err);
  }

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  try {
    const { error } = await supabase
      .from('user_blocks')
      .upsert(
        { blocker_id: req.user.id, blocked_id: targetId },
        { onConflict: 'blocker_id,blocked_id' }
      );

    if (error) {
      if (error.code === '42P01') {
        return res.status(503).json({ error: 'Blocks are not available yet. Run the latest database migration.' });
      }
      return res.status(500).json({ error: 'Failed to block user' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/settings/block/:userId
router.delete('/block/:userId', async (req, res) => {
  if (req.user.isGuest) return res.status(403).json({ error: 'Guests cannot unblock users' });

  let targetId;
  try {
    targetId = sanitizeUuid(req.params.userId, 'userId');
  } catch (err) {
    return handleValidationError(res, err);
  }

  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', req.user.id)
      .eq('blocked_id', targetId);

    if (error) return res.status(500).json({ error: 'Failed to unblock user' });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
