const express = require('express');
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
        res.clearCookie('_fks', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: process.env.BASE_PATH || '/gateway/v1'
        });
        
        if (log.isInfoEnabled()) {
            log.info('User is successfully logged out');
        }
        
        return res.status(204).json({
            success: true,
            message: 'User has been logged out successfully'
        });
    }
    catch (err) {
        log.error('Error while logging out user.', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to logout'
        });
    }
}

module.exports = logout;
