const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');
const {
  handleValidationError,
  sanitizeUrl,
} = require('../middleware/validation');

// Strict upload rate limit: 5 uploads per minute per IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many uploads. Please wait before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload file/image in chat
router.post('/', authMiddleware, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    res.json({
      url: req.file.secure_url || req.file.path,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      resourceType: req.file.resource_type || 'auto',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy file fetch for authenticated clients to avoid browser CORS issues on remote asset hosts.
router.get('/fetch', authMiddleware, async (req, res) => {
  try {
    const targetUrl = sanitizeUrl(req.query.url, { field: 'url', max: 2048, allowedHosts: ['res.cloudinary.com', 'cloudinary.com'] });
    const target = new URL(targetUrl);

    const upstream = await fetch(target.toString());
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream fetch failed (${upstream.status})` });
    }

    const contentType = upstream.headers.get('content-type');
    const contentDisposition = upstream.headers.get('content-disposition');
    const contentLength = upstream.headers.get('content-length');

    if (contentType) res.setHeader('Content-Type', contentType);
    const isImage = (contentType || '').startsWith('image/');
    res.setHeader('Content-Disposition', isImage ? 'inline' : 'attachment');
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const body = Buffer.from(await upstream.arrayBuffer());
    return res.send(body);
  } catch (err) {
    return handleValidationError(res, err) || res.status(500).json({ error: err.message || 'File proxy failed' });
  }
});

module.exports = router;
