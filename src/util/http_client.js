const axios = require('axios');
const https = require('https');
const fs = require('fs');

const errorHandler = require('./error');
const {getLogger} = require('./logger');

const log = getLogger(__filename);

class HttpClient {

    constructor() {
        this.server = process.env.FOLKS_SERVER || 'http://localhost:8080';
        this.contextRoot = process.env.FOLKS_CONTEXT_ROOT || '/api/v1';
        
        const httpsAgent = new https.Agent({
            key: fs.readFileSync(process.env.MTLS_CLIENT_KEY_PATH),
            cert: fs.readFileSync(process.env.MTLS_CLIENT_CERT_PATH),
            ca: fs.readFileSync(process.env.MTLS_CA_CERT_PATH),
            
            rejectUnauthorized: true,
            servername: process.env.MTLS_SERVER_NAME || 'localhost',
            minVersion: 'TLSv1.2'
        });

        // Create a custom configured instance.
        this.client = axios.create({
            baseURL: this.server,
            timeout: 5000,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json'
            },
            paramsSerializer: {
                indexes: null
            }
        });

        this.client.interceptors.request.use(config => {
            let dump = '\n============================ REQUEST ============================' + '\n';
            dump += config.method.toUpperCase() + ' ' + (config.baseURL + config.url) + '\n';
            dump += 'URI: ' + axios.getUri(config) + '\n';
            dump += config.headers + '\n';
            if (! (typeof config.params === 'undefined')) {
                dump += JSON.stringify(config.params) + '\n';
            }
            
            if (config.data instanceof URLSearchParams) {
                dump += 'Body (string): ' + config.data.toString() + '\n';
                dump += 'Body (entries): ' + Object.fromEntries(config.data) + '\n';
            }
            else if (! (typeof config.data === 'undefined')) {
                dump += (typeof config.data === 'string' ? config.data : JSON.stringify(config.data, null, 2)) + '\n';
            }
            dump += '=================================================================' + '\n';

            if (log.isDebugEnabled()) {
                log.debug(dump);
            }
            return config;
        });
        
        this.client.interceptors.response.use(response => {
            let dump = '\n============================ RESPONSE ============================' + '\n';
            dump += response.status + '\n';
            dump += response.headers + '\n';
            dump += (typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)) + '\n';
            dump += '=================================================================' + '\n';

            if (log.isDebugEnabled()) {
                log.debug(dump);
            }
            return response;
        });
        
        if (log.isInfoEnabled()) {
            log.info('Initialized http client and added request and response interceptors');
        }
    }

    _buildUrl(uri) {
        if (/^https?:\/\//i.test(uri)) {
            return uri;
        }
        return this.contextRoot + uri;
    }
    
    async rpc(uri, method, payload, config = {}) {
        const url = this._buildUrl(uri);
        
        let param = {
            ...config
        };
        param.method = method;
        param.url = url;
        if (payload !== null) {
            param.data = payload;
        }
        
        return await this.client.request(param);
    }

    async post(uri, payload, config = {}) {
        return this.rpc(uri, 'POST', payload, config);
    }

    async get(uri, config = {}) {
        return this.rpc(uri, 'GET', null, config);
    }

    async put(uri, payload, config = {}) {
        return this.rpc(uri, 'PUT', payload, config);
    }

    async patch(uri, payload, config = {}) {
        return this.rpc(uri, 'PATCH', payload, config);
    }

    async delete(uri, config = {}) {
        return this.rpc(uri, 'DELETE', null, config);
    }

    legacyPost(req, res, uri, payload, config, onSuccess) {
        let promise = this.client.post(
            this.contextRoot + uri,
                payload,
                config);

        promise.then(response => {
            onSuccess(response);
            
        }).catch(err => {
            errorHandler.handleError(res, err, true);
        });
    }

    legacyGet(req, res, uri, config, onSuccess) {
        let promise = this.client.get(
            this.contextRoot + uri,
                config);

        promise.then(response => {
            onSuccess(response);
            
        }).catch(err => {
            errorHandler.handleError(res, err, true);
        });
    }
}

module.exports = new HttpClient();
