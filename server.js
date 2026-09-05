const fs = require('node:fs');
const https = require('node:https');
const express = require('express');
const url = require('url');
const path = require('path');
const cookieParser = require('cookie-parser');

const keyStore = require('./src/auth/keystore');
const { authenticate } = require('./src/auth/auth');
const accessLog = require('./src/util/access_logger');
const { getLogger } = require('./src/util/logger');
const cache = require('./src/util/cache');

const signupRoute = require('./src/routes/signup');
const loginRoute = require('./src/routes/login');
const logoutRoute = require('./src/routes/logout');
const userRoute = require('./src/routes/user');
const addressRoute = require('./src/routes/address');
const categoryRoute = require('./src/routes/categories');
const availabilityRoute = require('./src/routes/availabilities');
const bookingRoute = require('./src/routes/booking');
const professionalRoute = require('./src/routes/professional');
const professionalSrvcRoute = require('./src/routes/professionalService');
const documentRoute = require('./src/routes/document');
const voucherRoute = require('./src/routes/voucher');

const { serveStatic } = require('./src/staticServer');

const app = express();

const port = process.env.PORT || 3000;
const basePath = process.env.BASE_PATH || '/gateway/v1';

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
    
    app.use(basePath + '/signup', signupRoute);
    app.use(basePath + '/login', loginRoute);
    app.use(basePath + '/logout', logoutRoute);
    app.use(basePath + '/users', userRoute);
    app.use(basePath + '/addresses', addressRoute);
    app.use(basePath + '/categories', categoryRoute);
    app.use(basePath + '/bookings', bookingRoute);
    app.use(basePath + '/availabilities', availabilityRoute);
    app.use(basePath + '/professionals', professionalRoute);
    app.use(basePath + '/professionalServices', professionalSrvcRoute);
    app.use(basePath + '/documents', documentRoute);
    app.use(basePath + '/coupons', voucherRoute);

    // Middleware to serve static files from a directory
    app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
}

async function start() {
    setup();
    keyStore.init();
    
    await cache.init();
    
    const httpsOptions = {
        key: fs.readFileSync('./cert/node-ext.key'),
        cert: fs.readFileSync('./cert/node-ext.crt')
    };
    
    https.createServer(httpsOptions, app).listen(8443, () => {
        log.info(`Started folks node server. Listening to: ${port}`);
    });
    
    // app.listen(port, () => {
    //     if (log.isInfoEnabled()) {
    //         log.info(`Started folks node server. Listening to: ${port}`);
    //     }
    // });

}

start();
