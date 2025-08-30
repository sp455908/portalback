const express = require('express');
const router = express.Router();
const captchaController = require('../controllers/captcha.controller');

// Get captcha ID and image URL
router.get('/id', captchaController.getCaptchaId);

// Generate captcha image
router.get('/image/:captchaId', captchaController.generateCaptcha);

// Verify captcha answer
router.post('/verify', captchaController.verifyCaptcha);

module.exports = router; 