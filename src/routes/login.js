const express = require('express');

const JwtUtil = require('./../auth/jwt');
const GatewayFactory = require('./../gway/gway_factory');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');
const OtpGen = require('./../util/otp');
const redisClient = require('./../util/redis_client');
const Utility = require('./../util/utility');

const route = express.Router();

const log = getLogger(__filename);

function login(req, res) {
    // This method will be called when user provides the mobile number and request for otp.
    let validity = 5;      // 5 min
    
    const input = String(req.body.input);
    const type = Utility.getIdentityType(input);
    const gway = GatewayFactory.get(type);
    
    if (log.isDebugEnabled()) {
        log.debug(`Obtained gateway ${gway.constructor.name} for input ${input}`);
    }
    
    const paramName = type === 'mobile' ? 'phone1' : 'email';
    
    // Query the backend server to see if the user as identified by the input (mobile number or email address) already exists.
    let uri = '/users';
    let config = {
        headers: {
            'Authorization': 'Bearer ' + req.token
        },
        params: {
            paramName: input
        }
    };
    httpClient.get(req
        , res
        , uri
        , config
        , response => {
            
        let arr = JSON.stringify(response.data);
        if (arr.length === 0) {
            return res.status(404)
                .send({success: false, message: 'No user found associated with the mobile/email'});
        }
        // User exists.
        // First check if the otp has already been generated and stored in cache.
        let promise = redisClient.getValue(input);

        promise.then(data => {
            if (data === null) {
                let val = OtpGen.generate(input, 'signup', validity * 60);
                let promise = redisClient.setValue(input, JSON.stringify(val), validity * 60);

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

function verify(req, res) {
    let input = String(req.body.input);
    let otp = Number(req.body.otp);
    
    // First check if the otp has already been generated and stored in cache.
    let promise = redisClient.getValue(input);
    
    promise.then(data => {
        if (data === null) {
            log.warn(`No otp found in store against ${input}`);
            res.status(401)
                    .set('Accept', 'application/json')
                    .send({message: 'UnAuthorized. Try generating the otp again'});
        }
        else {
            let val = JSON.parse(data);
            if (otp === val.otp) {
                if (log.isDebugEnabled()) {
                    log.debug(`Successfully verified otp ${otp} against ${input}`);
                }
                res.status(200)
                        .set('Accept', 'application/json')
                        .send({success: true, message: 'Otp verified successfully'});
            }
            else {
                log.error(`Supplied otp ${otp} does not match with stored otp ${val.otp}`);
                res.status(401)
                        .set('Accept', 'application/json')
                        .send({message: 'UnAuthorized. Invalid otp'});
            }
        }
    }).catch (err => {
        log.error(`Error reconciling otp from redis cache for ${input}.`, err);
        res.status(500)
                .set('Accept', 'application/json')
                .send({message: err.message});
    });
}

route.post('/otp/dispatch', login);
route.post('/otp/verify', verify);

module.exports = route;

