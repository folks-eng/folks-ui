/* =========================================================================
   otpController.js
   Handles POST /api/v1/otp and POST /api/v1/otp/verify.

   OTPs are intentionally kept in an in-memory Map, not a JSON file: they're
   short-lived, single-use secrets, not "data" in the sense the rest of this
   project persists it. Restarting the server invalidates any OTP in
   flight, which is the correct behaviour for a real OTP system too.

   On successful verification, this issues a JWT (signed with the private
   key from keystore/server.pkcs) carrying the mobile number and — if this
   mobile already belongs to a registered user — their name and id too.
   The token is returned as an httpOnly cookie via the `_cookie` field,
   which apiRouter.js turns into a real Set-Cookie header.
   ========================================================================= */

const path = require('path');
const { readJSON } = require('../utils/jsonStore');
const { signJwt } = require('../auth/jwt');
const { getPrivateKeyPem } = require('../auth/keystore');
const { COOKIE_NAME } = require('../auth/session');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users', 'users.json');
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const _otpByMobile = new Map();

async function requestOtp(body) {
  const mobile = body && body.mobile;
  if (!mobile) {
    return { success: false, message: 'Mobile number is required.' };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  _otpByMobile.set(mobile, otp);

  // There's no real SMS gateway wired up here, so the OTP is logged server
  // side and also returned as `demoOtp` — exactly like the frontend's own
  // demo-mode fallback did, so behaviour is unchanged end to end.
  console.log(`[Folks API] OTP for ${mobile}: ${otp}`);

  return { success: true, message: 'OTP sent', demoOtp: otp };
}

async function verifyOtp(body) {
  const mobile = body && body.mobile;
  const otp = body && body.otp;

  const expected = _otpByMobile.get(mobile);
  if (!(expected && expected === otp)) {
    return { success: false, message: 'Incorrect OTP. Please try again.' };
  }
  _otpByMobile.delete(mobile); // one-time use

  // A returning user (existing account with this mobile) gets a token that
  // already carries their real name and id — this is effectively the login
  // case. A brand-new number gets a token with just the mobile number;
  // usersController.createUser reissues it with the full identity once
  // signup completes.
  const users = await readJSON(USERS_FILE, []);
  const existingUser = users.find((u) => u.mobile === mobile);

  const token = signJwt(
    {
      userId: existingUser ? existingUser.id : null,
      mobile,
      name: existingUser ? existingUser.name : '',
    },
    getPrivateKeyPem(),
    { expiresInSeconds: SESSION_MAX_AGE_SECONDS }
  );

  return {
    success: true,
    message: 'OTP verified',
    token, // kept in the body too, for parity with the existing frontend contract
    _cookie: {
      name: COOKIE_NAME,
      value: token,
      options: { httpOnly: true, maxAgeSeconds: SESSION_MAX_AGE_SECONDS },
    },
  };
}

module.exports = { requestOtp, verifyOtp };
