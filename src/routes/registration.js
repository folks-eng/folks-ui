const express = require('express');
const JwtUtil = require('./../auth/jwt');
const tokenMgr = require('./../auth/token_mgr');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

async function register(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        // Obtain the scope based short-lived token.
        // This call will get it from cache. If not token is present in cache, make call to token service end point.
        const mtls_jwt = await tokenMgr.getToken('user:create');
        if (log.isDebugEnabled()) {
            log.debug('Scope token is available. Proceed for user creation ...');
        }
        
        // Now make the original call to persist user details.
        // While calling the backend service to create/register a user, the following payload will be sent.
        //
        // {
        //      "fullName" : "Sudiptasish Chanda",
        //      "email"    : "sudiptasish@javalabs.org",
        //      "phone1"   : "9928763545"
        // }
        //
        // Rest of the attributes will be populated by backend server.
        const response = await httpClient.post(
            '/users'
            , payload
            , {
                headers: {
                    Authorization: `Bearer ${mtls_jwt}`
                }
            }
        );

        // Post user creation, generate the auth token.
        // Node sends another cookie with the same name (i.e., _fks), same path, and same domain, 
        // and as a result, the browser automatically replaces the old one.
        const claims = {
            sub: response.data.externalId,
            mob: response.data.phone1,
            name: response.data.fullName,
            email: response.data.email
        };
        let userToken = JwtUtil.sign(claims);
        let ttlMin = process.env.CLIENT_TOKEN_TTL_MIN;

        res.status(response.status)
            .cookie('_fks', userToken, {
                maxAge: ttlMin * 60 * 1000, // Expires in 10 hours (in milliseconds)
                httpOnly: true,             // Protects against XSS attacks (not accessible via client JS)
                secure: true,               // Only sent over HTTPS
                sameSite: 'lax'             // Mitigates CSRF attacks
            })
            .send(response.data);
    }
    catch (err) {
        log.error('Error in registration', err);
        // token acquisition failed OR user insert failed (Received invalid response from backend server).
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }
        return res.status(503).json({
            message: 'Service temporarily unavailable'
        });
    }
}

route.post('/', register);

module.exports = route;
