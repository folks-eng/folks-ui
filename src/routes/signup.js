const express = require('express');

const otpHandler = require('./otp');
const JwtUtil = require('./../auth/jwt');
const CookieUtil = require('./../util/cookie_util');
const Utility = require('./../util/utility');
const { getLogger } = require('../util/logger');

const router = express.Router();
const log = getLogger(__filename);

async function requestOtp(req, res) {
    const input = req.body.input;
    const op = req.body.op;
    
    try {
        // otp {
        //   input,
        //   otp,
        //   ttlMin
        //   purpose
        //   createdAt
        //   jti
        // }
        const ret = await otpHandler.request(op, input);
        
        if (ret.status === 1) {
            // Otp has just been generated. Therefore generate the token.
            let token = JwtUtil.otpToken(input, ret.otp.jti);
            let cookieOpts = CookieUtil.prepare(ret.otp.ttlMin);
            
            res.status(200)
                .set('Accept', 'application/json')
                .cookie(Utility.STD_COOKIE, token, cookieOpts)
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
    const user = req.user;
    
    try {
        const result = await otpHandler.verify(input, otp, user.jti);
        
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
                log.error('Unexpected OTP verification status: %s', result.state);

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

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);

module.exports = router;
