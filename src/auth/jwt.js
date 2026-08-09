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
        expiresIn: '300m',
        issuer: 'folks',
        audience: 'folks-ui'
    };

    static verifyOptions = {
        algorithms: ['RS256'],
        issuer: 'folks',
        audience: 'folks-ui'
    };
    
    static sign(payload, ttl) {
        try {
            const opts = {...JwtUtil.signOptions};

            if (ttl) {
                opts.expiresIn = ttl;
            }
            let token = jwt.sign(payload, keystore.getPrivateKey(), opts);
            
            if (log.isDebugEnabled()) {
                log.debug(`Generate and signed jwt token: ${token}`);
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
