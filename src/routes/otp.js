const GatewayFactory = require('./../gway/gway_factory');
const cache = require('./../util/cache');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');
const Utility = require('./../util/utility');

const log = getLogger(__filename);

class OtpHandler {
    
    async request(op, input) {
        let ttlMin = process.env.OTP_EXP_MIN || 5;      // 5 min
        const type = Utility.getIdentityType(input);

        try {
            // Check if otp is already present in the distributed cache.
            const data = await cache.getValue(input);
            
            if (data !== null) {
                const val = JSON.parse(data);
                log.warn(`Otp ${val.otp} has already been sent to: ${input}`);

                return {status: 0, otp: val};
            }
            else {
                if (log.isTraceEnabled()) {
                    log.trace(`No otp details found for ${type} ${input} in the cache. Generating new otp ...`);
                }
                // Generate 6 digit otp
                const val = Utility.generateOtp(input, op, ttlMin);

                // Store it in the distributed cache.
                const ret = await cache.setValue(
                    input,
                    JSON.stringify(val),
                    ttlMin
                );

                if (log.isDebugEnabled()) {
                    log.debug(`Cached otp for ${input} in the cache. Result: ${ret}`);
                }

                // Now, send the otp via sms/email.
                const gway = GatewayFactory.get(type);
                if (log.isDebugEnabled()) {
                    log.debug(`Obtained gateway ${gway.constructor.name} for input ${input} and ops ${op}`);
                }
                let param = {
                    recipient: val.input,
                    otp: val.otp,
                    ttl: val.ttl / 60
                };
                let result = await gway.send(param);

                if (log.isDebugEnabled()) {
                    log.debug('Response from gateway: %s', result.message);
                }
                return {status: 1, otp: val};
            }
        }
        catch (err) {
            log.error(`Error sending otp for ${type} ${input}`, err);
            throw err;
        }
    }

    async verify(input, otp) {
        try {
            const data = await cache.getValue(input);

            if (data === null) {
                log.warn(`No otp found in store against ${input}, or Otp has expired. Try generating the otp again`);
                return {
                    state: 'EXPIRED'
                };
            }
            // Found the otp in the cache.
            const val = JSON.parse(data);
            
            if (otp === val.otp) {
                if (log.isDebugEnabled()) {
                    log.debug(`Successfully verified otp ${otp} against ${input}`);
                }

                await cache.remove(input);
                if (log.isDebugEnabled()) {
                    log.debug(`Removed otp details from redis for ${input}`);
                }
                return {
                    state: 'VERIFIED',
                    otp: val
                };
            }
            else {
                log.error(`Supplied otp ${otp} does not match with stored otp ${val.otp}`);
                return {
                    state: 'INVALID',
                    otp: val
                };
            }
        }
        catch (err) {
            throw err;
        }
    }
}

module.exports = new OtpHandler();
