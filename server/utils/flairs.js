/** Flair ids users may pick (must match client CHOOSABLE_FLAIRS). */
const CHOOSABLE_FLAIR_IDS = new Set([
  'chatterbox',
  'nightowl',
  'traveler',
  'gamer',
  'musiclover',
  'techie',
  'foodie',
  'bookworm',
  'artist',
  'sportsfan',
  'vibing',
  'friendly',
  'mysterious',
  'chill',
  'hyped',
  'coder',
  'dreamer',
  'zen',
  'pioneer',
  'cosmic',
]);

const MAX_CHOSEN_FLAIRS = 1;

const sanitizeChosenFlair = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const id = String(value).trim().toLowerCase();
  if (!CHOOSABLE_FLAIR_IDS.has(id)) {
    const err = new Error('Invalid flair selection');
    err.status = 400;
    err.field = 'flair';
    err.isValidationError = true;
    throw err;
  }
  return id;
};

const normalizeFlairsArray = (user) => {
  if (!user) return [];
  if (Array.isArray(user.flairs)) {
    return user.flairs
      .map((id) => String(id || '').trim().toLowerCase())
      .filter((id) => CHOOSABLE_FLAIR_IDS.has(id));
  }
  if (user.flair) {
    const id = String(user.flair).trim().toLowerCase();
    return CHOOSABLE_FLAIR_IDS.has(id) ? [id] : [];
  }
  return [];
};

const sanitizeFlairsList = (value) => {
  if (!Array.isArray(value)) {
    const err = new Error('flairs must be an array');
    err.status = 400;
    err.isValidationError = true;
    throw err;
  }
  const unique = [];
  for (const item of value) {
    const id = sanitizeChosenFlair(item);
    if (id && !unique.includes(id)) unique.push(id);
    if (unique.length > MAX_CHOSEN_FLAIRS) {
      const err = new Error(`You can have at most ${MAX_CHOSEN_FLAIRS} flairs`);
      err.status = 400;
      err.isValidationError = true;
      throw err;
    }
  }
  return unique;
};

const toggleChosenFlair = (current, flairId, action = 'toggle') => {
  const id = sanitizeChosenFlair(flairId);
  if (!id) return current;

  const has = current.includes(id);
  if (action === 'remove' || (action === 'toggle' && has)) {
    return current.filter((x) => x !== id);
  }
  if (has) return current;
  if (current.length >= MAX_CHOSEN_FLAIRS) {
    return [id];
  }
  return [...current, id];
};

module.exports = {
  CHOOSABLE_FLAIR_IDS,
  MAX_CHOSEN_FLAIRS,
  sanitizeChosenFlair,
  sanitizeFlairsList,
  normalizeFlairsArray,
  toggleChosenFlair,
};
