const {getLogger} = require('./logger');

const log = getLogger(__filename);

class ErrorHandler {
    
    constructor() {
        
    }
    
    shouldRetry(err) {
        // Network / connection problems
        if (err.request && ! err.response) {
            return true;
        }
        const status = err.response?.status;
        
        return status === 502 || status === 503 || status === 504;
    }
    
    handleError(res, err, conclude = false) {
        let status = -1;
        let msg = null;

        if (err.response) {
            // Received invalid response.
            log.error('Received http status: %d and message: %s from server.'
                    , err.response.status, err.response.data);

            status = err.response.status;
            msg = err.response.data;
        }
        else if (err.request) {
            // The request was made but no response was received (e.g., Network Down, Timeout)
            log.error('No response received from server. Network issue.');
            status = 504;
        }
        else {
            // Something happened in setting up the request that triggered an Error
            log.error('Http client setup error:', err);
            status = 500;
            msg = err.message;
        }
        if (conclude) {
            res.status(status)
                    .set('Accept', 'application/json')
                    .send(msg);
        }
    }
}

module.exports = new ErrorHandler();
