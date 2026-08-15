const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const httpClient = require('./../util/http_client');

const {getLogger} = require('./../util/logger');
const log = getLogger(__filename);

function normalizeContentType(ct = '') {
    return ct.split(';')[0].trim().toLowerCase();
}

function loadRouteMap(configPath) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    if (log.isInfoEnabled()) {
        log.info('Loaded node routing configuration file\n %s', raw);
    }

    const routeMap = new Map();

    for (const route of config.routes || []) {
        const key = [
            route.browser.method.toUpperCase(),
            route.browser.path,
            normalizeContentType(route.browser.contentType)
        ].join('|');

        routeMap.set(key, route);
    }

    return {
        vertxBaseUrl: config.folksBaseUrl,
        routeMap
    };
}

function createGatewayMiddleware({ vertxBaseUrl, routeMap }) {
    
    return async function gatewayMiddleware(req, res, next) {
        const contentType = normalizeContentType(req.headers['content-type'] || '');
        const key = [
            req.method.toUpperCase(),
            req.path,
            contentType
        ].join('|');

        const route = routeMap.get(key);

        if (! route) {
            return next();
        }

        try {
            const targetUrl = new URL(route.vertx.path, vertxBaseUrl).toString();

            const headers = {
                ...req.headers
            };

            // If you have body-parser enabled, req.body will already be parsed.
            let body;
            if (req.body != null) {
                if (Buffer.isBuffer(req.body)) {
                    body = req.body;
                }
                else if (typeof req.body === 'string') {
                    body = req.body;
                }
                else {
                    body = JSON.stringify(req.body);
                    headers['content-type'] = route.vertx.contentType || 'application/json';
                }
            }
            
            const response = await httpClient.call(
                targetUrl,
                req.method,
                body,
                headers
            );
    
            

            const data = response && response.data ? response.data : {};
            const jwt = data.access_token;
            const expiresIn = Number(data.expires_in);

            const text = await vertxRes.text();
            const responseContentType = vertxRes.headers.get('content-type');

            if (responseContentType) {
                res.setHeader('content-type', responseContentType);
            }

            res.status(vertxRes.status).send(text);
        }
        catch (err) {
            return next(err);
        }
    };
}

module.exports = {
    loadRouteMap,
    createGatewayMiddleware
};