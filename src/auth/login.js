const express = require('express');
const crypto = require('crypto');
const JwtUtil = require('./../auth/jwt');
const redis = require('./../util/redis_client');
const {getLogger} = require('./../util/logger');

const route = express.Router();
const log = getLogger(__filename);

const store = {};
const MIN = 1000;
const MAX = 10000;
const TTL = 300;        // 5 min

function login(req, res) {
    
    
}
