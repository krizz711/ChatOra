export const FLAIRS = [
  { id: 'newcomer',    label: 'Newcomer',     emoji: '🌱', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   description: 'Just joined NexChat',         requirement: null },
  { id: 'regular',     label: 'Regular',      emoji: '☕', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  description: 'Trusted community member',     requirement: 'star_count >= 3' },
  { id: 'popular',     label: 'Popular',      emoji: '⭐', color: '#eab308', bg: 'rgba(234,179,8,0.15)',   description: 'Highly starred chatter',       requirement: 'star_count >= 10' },
  { id: 'superstar',   label: 'Superstar',    emoji: '🌟', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  description: 'Elite community figure',       requirement: 'star_count >= 25' },
  { id: 'legend',      label: 'Legend',       emoji: '👑', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', description: 'NexChat legend status',        requirement: 'star_count >= 50' },
  { id: 'chatterbox',  label: 'Chatterbox',   emoji: '💬', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', description: 'Always in the conversation',   requirement: null },
  { id: 'nightowl',    label: 'Night Owl',    emoji: '🦉', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', description: 'Loves chatting after midnight', requirement: null },
  { id: 'traveler',    label: 'Traveler',     emoji: '✈️', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', description: 'Chatting from around the world',requirement: null },
  { id: 'gamer',       label: 'Gamer',        emoji: '🎮', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', description: 'Lives for gaming',             requirement: null },
  { id: 'musiclover',  label: 'Music Lover',  emoji: '🎵', color: '#ec4899', bg: 'rgba(236,72,153,0.12)', description: 'Always has a song in mind',    requirement: null },
  { id: 'techie',      label: 'Techie',       emoji: '💻', color: '#14b8a6', bg: 'rgba(20,184,166,0.12)', description: 'Tech enthusiast',              requirement: null },
  { id: 'foodie',      label: 'Foodie',       emoji: '🍜', color: '#f97316', bg: 'rgba(249,115,22,0.12)', description: 'Food is life',                 requirement: null },
  { id: 'bookworm',    label: 'Bookworm',     emoji: '📚', color: '#84cc16', bg: 'rgba(132,204,22,0.12)', description: 'Passionate reader',            requirement: null },
  { id: 'artist',      label: 'Artist',       emoji: '🎨', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  description: 'Creative soul',                requirement: null },
  { id: 'sportsfan',   label: 'Sports Fan',   emoji: '⚽', color: '#10b981', bg: 'rgba(16,185,129,0.12)', description: 'Die-hard sports enthusiast',   requirement: null },
  { id: 'vibing',      label: 'Vibing',       emoji: '😎', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', description: 'Just here for good vibes',     requirement: null },
  { id: 'friendly',    label: 'Friendly',     emoji: '🤗', color: '#34d399', bg: 'rgba(52,211,153,0.12)', description: 'Always welcoming',             requirement: null },
  { id: 'mysterious',  label: 'Mysterious',   emoji: '🎭', color: '#6d28d9', bg: 'rgba(109,40,217,0.12)', description: 'An enigma',                   requirement: null },
  { id: 'chill',       label: 'Chill',        emoji: '❄️', color: '#7dd3fc', bg: 'rgba(125,211,252,0.12)', description: 'Taking it easy',              requirement: null },
  { id: 'hyped',       label: 'Hyped',        emoji: '🔥', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  description: 'Maximum energy',              requirement: null },
  { id: 'verified',    label: 'Verified',     emoji: '✅', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', description: 'Verified account',             requirement: 'is_verified' },
  { id: 'pro',         label: 'Pro Member',   emoji: '💎', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', description: 'NexChat Pro subscriber',      requirement: 'is_pro' },
  { id: 'owner',       label: 'Owner',        emoji: '👨‍💼', color: '#dc2626', bg: 'rgba(220,38,38,0.12)',  description: 'NexChat Founder',            requirement: 'is_owner' },
  { id: 'guest',       label: 'Guest',        emoji: '👤', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', description: 'Visiting as a guest',         requirement: 'isGuest' },
];

export const AUTO_FLAIR_IDS = ['newcomer', 'regular', 'popular', 'superstar', 'legend', 'verified', 'pro', 'owner', 'guest'];

export const CHOOSABLE_FLAIRS = FLAIRS.filter(f => !AUTO_FLAIR_IDS.includes(f.id));

export const getFlairById = (id) => FLAIRS.find(f => f.id === id) || null;

export const getAutoFlairs = (user) => {
  if (!user) return [];
  const result = [];
  if (user.isGuest) { result.push(getFlairById('guest')); return result; }
  if (user.is_owner) result.push(getFlairById('owner'));
  if (user.is_pro) result.push(getFlairById('pro'));
  const stars = user.star_count || 0;
  if (stars >= 50)      result.push(getFlairById('legend'));
  else if (stars >= 25) result.push(getFlairById('superstar'));
  else if (stars >= 10) result.push(getFlairById('popular'));
  else if (stars >= 3)  result.push(getFlairById('regular'));
  else                  result.push(getFlairById('newcomer'));
  return result.filter(Boolean);
};

export const getUserFlairs = (user) => {
  const auto = getAutoFlairs(user);
  const chosen = user?.flair ? [getFlairById(user.flair)].filter(Boolean) : [];
  const ids = new Set(auto.map(f => f.id));
  const extra = chosen.filter(f => !ids.has(f.id));
  return [...auto, ...extra].slice(0, 3);
};
