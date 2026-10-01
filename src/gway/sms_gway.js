const Gateway = require('./gateway');
const {getLogger} = require('./../util/logger');
const httpClient = require('./../util/http_client');
const https = require('https');
const errorHandler = require("../util/error");
const Utility = require("../util/utility");

const log = getLogger(__filename);

class SmsGateway extends Gateway {
    
    constructor() {
        super();
        
        this.flag = false;
        this.smsURL = process.env.SMS_PROVIDER_URL;
        this.accountId = process.env.SMS_ACCOUNT_ID;
        this.authToken = process.env.SMS_AUTH_TOKEN;
        this.config = {
            headers: {
                'Content-Type' : 'application/x-www-form-urlencoded',
                'Authorization' : 'Basic ' + Utility.encode(this.accountId, this.authToken)
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })// This bypasses SSL verification
        };
    }
    
    async demoSend(param) {
        const message = `Hearth sms OTP: ${param.otp}. Valid for ${param.ttlMin} minutes. Never share this OTP with anyone.`;
        
        let baseURL = 'https://smsgateway.com';
        
        let payload = {
            templateId: '0',
            mobile: param.input,
            variables: [
                param.otp,
                param.ttlMin
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
    }

    async send(param) {
        if (! this.flag) {
            return this.demoSend(param);
        }

        // 1. Prepare form data
        let mobileNo = '+91' + param.recipient;
        
        const body = new URLSearchParams({
            "To": mobileNo,
            "From": "+17372508034",
            "Body": "sms_2fa"           // Replace with Template ID and otp
        });
        // 2. Create Basic Auth Header in constructor
        // 3. Send the SMS Request
        try {
            const response = await httpClient.post(this.smsURL, body.toString(), this.config);
            if(response.status === 201) { // Success
                let respString = response.data;
                //console.log("SMS sent to: "+response.data.to);
                return respString;
            }
            else { // Error
                let result = response.data;
                log.error('Unable to send SMS. Http status code: %d. Error code and Msg: %s %s', response.status,
                    response.data.error_code, result);
                throw new Error("Unable to send SMS.");
            }
        }
        catch (err) {
            log.error("Error in sending SMS.", err);
            throw err;
        }
    }
}

module.exports = new SmsGateway();
