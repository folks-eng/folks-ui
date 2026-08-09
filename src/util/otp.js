const crypto = require('crypto');

const store = {};

const MIN = 100000;
const MAX = 1000000;
const TTL = 300;        // 300 seconds (= 5 min)

class OtpGen {
    
    static generate(input, purpose, ttlMin) {
        let otp = crypto.randomInt(MIN, MAX);

        // Call redis API to store the otp in redis.
        // store[mobile] = otp;
        let val = {
            input: input,
            otp: otp,
            ttl: (ttlMin ? ttlMin * 60 : TTL),
            jti: crypto.randomUUID(),
            purpose: purpose,
            createdAt: Date.now()
        };
        return val;
    }
}

module.exports = OtpGen;
