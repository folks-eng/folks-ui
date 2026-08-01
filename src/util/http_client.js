const axios = require('axios');
const {getLogger} = require('./logger');

const log = getLogger(__filename);

class HttpClient {

    constructor() {
        this.server = process.env.FOLKS_SERVER || 'http://localhost:8080';
        this.contextRoot = process.env.FOLKS_CONTEXT_ROOT || '/api/v1';

        // Create a custom configured instance.
        this.client = axios.create({
            baseURL: this.server,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
                // 'Accept': 'application/json'
            }
        });

        this.client.interceptors.request.use(config => {
            let dump = '\n============================ REQUEST ============================' + '\n';
            dump += config.method.toUpperCase() + ' ' + (config.baseURL + config.url) + '\n';
            dump += config.headers + '\n';
            dump += (typeof config.data === 'string' ? config.data : JSON.stringify(config.data, null, 2)) + '\n';
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

    post(req, res, uri, payload, config, onSuccess) {
        let promise = this.client.post(
            this.contextRoot + uri,
                payload,
                config);

        promise.then(response => {
            onSuccess(response);
            
        }).catch(err => {
            handleError(res, err);
        });
    }

    get(req, res, uri, config, onSuccess) {
        let promise = this.client.get(
            this.contextRoot + uri,
                config);

        promise.then(response => {
            onSuccess(response);
            
        }).catch(err => {
            handleError(res, err);
        });
    }
    
    handleError(res, err) {
        let status = -1;
        let msg = null;

        if (err.response) {
            // Received invalid response.
            log.error(`Received http status: ${err.response.status} and message: ${err.response.data} from server.`);

            status = err.response.status;
            msg = err.response.data;
        }
        else if (err.request) {
            // The request was made but no response was received (e.g., Network Down, Timeout)
            log.error('No response received from server. Network issue.');
            status = 504;
        }
        else {
            // Something happened in setting up the request that triggered an Error
            log.error('Http client setup error:', err);
            status = 500;
            msg = err.message;
        }
        res.status(status)
                .set('Accept', 'application/json')
                .send(msg);
    }
}

module.exports = new HttpClient();
