const supabase = require('./supabase');

const columnExistsCache = new Map();

const baseUserColumns = [
  'id',
  'username',
  'email',
  'avatar_url',
  'bio',
  'star_count',
  'created_at',
];

const optionalUserColumns = [
  'country',
  'state',
  'gender',
  'age',
  'google_id',
  'auth_provider',
  'password_hash',
  'calls_enabled',
  'notification_sound',
  'friends_list_hidden',
];

async function hasUsersColumn(columnName) {
  if (columnExistsCache.has(columnName)) return columnExistsCache.get(columnName);

  const { error } = await supabase
    .from('users')
    .select(columnName)
    .limit(1);

  const exists = !error;
  columnExistsCache.set(columnName, exists);
  return exists;
}

async function getUserColumns({ includePasswordHash = false, includeAuthProvider = false } = {}) {
  const columns = [...baseUserColumns];

  for (const columnName of optionalUserColumns) {
    if (columnName === 'password_hash' && !includePasswordHash) continue;
    if (columnName === 'auth_provider' && !includeAuthProvider) continue;
    if (await hasUsersColumn(columnName)) {
      columns.push(columnName);
    }
  }

  return columns.join(', ');
}

async function stripUnsupportedUserFields(payload = {}) {
  const filtered = { ...payload };

  for (const columnName of optionalUserColumns) {
    if (await hasUsersColumn(columnName)) continue;
    delete filtered[columnName];
  }

  if (filtered.password_hash === undefined) {
    delete filtered.password_hash;
  }

  if (filtered.auth_provider === undefined) {
    delete filtered.auth_provider;
  }

  if (filtered.google_id === undefined) {
    delete filtered.google_id;
  }

  if (filtered.age === undefined) {
    delete filtered.age;
  }

  // Return the filtered payload as-is so callers can insert sensitive fields
  // like `password_hash` when appropriate. Do not strip those here.
  return filtered;
}

module.exports = {
  hasUsersColumn,
  getUserColumns,
  stripUnsupportedUserFields,
};