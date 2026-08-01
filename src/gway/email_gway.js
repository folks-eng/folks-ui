const nodemailer = require('nodemailer');
const Gateway = require('./gateway');
const {getLogger} = require('./../util/logger');

const log = getLogger(__filename);

class EmailGateway extends Gateway {
    
    constructor() {
        super();
        
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
            // auth: {
            //     user: process.env.SMTP_USER,
            //     pass: process.env.SMTP_PASS
            // }
        });
    }

    /**
     * Since the send method is declared as async, it will always return a Promise.
     * 
     * async send(param) {
     *     ...
     *     const info = await this.transporter.sendMail(mailOptions);
     *
     *     return {
     *         success: true,
     *         message: 'Email sent successfully',
     *         messageId: info.messageId
     *     };
     * }
     * 
     * It is equivalent to writing:
     * 
     * send(param) {
     *     ...
     *     return new Promise((resolve, reject) => {
     *       this.transporter.sendMail(mailOptions)
     *         .then(info => {
     *           resolve({
     *               success: true,
     *               message: 'Email sent successfully',
     *               messageId: info.messageId
     *           });
     *         })
     *         .catch(err => {
     *           reject(err);
     *         });
     *     });
     * }
     * 
     * Thus, when we call it from the caller function:
     * 
     * const promise = emailGateway.send({
     *     recipient: 'someone@gmail.com',
     *     otp: '483921',
     *     validity: 5
     * });
     * 
     * console.log(promise);
     * 
     * It will print -> Promise { <pending> }
     * 
     * Now we will write:
     * 
     * promise.then(reesult => {
     *     console.log(result.success);
     *     console.log(result.message);
     * })
     * .catch (err => {
     *      console.error(err);
     * });
     * 
     * @param {type} param
     * @returns {nm$_email_gway.EmailGateway.send.email_gwayAnonym$1}
    */
    async send(param) {
        const message = `Folks email OTP: ${param.otp}. Valid for ${param.ttl} minutes. Never share this OTP with anyone.`;
        
        const recipient = param.recipient;
        const otp = param.otp;
        const validity = param.ttl;
        
        const subject = 'Folks OTP';
        const text =
            `Folks email OTP: ${otp}. ` +
            `Valid for ${validity} minutes. ` +
            `Never share this OTP with anyone.`;

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipient,
            subject: subject,
            text: text
        };

        if (log.isDebugEnabled()) {
            log.debug(`Sending email from ${mailOptions.from} to ${mailOptions.to}. Subject: ${subject}. Body: ${text}`);
        }

        const info = await this.transporter.sendMail(mailOptions);
        return {
            success: true,
            message: 'Email sent successfully',
            messageId: info.messageId
        };
    }
}

module.exports = new EmailGateway();
