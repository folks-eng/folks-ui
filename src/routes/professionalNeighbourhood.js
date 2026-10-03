const express = require('express');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

async function viewAll(req, res) {
    try {
        const response = await httpClient.get(
            '/professionalNeighbourhoods'
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched %d professional neighbourhood details', result.total);
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch professional neighbourhood details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching professional neighbourhood details');
    }
}

async function updateNeighbourhoods(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        const response = await httpClient.patch(
            '/professionalNeighbourhoods'
            , payload
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully updated professional neighbourhoods');
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to update professional neighbourhoods. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying professional neighbourhood details');
    }
}

async function handleError(req, res, err, msg) {
    log.error(msg, err);
    
    // token acquisition failed OR address insert failed (Received invalid response from backend server).
    if (err.response) {
        return res.status(err.response.status).json(err.response.data);
    }
    return res.status(503).json({
        message: 'Service temporarily unavailable'
    });
}

route.get('/', viewAll);
route.patch('/', updateNeighbourhoods);

module.exports = route;
