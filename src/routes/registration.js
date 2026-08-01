const express = require('express');
const JwtUtil = require('./../auth/jwt');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

function register(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    // While calling the backend service to create/register a user, the following payload will be sent.
    //
    // {
    //      "fullName" : "Sudiptasish Chanda",
    //      "email"    : "sudiptasish@javalabs.org",
    //      "phone1"   : "9928763545"
    // }
    //
    // Rest of the attributes will be populated by backend server.
    let uri = '/users';
    let config = {
        headers: {
            'Authorization': 'Bearer ' + req.token
        }
    };

    httpClient.post(req
        , res
        , uri
        , payload
        , config
        , response => {

            // Generate the auth token.
            // Node sends another cookie with the same name (i.e., _fks), same path, and same domain, 
            // and as a result, the browser automatically replaces the old one.
            const payload = {
                sub: response.data.externalId,
                mob: response.data.phone1,
                name: response.data.fullName,
                email: response.data.email
            };
            let token = JwtUtil.sign(payload);

            res.status(response.status)
                .set('Accept', 'application/json')
                .cookie('_fks', token, {
                    maxAge: 18000000,           // Expires in 5 hours (in milliseconds)
                    httpOnly: true,             // Protects against XSS attacks (not accessible via client JS)
                    secure: true,               // Only sent over HTTPS
                    sameSite: 'lax'             // Mitigates CSRF attacks
                })
                .send(response.data);
        });
}

route.post('/', register);

module.exports = route;
