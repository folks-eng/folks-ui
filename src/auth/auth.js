const JwtUtil = require('./../auth/jwt');
const {getLogger} = require('./../util/logger');

const basePath = process.env.BASE_PATH;
const log = getLogger(__filename);

function authenticate(req, res, next) {
    if (log.isDebugEnabled()) {
        log.debug(`Authentication middleware invoked. Path: ${req.path}`);
    }
    
    // Allow unauthenticated access to OTP dispatch
    if (req.path === '/signup/otp/request' || req.path === '/login/otp/request') {
        return next();
    }
    let token = req.cookies._fks;
    if (! token) {
        return res.status(401)
                .set('Content-Type', 'application/json')
                .send({message: "Access to this resource is restricted"});
    }
    const payload = JwtUtil.validate(token);

    if (! payload) {
        return res.status(401)
                .set('Content-Type', 'application/json')
                .send({message: "Access to this resource is restricted"});
    }
    if (log.isTraceEnabled()) {
        log.trace('Decrypted jwt token: %s', JSON.stringify(payload));
    }

    // Now assign it as bearer token.
    // Backend service needs the bearer token for auth.
    req.token = token;
    
    next();
}

module.exports = {
    authenticate
};
