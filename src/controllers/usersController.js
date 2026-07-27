/* =========================================================================
   usersController.js
   Handles POST /api/v1/users (registration) and PUT /api/v1/users
   (profile edits). Backed by src/data/users/users.json.

   createUser also reissues the session cookie: at OTP-verify time a brand
   new signup's token only had a mobile number (no account existed yet to
   look up a name from). Now that the account is created, the cookie is
   replaced with one carrying the real userId + name.
   ========================================================================= */

const path = require('path');
const { readJSON, writeJSON } = require('../utils/jsonStore');
const { signJwt } = require('../auth/jwt');
const { getPrivateKeyPem } = require('../auth/keystore');
const { COOKIE_NAME } = require('../auth/session');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users', 'users.json');
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function createUser(body) {
  const { mobile, name, email } = body || {};
  const users = await readJSON(USERS_FILE, []);

  const user = {
    id: `usr-${Date.now()}`,
    name: name || '',
    email: email || '',
    mobile: mobile || '',
    secondaryPhone: '',
    role: 'Customer',
    status: 'Active',
    createdOn: new Date().toISOString(),
  };

  users.push(user);
  await writeJSON(USERS_FILE, users);

  const token = signJwt(
    { userId: user.id, mobile: user.mobile, name: user.name },
    getPrivateKeyPem(),
    { expiresInSeconds: SESSION_MAX_AGE_SECONDS }
  );

  return {
    success: true,
    user,
    _cookie: {
      name: COOKIE_NAME,
      value: token,
      options: { httpOnly: true, maxAgeSeconds: SESSION_MAX_AGE_SECONDS },
    },
  };
}

async function updateUser(body) {
  const payload = body || {};
  const users = await readJSON(USERS_FILE, []);
  const idx = users.findIndex(u => u.id === payload.id);

  if (idx === -1) {
    return { success: false, message: 'User not found.' };
  }

  users[idx] = { ...users[idx], ...payload };
  await writeJSON(USERS_FILE, users);

  return { success: true, user: users[idx] };
}

module.exports = { createUser, updateUser };
