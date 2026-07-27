/* =========================================================================
   jwt.js
   A minimal, dependency-free JWT implementation — just enough to sign and
   verify RS256 tokens using the keystore's private/public key. Not a
   general-purpose JWT library (no other algorithms, no JWK support), only
   what this project needs.

   Token shape is standard: base64url(header) + "." + base64url(payload)
   + "." + base64url(signature), signed over the first two segments.
   ========================================================================= */

const crypto = require('crypto');

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlToBuffer(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(withPadding, 'base64');
}

/**
 * Signs a payload as an RS256 JWT.
 * @param {object} payload - claims to embed (e.g. { userId, mobile, name })
 * @param {string} privateKeyPem
 * @param {{ expiresInSeconds?: number }} [options]
 * @returns {string} the signed JWT
 */
function signJwt(payload, privateKeyPem, options = {}) {
  const { expiresInSeconds = 60 * 60 * 24 * 7 } = options; // 7 days by default

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const headerSegment = base64url(JSON.stringify(header));
  const payloadSegment = base64url(JSON.stringify(fullPayload));
  const signingInput = `${headerSegment}.${payloadSegment}`;

  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKeyPem);
  const signatureSegment = base64url(signature);

  return `${signingInput}.${signatureSegment}`;
}

/**
 * Verifies an RS256 JWT's signature and expiry.
 * @param {string} token
 * @param {string} publicKeyPem
 * @returns {object|null} the decoded payload if valid, otherwise null
 */
function verifyJwt(token, publicKeyPem) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const signingInput = `${headerSegment}.${payloadSegment}`;

  let signatureValid;
  try {
    signatureValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signingInput),
      publicKeyPem,
      base64urlToBuffer(signatureSegment)
    );
  } catch (err) {
    return null; // malformed signature/key -> treat as invalid, don't throw
  }
  if (!signatureValid) return null;

  let payload;
  try {
    payload = JSON.parse(base64urlToBuffer(payloadSegment).toString('utf-8'));
  } catch (err) {
    return null;
  }

  if (typeof payload.exp === 'number' && Math.floor(Date.now() / 1000) > payload.exp) {
    return null; // expired
  }

  return payload;
}

module.exports = { signJwt, verifyJwt };
