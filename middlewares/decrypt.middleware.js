const { decryptBase64RsaOaepSha256, decryptBase64RsaOaepSha256ToBuffer } = require('../utils/rsa');
const crypto = require('crypto');

// Expect body in shape: { encrypted: true, payload: "base64", iv?: string }
function decryptRequestBody(req, res, next) {
  try {
    if (!req.body || typeof req.body !== 'object') return next();

    if (req.body.encrypted === true) {
      // Hybrid mode: { encrypted: true, alg: 'RSA-OAEP+AES-GCM', key, iv, payload }
      if (req.body.alg === 'RSA-OAEP+AES-GCM' && typeof req.body.key === 'string' && typeof req.body.iv === 'string') {
        // 1) Decrypt AES key using RSA
        const aesKeyRaw = decryptBase64RsaOaepSha256ToBuffer(req.body.key);
        // 2) AES-GCM decrypt payload
        const iv = Buffer.from(req.body.iv, 'base64');
        const ct = Buffer.from(req.body.payload, 'base64');
        
        // ✅ SECURITY FIX: Proper AES-GCM decryption with validation
        if (ct.length < 16) {
          return res.status(400).json({ status: 'fail', message: 'Invalid encrypted payload length' });
        }
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyRaw, iv);
        
        // Extract auth tag from the last 16 bytes
        const tag = ct.slice(ct.length - 16);
        const data = ct.slice(0, ct.length - 16);
        
        try {
          decipher.setAuthTag(tag);
          const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
          req.body = JSON.parse(decrypted);
        } catch (decryptError) {
          return res.status(400).json({ 
            status: 'fail', 
            message: 'Invalid encrypted payload format',
            code: 'DECRYPTION_FAILED'
          });
        }
      } else if (typeof req.body.payload === 'string') {
        // Legacy: RSA-only payload
        const plaintext = decryptBase64RsaOaepSha256(req.body.payload);
        try {
          req.body = JSON.parse(plaintext);
        } catch (_err) {
          return res.status(400).json({ 
            status: 'fail', 
            message: 'Invalid encrypted payload format',
            code: 'DECRYPTION_FAILED'
          });
        }
      }
    }
    return next();
  } catch (error) {
    return res.status(400).json({ status: 'fail', message: 'Failed to decrypt request body' });
  }
}

module.exports = { decryptRequestBody };

