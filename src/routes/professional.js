//const crypto = require('crypto');
const express = require('express');
const JwtUtil = require('./../auth/jwt');
const tokenMgr = require('./../auth/token_mgr');
const httpClient = require('./../util/http_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();

const log = getLogger(__filename);

async function create(req, res) {
    let payload = req.body;
    console.log("CREATE: " +payload);
    if (! payload || Object.keys(payload).length === 0) {
        return res.status(400)
                .set('Content-Type', 'application/json')
                .json({message: 'Missing or empty json payload'});
    }
    
    try {
        const response = await httpClient.post(
            '/professionals/register'
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
                log.debug('Successfully registered new Professional. Response:\n%s', JSON.stringify(result, null, 2));
            }

            res.status(response.status)
                .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to create new professional. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in registering new professional');
    }
}

async function view(req, res) {
    try {
        let extId = req.params.id;
        const response = await httpClient.get(
            '/professionals/' + extId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 200) {
            let result = response.data;
            if (log.isDebugEnabled()) {
                log.debug('Successfully fetched professional details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch professional details. Status code: %d. Error Msg: %s', response.status, result);

            return res.status(response.status)
                .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching professional details');
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
        let extId = req.params.id;
        const response = await httpClient.put(
            '/professionals/' + extId
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
                log.debug('Successfully modified professional details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to modify professional details. Status code: %d. Error Msg: %s', response.status, result);

            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying professional details');
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
        let extId = req.params.id;
        const response = await httpClient.patch(
            '/professionals/' + extId
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
                log.debug('Successfully modified professional details. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to modify professional details. Status code: %d. Error Msg: %s', response.status, result);

            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in modifying professional details');
    }
}

async function viewAll(req, res) {
    try {
        const response = await httpClient.get(
            '/professionals'
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
                log.debug('Successfully fetched all professionals. Response:\n%s', JSON.stringify(result, null, 2));
            }
            return res.status(response.status)
                    .json(result);
        }
        else {
            let result = response.data;
            log.error('Unable to fetch all professionals. Status code: %d. Error Msg: %s', response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in fetching all professionals');
    }
}

async function remove(req, res) {
    try {
        let extId = req.params.id;
        const response = await httpClient.delete(
            '/professionals/' + extId
            , {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        );
        if (response.status === 204) {
            if (log.isDebugEnabled()) {
                log.debug('Successfully deleted professional %s', extId);
            }
            return res.status(response.status).end();
        }
        else {
            let result = response.data;
            log.error('Unable to delete professional %s. Status code: %d. Error Msg: %s', extId, response.status, result);
            
            return res.status(response.status)
                    .json(result);
        }
    }
    catch (err) {
        handleError(req, res, err, 'Error in deleting professional');
    }
}

async function handleError(req, res, err, msg) {
    log.error(msg, err);
    
    // token acquisition failed OR professional insert failed (Received invalid response from backend server).
    if (err.response) {
        return res.status(err.response.status).json(err.response.data);
    }
    return res.status(503).json({
        message: 'Service temporarily unavailable'
    });
}

route.post('/', create);
route.get('/:id', view);
route.put('/:id', modify);
route.patch('/:id', patch);

//route.get('/', viewAll);
//route.delete('/:id', remove);

module.exports = route