const { decryptBase64RsaOaepSha256 } = require('../utils/rsa');

// Expect body in shape: { encrypted: true, payload: "base64", iv?: string }
function decryptRequestBody(req, res, next) {
  try {
    if (!req.body || typeof req.body !== 'object') return next();

    if (req.body && req.body.encrypted === true && typeof req.body.payload === 'string') {
      const plaintext = decryptBase64RsaOaepSha256(req.body.payload);
      let parsed;
      try {
        parsed = JSON.parse(plaintext);
      } catch (_err) {
        return res.status(400).json({ status: 'fail', message: 'Invalid encrypted payload format' });
      }
      req.body = parsed;
    }
    return next();
  } catch (error) {
    return res.status(400).json({ status: 'fail', message: 'Failed to decrypt request body' });
  }
}

module.exports = { decryptRequestBody };

