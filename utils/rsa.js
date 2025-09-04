const crypto = require('crypto');

// RSA key management: prefer env, otherwise generate at runtime
let cachedKeys = null;

function getOrCreateKeys() {
  if (cachedKeys) return cachedKeys;

  const envPrivate = process.env.RSA_PRIVATE_KEY;
  const envPublic = process.env.RSA_PUBLIC_KEY;

  if (envPrivate && envPublic) {
    cachedKeys = {
      publicKeyPem: envPublic.replace(/\\n/g, '\n'),
      privateKeyPem: envPrivate.replace(/\\n/g, '\n')
    };
    return cachedKeys;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  cachedKeys = { publicKeyPem: publicKey, privateKeyPem: privateKey };
  return cachedKeys;
}

function getPublicKey() {
  return getOrCreateKeys().publicKeyPem;
}

function getPrivateKey() {
  return getOrCreateKeys().privateKeyPem;
}

function decryptBase64RsaOaepSha256(base64Ciphertext) {
  const privateKeyPem = getPrivateKey();
  const buffer = Buffer.from(base64Ciphertext, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    buffer
  );
  return decrypted.toString('utf8');
}

function decryptBase64RsaOaepSha256ToBuffer(base64Ciphertext) {
  const privateKeyPem = getPrivateKey();
  const buffer = Buffer.from(base64Ciphertext, 'base64');
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    buffer
  );
}

module.exports = {
  getPublicKey,
  getPrivateKey,
  decryptBase64RsaOaepSha256,
  decryptBase64RsaOaepSha256ToBuffer,
};

