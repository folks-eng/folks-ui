
class Utility {

    static getIdentityType(input) {
        input = input.trim();

        if (/^(?:\+91|91)?[6-9]\d{9}$/.test(input)) {
            return 'sms';
        }

        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
            return 'email';
        }
        return null;
    }
}

module.exports = Utility;
