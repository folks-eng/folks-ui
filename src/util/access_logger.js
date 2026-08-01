const fs = require('fs');
const path = require('path');
const express = require('express');

const route = express.Router();
const logFile = process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'access.log');

var logStream = null;

function init() {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    
    logStream = fs.createWriteStream(logFile, {
        flags: 'a',
        encoding: 'utf8'
    });
    logStream.on('error', err => {
        console.error('Logger stream error:', err);
    });
}

function intercept(req, res, next) {
    let start = new Date();
    let logged = false;
    
    res.on('finish', () => {
        if (! logged) {
            log(req, res, start);
            logged = true;
        }
    });
    
    res.on('close', () => {
        if (! logged) {
            log(req, res, start);
            logged = true;
        }
    });

    next();
}

function log(req, res, start) {
    let duration = new Date().getTime() - start.getTime();

    const logEntry = start.toISOString()
            + ' ' + (req.ip || req.socket.remoteAddress)
            + ' ' + req.method
            + ' ' + (req.originalUrl || req.url)
            + ' ' + res.statusCode
            + ' ' + duration;
    
    // console.log(logEntry);
    logStream.write(logEntry + '\n');
}

init();

route.use('/', intercept);

module.exports = route;