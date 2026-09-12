const express = require('express');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

async function viewAll(req, res) {
    try {
        const response = await httpClient.get(
            '/provinces'
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
                log.debug('Successfully fetched %d provinces.', result.total);
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch all provinces. Status code: %d. Error Msg: %s', response.status, result);

            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching provinces');
    }
}

async function handleError(req, res, err, msg) {
    log.error(msg, err);

    // token acquisition failed OR the backend location service is unreachable.
    if (err.response) {
        return res.status(err.response.status).json(err.response.data);
    }
    return res.status(503).json({
        message: 'Service temporarily unavailable'
    });
}

route.get('/', viewAll);

module.exports = route;
