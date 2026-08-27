const crypto = require('crypto');
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
        const mtls_jwt = await tokenMgr.getToken('user:create|user:query');
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
        if (response.status === 201) {
            let result = response.data;
            
            if (log.isDebugEnabled()) {
                log.debug('Successfully registered new user. Response:\n%s', JSON.stringify(result, null, 2));
            }
            const {token, ttlMin} = JwtUtil.loginToken(result.externalId, result.fullName);

            res.status(response.status)
                .cookie('_fks', token, {
                    maxAge: parseInt(ttlMin, 10) * 60 * 1000,        // Expires (in milliseconds)
                    httpOnly: true,                 // Protects against XSS attacks (not accessible via client JS)
                    secure: true,                   // Only sent over HTTPS
                    sameSite: 'lax',                // Mitigates CSRF attacks
                    path: process.env.BASE_PATH || '/gateway/v1'
                })
                .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to register user. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
        
    }
    catch (err) {
        handleError(req, res, err, 'Error in registering new user');
    }
}

async function modify(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        let userId = req.params.id;
        const response = await httpClient.put(
            '/users/' + userId
            , payload
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully modified user details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to modified user details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying user details');
    }
}

async function view(req, res) {
    try {
        let userId = req.params.id;
        const response = await httpClient.get(
            '/users/' + userId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched user details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch user details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching user details');
    }
}

async function remove(req, res) {
    try {
        let userId = req.params.id;
        const response = await httpClient.delete(
            '/users/' + userId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 204) {
            if (log.isDebugEnabled()) {
                log.debug('Successfully deleted user %s', userId);
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to delete user %s. Status code: %d. Error Msg: %s', userId, response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in deleting user');
    }
}

async function handleError(req, res, err, msg) {
    log.error(msg, err);
    
    // token acquisition failed OR user insert failed (Received invalid response from backend server).
    if (err.response) {
        return res.status(err.response.status).json(err.response.data);
    }
    return res.status(503).json({
        message: 'Service temporarily unavailable'
    });
}

route.post('/', register);
route.put('/:id', modify);
route.get('/:id', view);
route.delete('/:id', remove);

module.exports = route;
