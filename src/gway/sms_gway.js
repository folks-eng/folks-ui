const Gateway = require('./gateway');
const {getLogger} = require('./../util/logger');
const httpClient = require('./../util/http_client');
const https = require('https');
const errorHandler = require("../util/error");

const log = getLogger(__filename);

class SmsGateway extends Gateway {
    
    constructor() {
        super();
    }

    async send(param) {
        const message = `Folks sms OTP: ${param.otp}. Valid for ${param.ttl} minutes. Never share this OTP with anyone.`;
        log.info(param.recipient +" Start of send OTP " +message);
        let config = {
            baseURL: 'https://api.twilio.com/2010-04-01/Accounts/AC02b7d7aa77326a13e3e45e4c78d66009/Messages.json',
            user: 'AC02b7d7aa77326a13e3e45e4c78d66009',
            authToken: 'c792bf4cd66dfd66ae4830b9b0ee743d'
        };
        /*let payload = {
            mobile: config.input,
            templateId: '0',
            variables: [
                config.otp,
                config.ttl
            ]
        };*/
        // 1. Prepare form data
        let mobileStr = "+91" + param.recipient;
        const formData = new URLSearchParams({
            "To": mobileStr, // Replace with regInfo.getMobileNum()
            "From": "+17372508034",
            "Body": "sms_2fa" // Replace with Template ID and otp
        });
        const formBody = formData.toString();

        // 2. Create Basic Auth Header
        const auth = `${config.user}:${config.authToken}`;
        const encodedAuth = Buffer.from(auth).toString('base64');

        // 3. Send the SMS Request
        try {
            const response = await httpClient.post(config.baseURL
                , formBody
                , {
                    headers: {
                        'Content-Type' : 'application/x-www-form-urlencoded',
                        'Authorization' : `Basic ${encodedAuth}`
                    },
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false // This bypasses SSL verification
                    })
                });
            if(response.status === 201) { // Success
                let respString = response.data;
                //console.log( response.data.to + " Error from SMS call "+response.data.error_code);
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
            //console.log(err.response.data.message);
            throw err;
        }
    }
}

module.exports = new SmsGateway();
