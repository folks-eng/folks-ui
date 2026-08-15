const crypto = require('crypto');

class Utility {

    static MIN = 100000;
    static MAX = 1000000;
    static TTL = 5;        // 5 min

    static getIdentityType(input) {
        input = input.trim();

        if (/^(?:\+91|91)?[6-9]\d{9}$/.test(input)) {
            return 'mobile';
        }

        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
            return 'email';
        }
        return null;
    }
    
    static encode(principal, credential) {
        return Buffer.from(principal + ':' + credential).toString('base64');
    }
    
    static decode(input) {
        const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        
        return Buffer.from(padded, 'base64').toString('utf8');
    }
    
    static generateOtp(input, purpose, ttlMin) {
        let otp = crypto.randomInt(Utility.MIN, Utility.MAX);

        // Call redis API to store the otp in redis.
        // store[mobile] = otp;
        let val = {
            input: input,
            otp: otp,
            ttl: (ttlMin ? ttlMin * 60 : Utility.TTL * 60),
            purpose: purpose,
            createdAt: Date.now()
        };
        return val;
    }
}

module.exports = Utility;
