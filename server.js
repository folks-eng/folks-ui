const express = require('express');
const url = require('url');
const path = require('path');
const cookieParser = require('cookie-parser');

const { getLogger } = require('./src/util/logger');
const keyStore = require('./src/auth/keystore');
const redisClient = require('./src/util/redis_client');

const { serveStatic } = require('./src/staticServer');
const { authenticate } = require('./src/auth/auth');

const signup = require('./src/routes/signup');
const accessLog = require('./src/util/access_logger');

const regRoute = require('./src/routes/registration');

const app = express();

const port = process.env.PORT || 3000;
const basePath = process.env.BASE_PATH || '/api/v1';

const log = getLogger(__filename);

function setup() {
    if (log.isInfoEnabled()) {
        log.info("Starting up folks node server");
    }
    // Middleware to parse JSON request bodies
    app.use(express.json());

    // Middleware to parse URL-encoded request bodies
    app.use(express.urlencoded({ extended: true }));
    
    // Middleware to parse cookie
    app.use(cookieParser());
    
    app.use(basePath, accessLog);
    
    // Everything below this requires authentication
    app.use(basePath, authenticate);
    
    app.use(basePath + '/signup', signup);
    app.use(basePath + '/registration', regRoute);

    // Middleware to serve static files from a directory
    app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
}

async function start() {
    setup();
    keyStore.init();
    
    await redisClient.init();
    
    app.listen(port, () => {
        if (log.isInfoEnabled()) {
            log.info(`Started folks node server. Listening to: ${port}`);
        }
    });

}

start();
