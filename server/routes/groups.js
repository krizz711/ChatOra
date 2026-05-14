const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../db/supabase');
const { authMiddleware } = require('../middleware/authMiddleware');

// Get all global groups + user's groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Global groups
    const { data: globalGroups } = await supabase
      .from('groups')
      .select('*')
      .eq('is_global', true)
      .order('created_at');

    // User's groups (public + private they joined)
    const { data: memberOf } = await supabase
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', req.user.id)
      .eq('groups.is_global', false);

    const userGroups = memberOf?.map(m => m.groups).filter(Boolean) || [];

    // Public groups not yet joined
    const { data: publicGroups } = await supabase
      .from('groups')
      .select('*')
      .eq('is_private', false)
      .eq('is_global', false)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({ globalGroups, userGroups, publicGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a group
router.post('/create', authMiddleware, async (req, res) => {
  const { name, is_private } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  try {
    const invite_code = is_private ? uuidv4().slice(0, 8).toUpperCase() : null;

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name,
        owner_id: req.user.id,
        is_private: !!is_private,
        invite_code,
        is_global: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-join creator
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: req.user.id,
    });

    res.status(201).json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join private group by invite code
router.post('/join/invite/:code', authMiddleware, async (req, res) => {
  try {
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', req.params.code.toUpperCase())
      .single();

    if (!group) return res.status(404).json({ error: 'Invalid invite code' });

    await supabase.from('group_members').upsert({
      group_id: group.id,
      user_id: req.user.id,
    });

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a public group
router.post('/join/:groupId', authMiddleware, async (req, res) => {
  try {
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('id', req.params.groupId)
      .eq('is_private', false)
      .single();

    if (!group) return res.status(404).json({ error: 'Group not found' });

    await supabase.from('group_members').upsert({
      group_id: group.id,
      user_id: req.user.id,
    });

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a group
router.delete('/leave/:groupId', authMiddleware, async (req, res) => {
  try {
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', req.params.groupId)
      .eq('user_id', req.user.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
