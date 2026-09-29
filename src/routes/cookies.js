const express = require('express');
const JwtUtil = require('./../auth/jwt');

const router = express.Router();
const log = getLogger(__filename);

async function verify(req, res) {
    const input = req.body.input;
    const op = req.body.op;
    
    let token = req.cookies._fks;
    if (token) {
        const payload = JwtUtil.validate(token);
        if (payload) {
            log.error('Cookie already exists for %s as %s. Still trying to login', payload.name, payload.role);
            return res.status(401)
                    .set('Content-Type', 'application/json')
                    .send({message: 'You are already logged in as ' + payload.role + '. Log out first !'});
        }
    }
    return res.status(200);
}

router.post('/verify', verify);

module.exports = router;
