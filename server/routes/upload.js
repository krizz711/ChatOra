const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Upload file/image in chat
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
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
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    let target;
    try {
      target = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const host = target.hostname;
    const isCloudinary = host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com');
    if (target.protocol !== 'https:' || !isCloudinary) {
      return res.status(403).json({ error: 'Only Cloudinary URLs allowed' });
    }

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
    return res.status(500).json({ error: err.message || 'File proxy failed' });
  }
});

module.exports = router;
