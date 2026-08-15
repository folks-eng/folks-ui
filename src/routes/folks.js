const express = require('express');
const {getLogger} = require('./../util/logger');

const route = express.Router();
const log = getLogger(__filename);


module.exports = route;
