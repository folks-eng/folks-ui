const sms = require('./sms_gway');
const email = require('./email_gway');

class GatewayFactory {
    
    static get(type) {
        const gatewayType = (type || '').toLowerCase();

        switch (gatewayType) {
            case 'mobile':
                return sms;
            case 'email':
                return email;
            default:
                throw new Error(`Unsupported gateway type: ${type}`);
        }
    }
}

module.exports = GatewayFactory;
