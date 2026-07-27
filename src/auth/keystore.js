/* =========================================================================
   keystore.js
   Loads the private key out of the PKCS#12 keystore (keystore/server.pkcs)
   at startup, using the `openssl` CLI (Node's core `crypto` module can't
   parse PKCS#12 directly). The public key used to verify tokens is then
   derived directly from that private key — no separate key file needed.

   This keeps the actual signing key on disk ONLY inside the keystore
   (encrypted with a passphrase), not as a second, unencrypted PEM file
   sitting next to it.
   ========================================================================= */

const { execFileSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const KEYSTORE_PATH = path.join(__dirname, '..', '..', 'keystore', 'server.pkcs');

// A real deployment would supply this via an environment variable / secrets
// manager, never hard-code it. It's inlined here only because this whole
// project intentionally has zero external configuration/secrets tooling.
const KEYSTORE_PASSPHRASE = process.env.FOLKS_KEYSTORE_PASSPHRASE || 'folks-dev-passphrase';

let _cachedPrivateKeyPem = null;
let _cachedPublicKeyPem = null;

function extractPemBlock(opensslOutput, label) {
  const pattern = new RegExp(`-----BEGIN ${label}-----[\\s\\S]+?-----END ${label}-----`);
  const match = opensslOutput.match(pattern);
  if (!match) {
    throw new Error(`Could not find a ${label} block in the keystore's openssl output.`);
  }
  return match[0];
}

/** Extracts and caches the unencrypted private key PEM from server.pkcs. */
function getPrivateKeyPem() {
  if (_cachedPrivateKeyPem) return _cachedPrivateKeyPem;

  let raw;
  try {
    raw = execFileSync('openssl', [
      'pkcs12', '-in', KEYSTORE_PATH, '-nocerts', '-nodes',
      '-passin', `pass:${KEYSTORE_PASSPHRASE}`,
    ], { encoding: 'utf-8' });
  } catch (err) {
    throw new Error(
      `Failed to read the keystore at ${KEYSTORE_PATH}. Is the 'openssl' CLI ` +
      `installed and on PATH, and is FOLKS_KEYSTORE_PASSPHRASE correct? (${err.message})`
    );
  }

  _cachedPrivateKeyPem = extractPemBlock(raw, 'PRIVATE KEY');
  return _cachedPrivateKeyPem;
}

/** Derives and caches the public key PEM from the private key. */
function getPublicKeyPem() {
  if (_cachedPublicKeyPem) return _cachedPublicKeyPem;
  const publicKeyObject = crypto.createPublicKey(getPrivateKeyPem());
  _cachedPublicKeyPem = publicKeyObject.export({ type: 'spki', format: 'pem' });
  return _cachedPublicKeyPem;
}

module.exports = { getPrivateKeyPem, getPublicKeyPem, KEYSTORE_PATH };
