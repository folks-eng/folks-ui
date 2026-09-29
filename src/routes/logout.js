const express = require('express');
const CookieUtil = require('./../util/cookie_util');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

/**
 * Logs out the currently authenticated user.
 *
 * Clears the browser authentication cookie and removes any server-side
 * authentication state associated with the current session, if applicable.
 */
async function logout(req, res) {
    try {
        // IMPORTANT:
        // These options should match the options used when the cookie was created,
        // particularly path and domain.
        res.clearCookie(CookieUtil.STD_COOKIE, CookieUtil.COOKIE_OPTS);
        
        if (log.isInfoEnabled()) {
            log.info('User is successfully logged out');
        }
        
        return res.status(200).json({
            message: 'User has been logged out successfully'
        });
    }
    catch (err) {
        log.error('Error while logging out user.', err);
        return res.status(500).json({
            message: 'Unable to logout'
        });
    }
}

module.exports = logout;
