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
            '/bookings'
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
                log.debug('Successfully made new booking. Response:\n%s', JSON.stringify(result, null, 2));
            }

            res.status(response.status)
                .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to create new booking. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in creating new booking');
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
        let bookingId = req.params.id;
        const response = await httpClient.put(
            '/bookings/' + bookingId
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
                log.debug('Successfully modified booking details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to modify booking details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying booking details');
    }
}

async function patch(req, res) {
    let payload = req.body;

    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        let bookingId = req.params.id;
        const response = await httpClient.patch(
            '/bookings/' + bookingId
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
                log.debug('Successfully modified booking details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to modify booking details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying booking details');
    }
}

async function view(req, res) {
    try {
        let bookingId = req.params.id;
        const response = await httpClient.get(
            '/bookings/' + bookingId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched booking details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch booking details. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching booking details');
    }
}

async function viewAll(req, res) {
    try {
        const response = await httpClient.get(
            '/bookings'
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
                log.debug('Successfully fetched all bookings. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch all bookings. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching all bookings');
    }
}

async function remove(req, res) {
    try {
        let bookingId = req.params.id;
        const response = await httpClient.delete(
            '/bookings/' + bookingId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 204) {
            if (log.isDebugEnabled()) {
                log.debug('Successfully deleted booking %s', bookingId);
            }
            return res.status(response.status).end();
        }
        else {
            let result = response.data;
            log.error('Unable to delete booking %s. Status code: %d. Error Msg: %s', bookingId, response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in deleting booking');
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

route.post('/', create);
route.put('/:id', modify);
route.patch('/:id', patch);
route.get('/:id', view);
route.get('/', viewAll);
route.delete('/:id', remove);

module.exports = route;
