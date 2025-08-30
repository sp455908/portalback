const crypto = require('crypto');

// Store captcha solutions in memory (in production, use Redis)
const captchaStore = new Map();

// Generate a random string for captcha
const generateCaptchaText = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Get captcha data for frontend rendering
exports.generateCaptcha = async (req, res) => {
  try {
    const { captchaId } = req.params;
    
    // Get the stored captcha data
    const captchaData = captchaStore.get(captchaId);
    
    if (!captchaData) {
      return res.status(404).json({
        status: 'error',
        message: 'Captcha not found or expired'
      });
    }

    // Check if captcha is expired (10 minutes)
    if (Date.now() - captchaData.timestamp > 10 * 60 * 1000) {
      captchaStore.delete(captchaId);
      return res.status(404).json({
        status: 'error',
        message: 'Captcha expired'
      });
    }

    // Return captcha data for frontend rendering
    res.status(200).json({
      status: 'success',
      data: {
        text: captchaData.text,
        timestamp: captchaData.timestamp
      }
    });
  } catch (error) {
    console.error('Error getting captcha data:', error);
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

    // Check if captcha is expired (10 minutes)
    if (Date.now() - captchaData.timestamp > 10 * 60 * 1000) {
      captchaStore.delete(captchaId);
      return res.status(400).json({
        status: 'fail',
        message: 'Captcha expired'
      });
    }

    // Verify answer (case-insensitive)
    const isValid = answer.toUpperCase() === captchaData.text;
    
    // Remove the captcha after verification
    captchaStore.delete(captchaId);

    if (isValid) {
      res.status(200).json({
        status: 'success',
        message: 'Captcha verified successfully'
      });
    } else {
      res.status(400).json({
        status: 'fail',
        message: 'Incorrect captcha answer'
      });
    }
  } catch (error) {
    console.error('Error verifying captcha:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify captcha'
    });
  }
};

// Get captcha ID (for frontend to use)
exports.getCaptchaId = async (req, res) => {
  try {
    const captchaId = crypto.randomBytes(16).toString('hex');
    const captchaText = generateCaptchaText(6);
    
    // Store the solution
    captchaStore.set(captchaId, {
      text: captchaText,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      data: {
        captchaId,
        text: captchaText // Send text for frontend rendering
      }
    });
  } catch (error) {
    console.error('Error getting captcha ID:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get captcha'
    });
  }
}; 