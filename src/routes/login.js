const express = require('express');

const otpHandler = require('./otp');
const tokenMgr = require('./../auth/token_mgr');
const JwtUtil = require('./../auth/jwt');
const httpClient = require('./../util/http_client');
const { getLogger } = require('../util/logger');
const Utility = require('./../util/utility');

const router = express.Router();
const log = getLogger(__filename);

async function requestOtp(req, res) {
    const input = req.body.input;
    const op = req.body.op;
    
    try {
        const ret = await otpHandler.request(op, input);
        
        if (ret.status === 0) {
            // Otp has already been generated and sent
            res.status(200)
                .json({success: true, message: 'Otp has already been sent. Please wait for 5 minute before trying again'});
        }
        else {
            // Otp has just been generated. Therefore generate the token.
            const {token, ttlMin} = JwtUtil.otpToken(ret.otp.input, ret.otp.jti);
            
            res.status(200)
                .set('Accept', 'application/json')
                .cookie('_fks', token, {
                    maxAge: parseInt(ttlMin, 10) * 60 * 1000,
                    httpOnly: true,                 // Protects against XSS attacks (not accessible via client JS)
                    secure: true,                   // Only sent over HTTPS
                    sameSite: 'lax',                // Mitigates CSRF attacks
                    path: process.env.BASE_PATH || '/gateway/v1'
                })
                .send({success: true, message: 'Otp sent successfully'});
        }
    }
    catch (err) {
        res.status(500)
                .json({success: false, message: err.message});
    }
}

async function verifyOtp(req, res) {
    const op = req.body.op;
    const input = req.body.input;
    const type = Utility.getIdentityType(input);
    const otp = Number(req.body.otp);
    
    try {
        const result = await otpHandler.verify(input, otp);
        
        switch (result.state) {
            case 'VERIFIED':
                // Otp has been successfully verified. Next steps:
                // 1. Query the backend server to check if any user is associated with this phone/email
                // 
                // 1a. If found, generate the login token.
                // 1b. If not, send appropriate message to UI so that it can forward the registration screen.
                let response = await queryUser(input, type);

                if (response.status === 200) {
                    if (response.data.total === 1) {
                        const item = response.data.items[0];
                        const {token, ttlMin} = JwtUtil.loginToken(item.externalId, item.fullName);

                        if (log.isInfoEnabled()) {
                            log.info(`Successfully retrieved user ${item.fullName} against ${input}. Generating login token ...`);
                        }

                        return res.status(response.status)
                            .cookie('_fks', token, {
                                maxAge: parseInt(ttlMin, 10) * 60 * 1000,        // Expires (in milliseconds)
                                httpOnly: true,                 // Protects against XSS attacks (not accessible via client JS)
                                secure: true,                   // Only sent over HTTPS
                                sameSite: 'lax',                // Mitigates CSRF attacks
                                path: process.env.BASE_PATH || '/gateway/v1'
                            })
                            .json({externalId: item.externalId, fullName: item.fullName});
                    }
                    else {
                        // No associated user found.
                        // Clear the previous cookie.
                        log.warn(`No user details found against ${input}. Forwarding to sign-up screen ...`);
                        
                        res.clearCookie('_fks', {
                            httpOnly: true,
                            secure: true,
                            sameSite: 'lax',
                            path: process.env.BASE_PATH || '/gateway/v1'
                        });
                        return res.status(404)
                                .json({success: false, message: 'No user details found'});
                    }
                }
                else {
                    throw new Error(`Error fetching user details for ${input}`);
                }

            case 'INVALID':
                return res.status(400).json({
                    success: false,
                    message: 'Incorrect OTP. Please try again'
                });

            case 'EXPIRED':
                return res.status(400).json({
                    success: false,
                    message: 'OTP is expired. Go back to previous screen and try generating the OTP again'
                });

            default:
                log.error(`Unexpected OTP verification status: ${result.status}`);

                return res.status(500).json({
                    success: false,
                    message: 'There was a problem verifying the otp. Please try later'
                });
        }
    }
    catch (err) {
        log.error('Error in verifying otp for ' + input, err);
        res.status(500)
                .json({success: false, message: err.message});
    }
}

async function queryUser(input, type) {
    // Obtain the scope based short-lived token.
    // This call will get it from cache. If not token is present in cache, make call to token service end point.
    const mtls_jwt = await tokenMgr.getToken('user:create|user:query');
    if (log.isDebugEnabled()) {
        log.debug('Scope token is available. Proceed for query ...');
    }

    // Check if the mobile number or email address is already registered.
    const params = {};
    if (type === 'mobile') {
        params.phone1 = input;
    }
    else {
        params.email = input;
    }

    const response = await httpClient.get(
        '/users',
        {
            headers: {
                Authorization: `Bearer ${mtls_jwt}`
            },
            params: params
        }
    );
    return response;
}

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);

module.exports = router;
