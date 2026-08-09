const express = require('express');

const JwtUtil = require('./../auth/jwt');
const GatewayFactory = require('./../gway/gway_factory');
const {getLogger} = require('./../util/logger');
const OtpGen = require('./../util/otp');
const redisClient = require('./../util/redis_client');
const Utility = require('./../util/utility');

const route = express.Router();

const log = getLogger(__filename);

function signUp(req, res) {
    // This method will be called when user provides the mobile number and request for otp.
    let validityMin = process.env.SIGN_UP_OTP_EXP_MIN || 5;      // 5 min
    
    const input = String(req.body.input);
    const type = Utility.getIdentityType(input);
    const gway = GatewayFactory.get(type);
    
    if (log.isDebugEnabled()) {
        log.debug(`Obtained gateway ${gway.constructor.name} for input ${input}`);
    }

    // First check if the otp has already been generated and stored in cache.
    if (log.isTraceEnabled()) {
        log.trace(`Calling redis server to fetch any existing otp details against ${type} ${input}`);
    }
    let promise = redisClient.getValue(input);
    
    promise.then(data => {
        if (data === null) {
            if (log.isTraceEnabled()) {
                log.trace(`No otp details found for ${type} ${input} in redis. Generating new otp ...`);
            }
            let val = OtpGen.generate(input, 'signup', validityMin);
            let promise = redisClient.setValue(input, JSON.stringify(val), validityMin);
            
            promise.then(data => {
                if (log.isDebugEnabled()) {
                    log.debug(`Cached otp for ${input} to redis cache. Response: ${data}`);
                }
                // Now, send the otp via sms/email.
                sendOtp(res, gway, val);
                
            }).catch(err => {
                log.error(`Error caching otp for ${input} to redis cache.`, err);
                res.status(500)
                        .set('Accept', 'application/json')
                        .send({message: err.message});
            });
        }
        else {
            let val = JSON.parse(data);
            if (val.purpose === 'signup') {
                log.error(`Otp ${val.otp} has already been sent to: ${input}`);

                res.status(200)
                        .set('Accept', 'application/json')
                        .send({message: `Otp has already been sent. Please wait for ${validity} minute before trying again`});
            }
            else {
                // Should never come here
                res.status(500)
                        .set('Accept', 'application/json')
                        .send({message: `Inconsistent state during sign-up. Found a cache entry for mobile ${input} with purpose as ${val.purpose}`});
            }
        }
    }).catch (err => {
        log.error(`Error fetching value from redis cache for ${input}.`, err);
        res.status(500)
                .set('Accept', 'application/json')
                .send({message: err.message});
    });
}
    
function sendOtp(res, gway, val) {
    let param = {
        recipient: val.input,
        otp: val.otp,
        ttl: val.ttl / 60
    };
    
    gway.send(param)
        .then(result => {
            if (log.isDebugEnabled()) {
                log.debug(`Response from gateway: ${result.message}`);
            }
            let token = generateCookie(val);

            res.status(200)
                .set('Accept', 'application/json')
                .cookie('_fks', token, {
                    maxAge: val.ttl * 1000,
                    httpOnly: true,         // Protects against XSS attacks (not accessible via client JS)
                    secure: true,           // Only sent over HTTPS
                    sameSite: 'lax'         // Mitigates CSRF attacks
                })
                .send({success: true, message: 'Otp sent successfully'});

        }).catch(err => {
            log.error(`Error sending otp for ${val.input}`, err);
            res.status(500)
                    .set('Accept', 'application/json')
                    .send({message: err.message});
        });
}

function generateCookie(val) {
    // If everything is successful, generate a jwt token with mobile number as id,
    // and set it as a cookie.
    // In subsequent verify call, this token will be sent back.
    // If the token is not present, then verify call will be rejected.

    // Generate the temporary sign-up token.
    // jti is the JWT ID. It is one of the registered claims defined in RFC 7519.
    // Its purpose is to provide a unique identifier for a JWT.
    const payload = {
        sub: val.input,
        jti: val.jti
    };
    return JwtUtil.sign(payload, String(val.ttl / 60) + 'm');
}

async function verify(req, res) {
    try {
        const input = String(req.body.input);
        const otp = Number(req.body.otp);
        
        const data = await redisClient.getValue(input);
        if (data === null) {
            log.warn(`No otp found in store against ${input}`);
            return res.status(401)
                    .json({ message: 'Unauthorized. Try generating the otp again' });
        }
        const val = JSON.parse(data);
        if (otp === val.otp) {
            if (log.isDebugEnabled()) {
                log.debug(`Successfully verified otp ${otp} against ${input}`);
            }

            await redisClient.remove(input);
            if (log.isDebugEnabled()) {
                log.debug(`Removed otp details from redis for ${input}`);
            }

            return res.status(200)
                    .json({success: true, message: 'Otp verified successfully'});
        }
        log.error(`Supplied otp ${otp} does not match with stored otp ${val.otp}`);
        return res.status(401)
                .json({message: 'Unauthorized. Invalid otp'});
    }
    catch (err) {
        log.error(`Error reconciling otp from redis cache for ${input}.`, err);
        return res.status(500)
                .json({message: err.message});
    }
}

route.post('/otp/dispatch', signUp);
route.post('/otp/verify', verify);

module.exports = route;
