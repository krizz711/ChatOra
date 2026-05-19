const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_ID_RE = /^guest_[A-Za-z0-9_-]{6,64}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const makeError = (field, message) => {
  const err = new Error(message);
  err.status = 400;
  err.field = field;
  err.isValidationError = true;
  return err;
};

const assertPlainObject = (value, field = 'body') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw makeError(field, `${field} must be an object`);
  }
  return value;
};

const sanitizeString = (value, {
  field = 'value',
  min = 0,
  max = Infinity,
  allowEmpty = false,
  trim = true,
  preserveNewlines = false,
  lowercase = false,
  uppercase = false,
  pattern = null,
} = {}) => {
  if (typeof value !== 'string') throw makeError(field, `${field} must be a string`);
  let output = value.replace(CONTROL_CHARS_RE, '');
  if (!preserveNewlines) output = output.replace(/\r?\n/g, ' ');
  if (trim) output = output.trim();
  if (!allowEmpty && output.length === 0) throw makeError(field, `${field} is required`);
  if (output.length < min) throw makeError(field, `${field} is too short`);
  if (output.length > max) throw makeError(field, `${field} is too long`);
  if (lowercase) output = output.toLowerCase();
  if (uppercase) output = output.toUpperCase();
  if (pattern && !pattern.test(output)) throw makeError(field, `${field} has invalid characters`);
  return output;
};

const sanitizeOptionalString = (value, options = {}) => {
  if (value === undefined || value === null || value === '') return null;
  return sanitizeString(String(value), { allowEmpty: false, ...options });
};

const sanitizeName = (value, field = 'name', { min = 2, max = 50 } = {}) => {
  const cleaned = sanitizeString(String(value), {
    field,
    min,
    max,
    pattern: /^[A-Za-z0-9 _.'-]+$/,
  });
  return cleaned.replace(/\s+/g, ' ');
};

const sanitizeUsername = (value) => {
  const cleaned = sanitizeString(String(value), {
    field: 'username',
    min: 2,
    max: 30,
    pattern: /^[A-Za-z0-9_-]+$/,
  });
  return cleaned;
};

const sanitizeEmail = (value) => {
  const cleaned = sanitizeString(String(value), {
    field: 'email',
    min: 5,
    max: 100,
    lowercase: true,
  });
  if (!EMAIL_RE.test(cleaned)) throw makeError('email', 'email is invalid');
  return cleaned;
};

const sanitizePassword = (value) => {
  if (typeof value !== 'string') throw makeError('password', 'password must be a string');
  if (value.length < 6) throw makeError('password', 'password is too short');
  if (value.length > 128) throw makeError('password', 'password is too long');
  return value;
};

const sanitizeGender = (value) => {
  const gender = sanitizeString(String(value || 'other'), {
    field: 'gender',
    min: 1,
    max: 10,
    lowercase: true,
    pattern: /^(female|male|other)$/,
  });
  return gender;
};

const sanitizeAge = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const age = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(age) || age < 13 || age > 120) {
    throw makeError('age', 'age is invalid');
  }
  return age;
};

const sanitizeUuid = (value, field = 'id') => {
  const cleaned = sanitizeString(String(value), {
    field,
    min: 36,
    max: 36,
  });
  if (!UUID_RE.test(cleaned)) throw makeError(field, `${field} is invalid`);
  return cleaned.toLowerCase();
};

const sanitizeUserId = (value, field = 'userId', { allowGuest = false } = {}) => {
  const cleaned = sanitizeString(String(value), {
    field,
    min: 1,
    max: 64,
    pattern: /^[A-Za-z0-9_-]+$/,
  });
  if (UUID_RE.test(cleaned)) return cleaned.toLowerCase();
  if (allowGuest && GUEST_ID_RE.test(cleaned)) return cleaned;
  throw makeError(field, `${field} is invalid`);
};

const sanitizeInviteCode = (value) => {
  const cleaned = sanitizeString(String(value), {
    field: 'invite code',
    min: 4,
    max: 16,
    uppercase: true,
    pattern: /^[A-Z0-9]+$/,
  });
  return cleaned;
};

const sanitizeBoolean = (value, field = 'value') => {
  if (typeof value === 'boolean') return value;
  throw makeError(field, `${field} must be true or false`);
};

const sanitizeIdsQuery = (value, { maxItems = 50 } = {}) => {
  if (value === undefined || value === null || value === '') return [];
  const parts = String(value).split(',').map(v => v.trim()).filter(Boolean);
  if (!parts.length) return [];
  if (parts.length > maxItems) throw makeError('ids', 'Too many ids requested');
  return parts.map(id => sanitizeUuid(id, 'ids'));
};

const sanitizeText = (value, {
  field = 'text',
  min = 1,
  max = 2000,
  allowNewlines = true,
} = {}) => {
  const cleaned = sanitizeString(String(value), {
    field,
    min,
    max,
    preserveNewlines: allowNewlines,
    pattern: allowNewlines ? null : /^[\s\S]*$/,
  });
  return allowNewlines ? cleaned : cleaned.replace(/\s+/g, ' ');
};

const sanitizeFileName = (value) => {
  const cleaned = sanitizeString(String(value), {
    field: 'fileName',
    min: 1,
    max: 255,
    pattern: /^[A-Za-z0-9 _.,()\-\[\]]+$/,
  });
  return cleaned;
};

const sanitizeUrl = (value, {
  field = 'url',
  max = 2048,
  allowedHosts = null,
  allowHttp = false,
} = {}) => {
  const cleaned = sanitizeString(String(value), { field, min: 1, max });
  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw makeError(field, `${field} is invalid`);
  }
  if (!allowHttp && parsed.protocol !== 'https:') throw makeError(field, `${field} must use https`);
  if (allowedHosts && !allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    throw makeError(field, `${field} host is not allowed`);
  }
  return parsed.toString();
};

const ensureSizeUnder = (value, field, maxBytes) => {
  const size = Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  if (size > maxBytes) throw makeError(field, `${field} is too large`);
  return value;
};

const handleValidationError = (res, err) => {
  if (!err || !err.isValidationError) return false;
  const status = err.status || 400;
  return res.status(status).json({ error: err.message || 'Invalid input', field: err.field || null });
};

module.exports = {
  assertPlainObject,
  ensureSizeUnder,
  handleValidationError,
  sanitizeAge,
  sanitizeBoolean,
  sanitizeEmail,
  sanitizeFileName,
  sanitizeGender,
  sanitizeIdsQuery,
  sanitizeInviteCode,
  sanitizeName,
  sanitizeOptionalString,
  sanitizePassword,
  sanitizeString,
  sanitizeText,
  sanitizeUrl,
  sanitizeUserId,
  sanitizeUsername,
  sanitizeUuid,
};
