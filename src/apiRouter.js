/* =========================================================================
   apiRouter.js
   Every /api/* request is dispatched from here. No framework — plain
   method + pathname matching, with a small helper to read a JSON request
   body and another to send a JSON response.
   ========================================================================= */

const otpController = require('./controllers/otpController');
const usersController = require('./controllers/usersController');
const addressesController = require('./controllers/addressesController');
const bookingsController = require('./controllers/bookingsController');
const professionalsController = require('./controllers/professionalsController');
const categoriesController = require('./controllers/categoriesController');
const { getAuthenticatedUser } = require('./auth/session');
const { serializeCookie } = require('./utils/cookies');

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB is plenty for this app's payloads

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooLarge = false;

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return reject(new Error('Request body too large'));
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve({}); // malformed JSON -> treat as empty body rather than 500
      }
    });
    req.on('error', reject);
  });
}

/**
 * Sends a JSON response. If `payload` carries a `_cookie` field (set by a
 * controller that wants to establish/refresh a session — see
 * otpController.verifyOtp / usersController.createUser), that's turned into
 * a real Set-Cookie header and stripped out before the body is sent, so it
 * never leaks into the JSON the client sees.
 */
function sendJson(res, statusCode, payload) {
  if (payload && payload._cookie) {
    const { name, value, options } = payload._cookie;
    res.setHeader('Set-Cookie', serializeCookie(name, value, options));
    delete payload._cookie;
  }

  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Maps a controller's failure message to the right HTTP status code. */
function authFailureStatus(message) {
  if (message && /must be logged in/i.test(message)) return 401;
  if (message && /not authorized/i.test(message)) return 403;
  return 404;
}

async function handleApiRequest(req, res, parsedUrl) {
  const { pathname } = parsedUrl;
  const method = req.method;

  try {
    // ---- OTP ----------------------------------------------------------
    if (pathname === '/api/v1/otp' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await otpController.requestOtp(body));
    }
    if (pathname === '/api/v1/otp/verify' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await otpController.verifyOtp(body));
    }

    // ---- Users ----------------------------------------------------------
    if (pathname === '/api/v1/users' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 201, await usersController.createUser(body));
    }
    if (pathname === '/api/v1/users' && method === 'PUT') {
      const body = await readJsonBody(req);
      const result = await usersController.updateUser(body);
      return sendJson(res, result.success ? 200 : 404, result);
    }

    // ---- Addresses --------------------------------------------------------
    if (pathname === '/api/v1/addresses' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 201, await addressesController.createAddress(body));
    }
    if (pathname === '/api/v1/addresses' && method === 'PUT') {
      const body = await readJsonBody(req);
      const result = await addressesController.updateAddress(body);
      return sendJson(res, result.success ? 200 : 404, result);
    }

    // ---- Bookings -----------------------------------------------------------
    // The customer is never taken from the request body here — it's derived
    // from the verified JWT cookie (getAuthenticatedUser) and handed to the
    // controller as `authUser`. The UI only ever sends service/payment data.
    if (pathname === '/api/v1/bookings' && method === 'POST') {
      const body = await readJsonBody(req);
      const authUser = getAuthenticatedUser(req);
      const result = await bookingsController.createBooking(body, authUser);
      return sendJson(res, result.success ? 201 : authFailureStatus(result.message), result);
    }
    if (pathname === '/api/v1/bookings' && method === 'GET') {
      const authUser = getAuthenticatedUser(req);
      const result = await bookingsController.getBookings(authUser);
      return sendJson(res, result.success ? 200 : authFailureStatus(result.message), result);
    }
    const cancelMatch = pathname.match(/^\/api\/v1\/bookings\/([^/]+)$/);
    if (cancelMatch && method === 'PUT') {
      const bookingId = decodeURIComponent(cancelMatch[1]);
      const authUser = getAuthenticatedUser(req);
      const result = await bookingsController.cancelBooking(bookingId, authUser);
      return sendJson(res, result.success ? 200 : authFailureStatus(result.message), result);
    }

    // ---- Professionals ----------------------------------------------------
    if (pathname === '/api/v1/professionals' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 201, await professionalsController.applyAsProfessional(body));
    }

    // ---- Categories (bonus, read-only) -------------------------------------
    if (pathname === '/api/v1/categories' && method === 'GET') {
      return sendJson(res, 200, await categoriesController.getCategories());
    }

    sendJson(res, 404, { success: false, message: `No route for ${method} ${pathname}` });
  } catch (err) {
    console.error('[Folks API] Unhandled error:', err);
    sendJson(res, 500, { success: false, message: 'Internal server error.' });
  }
}

module.exports = { handleApiRequest };
