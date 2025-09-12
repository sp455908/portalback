const crypto = require('crypto');

// Store captcha states in memory (prefer Redis in production)
const captchaStore = new Map();
const ipAttempts = new Map();

// Generate a random string for captcha
const generateCaptchaText = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const hashAnswer = (text) =>
  crypto.createHash('sha256').update(String(text).toUpperCase()).digest('hex');

// Very simple SVG rendering of the captcha text (no plaintext API exposure)
const renderSvg = (text) => {
  const width = 150;
  const height = 50;
  const noiseLines = 6;
  const chars = text.split('');
  const charSpacing = Math.floor((width - 20) / chars.length);
  const items = [];
  // Background
  items.push(`<rect width="100%" height="100%" fill="#f3f4f6"/>`);
  // Noise lines
  for (let i = 0; i < noiseLines; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = `#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')}`;
    items.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.4"/>`);
  }
  // Characters with random jitter/rotation
  chars.forEach((c, idx) => {
    const x = 10 + idx * charSpacing + Math.random() * 4;
    const y = 30 + Math.random() * 10;
    const rotate = (Math.random() * 30 - 15).toFixed(1);
    items.push(`<text x="${x}" y="${y}" fill="#111827" font-size="24" font-family="monospace" transform="rotate(${rotate} ${x} ${y})">${c}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${items.join('')}</svg>`;
};

// Generate captcha image as SVG by id
exports.generateCaptcha = async (req, res) => {
  try {
    const { captchaId } = req.params;
    
    // Get the stored captcha data
    const captchaData = captchaStore.get(captchaId);
    
    if (!captchaData) {
      return res.status(404).json({ status: 'error', message: 'Captcha not found or expired' });
    }

    // Check if captcha is expired (5 minutes)
    if (Date.now() - captchaData.timestamp > 5 * 60 * 1000) {
      captchaStore.delete(captchaId);
      return res.status(404).json({ status: 'error', message: 'Captcha expired' });
    }

    const svg = renderSvg(captchaData.plainText);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Error getting captcha data:', error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to get captcha data'
    });
  }
};

// Verify captcha
exports.verifyCaptcha = async (req, res) => {
  try {
    const { captchaId, answer } = req.body;

    if (!captchaId || !answer) {
      return res.status(400).json({
        status: 'fail',
        message: 'Captcha ID and answer are required'
      });
    }

    const captchaData = captchaStore.get(captchaId);
    
    if (!captchaData) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired captcha'
      });
    }

    // Check if captcha is expired (5 minutes)
    if (Date.now() - captchaData.timestamp > 5 * 60 * 1000) {
      captchaStore.delete(captchaId);
      return res.status(400).json({
        status: 'fail',
        message: 'Captcha expired'
      });
    }

    // Basic per-IP rate limit for wrong attempts
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const attempts = ipAttempts.get(ip) || { count: 0, ts: Date.now() };
    if (Date.now() - attempts.ts > 15 * 60 * 1000) { // reset window 15m
      attempts.count = 0; attempts.ts = Date.now();
    }

    // Verify by hash (case-insensitive)
    const isValid = hashAnswer(answer) === captchaData.hash;
    
    // Remove the captcha after verification
    captchaStore.delete(captchaId);

    if (isValid) {
      ipAttempts.set(ip, { count: 0, ts: Date.now() });
      res.status(200).json({
        status: 'success',
        message: 'Captcha verified successfully'
      });
    } else {
      attempts.count += 1; ipAttempts.set(ip, attempts);
      if (attempts.count > 10) {
        return res.status(429).json({ status: 'fail', message: 'Too many attempts. Please try again later.' });
      }
      res.status(400).json({
        status: 'fail',
        message: 'Incorrect captcha answer'
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Error verifying captcha:', error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify captcha'
    });
  }
};

// ✅ OPTIMIZED: Get captcha ID with faster generation
exports.getCaptchaId = async (req, res) => {
  try {
    // Set response timeout
    res.setTimeout(2000, () => {
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          message: 'Captcha generation timeout'
        });
      }
    });

    const captchaId = crypto.randomBytes(16).toString('hex');
    const captchaText = generateCaptchaText(6);
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Store only hash and metadata; keep plaintext only for SVG rendering in memory (optional)
    captchaStore.set(captchaId, {
      hash: hashAnswer(captchaText),
      timestamp: Date.now(),
      ip,
      // Keeping plaintext short-lived for image rendering convenience
      plainText: captchaText
    });

    // Remove plaintext after 30 seconds to minimize exposure in memory
    setTimeout(() => {
      const entry = captchaStore.get(captchaId);
      if (entry) {
        delete entry.plainText;
        captchaStore.set(captchaId, entry);
      }
    }, 30 * 1000);

    res.status(200).json({
      status: 'success',
      data: {
        captchaId
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Error getting captcha ID:', error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to get captcha'
    });
  }
}; 