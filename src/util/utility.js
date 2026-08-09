
class Utility {

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
}

module.exports = Utility;
