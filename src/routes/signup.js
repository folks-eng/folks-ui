const express = require('express');

const otpHandler = require('./otp');
const JwtUtil = require('./../auth/jwt');
const { getLogger } = require('../util/logger');
const Utility = require('./../util/utility');

const router = express.Router();
const log = getLogger(__filename);

async function requestOtp(req, res) {
    const input = req.body.input;
    const op = req.body.op;
    
    try {
        const ret = await otpHandler.request(op, input);
        
        if (ret.status === 1) {
            // Otp has just been generated. Therefore generate the token.
            let token = generateCookie(ret.otp);
            
            res.status(200)
                .set('Accept', 'application/json')
                .cookie('_fks', token, {
                    maxAge: ret.otp.ttl * 1000,
                    httpOnly: true,                 // Protects against XSS attacks (not accessible via client JS)
                    secure: true,                   // Only sent over HTTPS
                    sameSite: 'lax',                // Mitigates CSRF attacks
                    path: process.env.BASE_PATH || '/gateway/v1'
                })
                .send({success: true, message: 'Otp sent successfully'});
        }
        else {
            // res.status = 0
            // Otp has already been generated and sent
            res.status(200)
                .json({success: true, message: 'Otp has already been sent. Please wait for 5 minute before trying again'});
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
                return res.status(200).json({
                    success: true,
                    message: 'OTP verified successfully'
                });

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
                log.error(`Unexpected OTP verification status: ${result.state}`);

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

function generateCookie(otp) {
    // If everything is successful, generate a jwt token with mobile number as id,
    // and set it as a cookie.
    // In subsequent verify call, this token will be sent back.
    // If the token is not present, then verify call will be rejected.

    // Generate the temporary sign-up token.
    // jti is the JWT ID. It is one of the registered claims defined in RFC 7519.
    // Its purpose is to provide a unique identifier for a JWT.
    const payload = {
        sub: otp.input,
        jti: otp.jti
    };
    return JwtUtil.sign(payload, String(otp.ttl / 60) + 'm');
}

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);

module.exports = router;
