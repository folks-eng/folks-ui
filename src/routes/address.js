const express = require('express');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

async function create(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        const response = await httpClient.post(
            '/addresses'
            , payload
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 201) {
            let result = response.data;
            
            if (log.isDebugEnabled()) {
                log.debug('Successfully added new address. Response:\n%s', JSON.stringify(result, null, 2));
            }

            res.status(response.status)
                .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to create new address. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in creating new address');
    }
}

async function modify(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        let addressId = req.params.id;
        const response = await httpClient.put(
            '/addresses/' + addressId
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
                log.debug('Successfully modified address details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to modified address details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying address details');
    }
}

async function view(req, res) {
    try {
        let addressId = req.params.id;
        const response = await httpClient.get(
            '/addresses/' + addressId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched address details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch address details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching address details');
    }
}

async function viewAll(req, res) {
    try {
        const response = await httpClient.get(
            '/addresses'
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched all addresses. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch all addresses. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching all address');
    }
}

async function remove(req, res) {
    try {
        let addressId = req.params.id;
        const response = await httpClient.delete(
            '/addresses/' + addressId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 204) {
            if (log.isDebugEnabled()) {
                log.debug('Successfully deleted address %s', addressId);
            }
            return res.status(response.status).end();
        }
        else {
            let result = response.data;
            log.error('Unable to delete address %s. Status code: %d. Error Msg: %s', addressId, response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in deleting user');
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

route.post('/', create);
route.put('/:id', modify);
route.get('/:id', view);
route.get('/', viewAll);
route.delete('/:id', remove);

module.exports = route;
