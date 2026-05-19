const OWNER_EMAILS = new Set([
  'manualmax777@gmail.com',
  'munalmax777@gmail.com',
]);

const isOwnerEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return OWNER_EMAILS.has(email.toLowerCase().trim());
};

/** Attach is_owner when DB flag or owner email matches. */
const withOwnerFlag = (user) => {
  if (!user) return user;
  return {
    ...user,
    is_owner: Boolean(user.is_owner) || isOwnerEmail(user.email),
  };
};

module.exports = { OWNER_EMAILS, isOwnerEmail, withOwnerFlag };
