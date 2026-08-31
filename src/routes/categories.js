const express = require('express');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

async function viewAll(req, res) {
    try {
        const response = await httpClient.get(
            '/categories/hierarchy'
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                },
                params: req.query
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched all categories. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch all categories. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching all categories');
    }
}

async function handleError(req, res, err, msg) {
    log.error(msg, err);
    
    // token acquisition failed OR booking insert failed (Received invalid response from backend server).
    if (err.response) {
        return res.status(err.response.status).json(err.response.data);
    }
    return res.status(503).json({
        message: 'Service temporarily unavailable'
    });
}

route.get('/hierarchy', viewAll);

module.exports = route;
