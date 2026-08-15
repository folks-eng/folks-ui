const Gateway = require('./gateway');
const {getLogger} = require('./../util/logger');

const log = getLogger(__filename);

class SmsGateway extends Gateway {
    
    constructor() {
        super();
    }

    async send(param) {
        const message = `Folks sms OTP: ${param.otp}. Valid for ${param.ttl} minutes. Never share this OTP with anyone.`;
        
        let config = {
            baseURL: 'https://smsgateway.com'
        };
        let payload = {
            templateId: '0',
            mobile: config.input,
            variables: [
                config.otp,
                config.ttl
            ]
        };
        if (log.isDebugEnabled()) {
            log.debug(message);
        }
        return Promise.resolve({
            success: true,
            message: 'Sms sent successfully',
            messageId: ''
        });
        
        // Uncomment the code when you have access to sms gateway in future.
        /*
        return httpClient.post(req
            , res
            , '/provider/airtel/send'
            , payload
            , config
            , callback);*/
    }
}

module.exports = new SmsGateway();
