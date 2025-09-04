# Transport Encryption for Sensitive Forms

This backend supports end-to-end transport encryption for login, register, and application submission using RSA-OAEP (SHA-256).

- Public key endpoint: `GET /api/security/public-key`
- Encrypted request format:
```json
{
  "encrypted": true,
  "payload": "<base64-RSA-encrypted-JSON>"
}
```

Encrypted routes:
- `POST /api/auth/login`
- `POST /api/auth/register` (alias: `/api/auth/user-auth/register`)
- `POST /api/application`

On the server, requests with `encrypted: true` are decrypted before controller logic runs.

## Client-side usage (browser)

1) Fetch public key
```ts
const res = await fetch(`${API_BASE}/api/security/public-key`);
const { key } = await res.json(); // PEM string
```

2) Import the PEM key and encrypt payload with RSA-OAEP-SHA-256
```ts
async function importRsaPublicKey(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

async function encryptPayload(publicKeyPem, data) {
  const key = await importRsaPublicKey(publicKeyPem);
  const enc = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, enc);
  return btoa(String.fromCharCode(...new Uint8Array(ct)));
}
```

3) Send encrypted body
```ts
const publicKeyPem = (await (await fetch(`${API_BASE}/api/security/public-key`)).json()).key;
const payloadB64 = await encryptPayload(publicKeyPem, { email, password });
await fetch(`${API_BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ encrypted: true, payload: payloadB64 })
});
```

Apply the same flow for register and application (admission) forms.

## Notes
- HTTPS must be enabled end-to-end.
- Passwords are still hashed at rest; PII fields (phone, address, pincode, motivation) are encrypted at rest.
- If you set `RSA_PUBLIC_KEY` and `RSA_PRIVATE_KEY` in env, the server will use those; otherwise keys are generated at runtime.