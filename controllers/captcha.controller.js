const crypto = require('crypto');


const captchaStore = new Map();
const ipAttempts = new Map();


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


const renderSvg = (text) => {
  const width = 150;
  const height = 50;
  const noiseLines = 6;
  const chars = text.split('');
  const charSpacing = Math.floor((width - 20) / chars.length);
  const items = [];
  
  items.push(`<rect width="100%" height="100%" fill="#f3f4f6"/>`);
  
  for (let i = 0; i < noiseLines; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = `#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')}`;
    items.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.4"/>`);
  }
  
  chars.forEach((c, idx) => {
    const x = 10 + idx * charSpacing + Math.random() * 4;
    const y = 30 + Math.random() * 10;
    const rotate = (Math.random() * 30 - 15).toFixed(1);
    items.push(`<text x="${x}" y="${y}" fill="#111827" font-size="24" font-family="monospace" transform="rotate(${rotate} ${x} ${y})">${c}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${items.join('')}</svg>`;
};


exports.generateCaptcha = async (req, res) => {
  try {
    const { captchaId } = req.params;
    
    
    const captchaData = captchaStore.get(captchaId);
    
    if (!captchaData) {
      return res.status(404).json({ status: 'error', message: 'Captcha not found or expired' });
    }

    
    if (Date.now() - captchaData.timestamp > 5 * 60 * 1000) {
      captchaStore.delete(captchaId);
      return res.status(404).json({ status: 'error', message: 'Captcha expired' });
    }

    const svg = renderSvg(captchaData.plainText);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      
      console.error('Error getting captcha data:', error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to get captcha data'
    });
  }
};


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

    
    if (Date.now() - captchaData.timestamp > 5 * 60 * 1000) {
      captchaStore.delete(captchaId);
      return res.status(400).json({
        status: 'fail',
        message: 'Captcha expired'
      });
    }

    
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const attempts = ipAttempts.get(ip) || { count: 0, ts: Date.now() };
    if (Date.now() - attempts.ts > 15 * 60 * 1000) { 
      attempts.count = 0; attempts.ts = Date.now();
    }

    
    const isValid = hashAnswer(answer) === captchaData.hash;
    
    
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
      
      console.error('Error verifying captcha:', error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify captcha'
    });
  }
};


exports.getCaptchaId = async (req, res) => {
  try {
    
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
    
    
    captchaStore.set(captchaId, {
      hash: hashAnswer(captchaText),
      timestamp: Date.now(),
      ip,
      
      plainText: captchaText
    });

    
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
      
      console.error('Error getting captcha ID:', error);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to get captcha'
    });
  }
}; 