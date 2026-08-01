const crypto = require('crypto');

const store = {};

const MIN = 100000;
const MAX = 1000000;
const TTL = 300;        // 5 min

class OtpGen {
    
    static generate(input, purpose, ttl) {
        let otp = crypto.randomInt(MIN, MAX);

        // Call redis API to store the otp in redis.
        // store[mobile] = otp;
        let val = {
            input: input,
            otp: otp,
            ttl: (ttl ? ttl : TTL),
            jti: crypto.randomUUID(),
            purpose: purpose,
            createdAt: Date.now()
        };
        return val;
    }
}

module.exports = OtpGen;
