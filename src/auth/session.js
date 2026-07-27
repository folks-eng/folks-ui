/* =========================================================================
   session.js
   The single place that answers "who is making this request?". Reads the
   folks_token cookie, verifies its signature against the keystore's
   public key, and returns the decoded claims (userId, mobile, name) — or
   null if there's no valid session. Controllers never touch the cookie or
   JWT directly; they just receive this already-verified result.
   ========================================================================= */

const { verifyJwt } = require('./jwt');
const { getPublicKeyPem } = require('./keystore');
const { parseCookies } = require('../utils/cookies');

const COOKIE_NAME = 'folks_token';

/**
 * @param {import('http').IncomingMessage} req
 * @returns {{ userId: string|null, mobile: string, name: string } | null}
 */
function getAuthenticatedUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const payload = verifyJwt(token, getPublicKeyPem());
  if (!payload) return null;

  return payload;
}

module.exports = { getAuthenticatedUser, COOKIE_NAME };
