const JwtUtil = require('./../auth/jwt');
const CookieUtil = require('./../util/cookie_util');
const {getLogger} = require('./../util/logger');

const basePath = process.env.BASE_PATH;
const log = getLogger(__filename);

function authenticate(req, res, next) {
    if (log.isDebugEnabled()) {
        log.debug('Authentication middleware invoked. Path: %s', req.path);
    }
    
    // Allow unauthenticated access to OTP dispatch, and to the admin
    // username/password login itself (there's no cookie yet at that point —
    // that's exactly what this call is trying to obtain).
    if (req.path === '/signup/otp/request' || req.path === '/login/otp/request' || req.path === '/login/admin') {
        // Check for existing cookie
        let token = req.cookies[CookieUtil.STD_COOKIE];
        if (token) {
            const payload = JwtUtil.validate(token);
            if (payload) {
                log.error('Cookie already exists for %s as %s. Still trying to login', payload.name, payload.priv);
                return res.status(401)
                        .set('Content-Type', 'application/json')
                        .send({message: 'You are already logged in as ' + payload.priv + '. Log out first !'});
            }
        }
        return next();
    }
    let token = req.cookies[CookieUtil.STD_COOKIE];
    if (! token) {
        log.error('No folks cookie found, or cookie is already expired');
        return res.status(401)
                .set('Content-Type', 'application/json')
                .send({message: 'Cookie expired'});
    }
    const payload = JwtUtil.validate(token);

    if (! payload) {
        log.error('Invalid payload. Denied access');
        return res.status(401)
                .set('Content-Type', 'application/json')
                .send({message: 'Cookie expired'});
    }
    if (log.isTraceEnabled()) {
        log.trace('Decrypted jwt token: %s', JSON.stringify(payload));
    }

    // Now assign it as bearer token.
    // Backend service needs the bearer token for auth.
    req.token = token;

    // Decoded claims, for routes/middleware that need to make their own
    // authorization decisions (e.g. requireAdmin below) without re-validating
    // the token themselves.
    req.user = payload;

    next();
}

/**
 * Route guard for admin-only endpoints (e.g. listing every professional
 * application, every customer, dashboard-wide booking counts). Must run
 * after `authenticate`, which is what populates req.user from the verified
 * _fks token. A non-admin, or a request that somehow reached here without
 * going through `authenticate`, gets a 403.
 */
function requireAdmin(req, res, next) {
    if (! req.user || req.user.priv !== 'admin') {
        log.error('Denied admin-only resource. Path: %s', req.path);
        return res.status(403)
                .set('Content-Type', 'application/json')
                .send({message: 'Admin privileges required'});
    }
    next();
}

module.exports = {
    authenticate,
    requireAdmin
};
