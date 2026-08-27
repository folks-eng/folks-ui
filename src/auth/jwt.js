/* =========================================================================
 jwt.js
 A minimal, dependency-free JWT implementation — just enough to sign and
 verify RS256 tokens using the keystore's private/public key. Not a
 general-purpose JWT library (no other algorithms, no JWK support), only
 what this project needs.
 
 Token shape is standard: base64url(header) + "." + base64url(payload)
 + "." + base64url(signature), signed over the first two segments.
 ========================================================================= */

const jwt = require('jsonwebtoken');
const fs = require('fs');

const {getLogger} = require('./../util/logger');
const keystore = require('./keystore');

const log = getLogger(__filename);

class JwtUtil {
    
    static signOptions = {
        algorithm: 'RS256',
        expiresIn: (process.env.TOKEN_TTL_MIN || '600') + 'm',
        issuer: process.env.TOKEN_ISSUER || 'folks',
        audience: process.env.TOKEN_AUDIENCE || 'folks-ui'
    };

    static verifyOptions = {
        algorithms: ['RS256'],
        issuer: process.env.TOKEN_ISSUER || 'folks',
        audience: process.env.TOKEN_AUDIENCE || 'folks-ui'
    };
    
    static otpToken(input, jti) {
        // If everything is successful, generate a jwt token with mobile number as id,
        // and set it as a cookie.
        // In subsequent verify call, this token will be sent back.
        // If the token is not present, then verify call will be rejected.

        // Generate the temporary sign-up token.
        // jti is the JWT ID. It is one of the registered claims defined in RFC 7519.
        // Its purpose is to provide a unique identifier for a JWT.
        
        const payload = {
            sub: input,
            jti: jti
        };
        let ttlMin = (process.env.OTP_EXP_MIN || 5) + 'm';
        let token = JwtUtil.sign(payload, ttlMin);
        
        if (log.isDebugEnabled()) {
            log.debug('Created otp token for %s. TTL: %s', input, ttlMin);
        }
        return {token, ttlMin};
    }
    
    static loginToken(id, name) {
        // Post user creation, generate the auth token.
        // Node sends another cookie with the same name (i.e., _fks), same path, and same domain, 
        // and as a result, the browser automatically replaces the old one.
        const claims = {
            sub: id,
            name: name,
            jti: crypto.randomUUID()
        };
        let ttlMin = (process.env.TOKEN_TTL_MIN || 600) + 'm';
        let token = JwtUtil.sign(claims, ttlMin);
        
        if (log.isDebugEnabled()) {
            log.debug('Created jwt auth token for user %s. TTL: %s', id, ttlMin);
        }
        return {token, ttlMin};
    }
    
    static sign(claims, ttl) {
        try {
            const opts = {...JwtUtil.signOptions};

            if (ttl) {
                opts.expiresIn = ttl;
            }
            let token = jwt.sign(claims, keystore.getPrivateKey(), opts);
            
            if (log.isDebugEnabled()) {
                log.debug('Generated and signed jwt token from claims: ' + JSON.stringify(claims));
            }
            return token;
        }
        catch (err) {
            log.error('JWT token signing failed. Error: %s', err.message);
            throw err;
        }
    }

    static validate(token) {
        try {
            const decoded = jwt.verify(token, keystore.getPublicKey(), JwtUtil.verifyOptions);
            
            if (log.isDebugEnabled()) {
                log.debug(`Verified jwt token ${token}`);
            }
            return decoded;
        }
        catch (err) {
            log.error('JWT verification failed. Error: %s', err.message);
            return null;
        }
    }
    
    static getExpiryInMs(jwt) {
        try {
            const parts = jwt.split('.');
            if (parts.length !== 3) {
                return 0;
            }
            const payload = JSON.parse(base64UrlDecode(parts[1]));
            
            if (! payload.exp) {
                return 0;
            }
            return payload.exp * 1000;
        }
        catch {
            return 0;
        }
    }
}

module.exports = JwtUtil;
