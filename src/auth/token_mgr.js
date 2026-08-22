const Token = require('./../auth/token');
const httpClient = require('./../util/http_client');
const Utility = require('./../util/utility');
const errorHandler = require('./../util/error');
const {getLogger} = require('../util/logger');

const log = getLogger(__filename);

class TokenManager {
    
    constructor() {
        this.cache = new Map();
        
        this.tokenUrl = process.env.AUTH_TOKEN_URL;
        this.clientId = process.env.SERVICE_CLIENT_ID;
        this.clientSecret = process.env.SERVICE_CLIENT_SECRET;
        
        this.config = {
            headers: {
                'Authorization': 'Basic ' + Utility.encode(this.clientId, this.clientSecret),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        // this.scope = process.env.SERVICE_SCOPE || 'customer:create';
    }

    async getToken(scope) {
        // The first request will fetch a token using client_credentials, cache it, and reuse it until it is close to expiry.
        // When it expires, the next request refreshes it automatically. If several requests arrive at the same time after expiry, 
        // only one token refresh happens.
        if (log.isTraceEnabled()) {
            log.trace('Calling token manager cache to check the presence of a token against scope %s', scope);
        }
        let mtls_token = this.cache.get(scope);

        if (mtls_token && mtls_token.isValid()) {
            if (log.isDebugEnabled()) {
                log.debug('Cached token for scope %s is valid. Returning ...', scope);
            }
            // JavaScript automatically wraps it as: 
            // return Promise.resolve(token.jwt);
            // So the caller receives: Promise<String>
            return mtls_token.jwt;
        }
        // If a refresh is already in progress for this scope, reuse it.
        if (mtls_token && mtls_token.refreshPromise) {
            if (log.isDebugEnabled()) {
                log.debug('A token refresh for scope %s is in progress ...', scope);
            }
            return mtls_token.refreshPromise;
        }
        
        if (! mtls_token) {
            if (log.isDebugEnabled()) {
                log.debug('No valid token found in token cache for scope %s', scope);
            }
            mtls_token = new Token(null, 0);
            this.cache.set(scope, mtls_token);
        }
        
        // refreshPromise is the token refresh that is currently happening.
        // This returns Promise<String>
        // If an async function returns another Promise, it does not wrap it again.
        if (log.isDebugEnabled()) {
            log.debug('Refreshing the token for scope %s', scope);
        }
        mtls_token.refreshPromise = this.refresh(scope, mtls_token);
        
        try {
            return mtls_token.refreshPromise;
        }
        finally {
            mtls_token.refreshPromise = null;
        }
    }
    
    async refresh(scope, mtls_token) {
        const maxRetry = 3;
        const retryDelayMs = 300;
        
        const grant = new URLSearchParams({
            grant_type: 'client_credentials',
            scope: scope
        });

        for (let attempt = 0; attempt < maxRetry; attempt ++) {
            try {
                if (log.isTraceEnabled()) {
                    log.trace('Calling token server url %s to obtain a new token for scope %s. Attempt: %d'
                        , this.tokenUrl, scope, (attempt + 1));
                }
                const response = await httpClient.post(
                    this.tokenUrl,
                    grant,
                    this.config
                );

                const data = response && response.data ? response.data : {};
                const jwt = data.access_token;
                const expiresIn = Number(data.expires_in);
                
                if (! jwt) {
                    throw new Error('Token endpoint did not return jwt/access_token');
                }

                if (log.isDebugEnabled()) {
                    log.debug('Obtained a new token from the token server. Validity (hr): %d ', (expiresIn / 3600));
                }

                // Store it back in the cache.
                const expiresAt = Date.now() + expiresIn * 1000;
                mtls_token.jwt = jwt;
                mtls_token.expiresAt = expiresAt;

                return mtls_token.jwt;
            }
            catch (err) {
                if (errorHandler.shouldRetry(err)) {
                    log.warn('Token refresh request failed for scope %s, retrying attempt %d/%d...', scope, attempt + 1, maxRetry);
                    await sleep(retryDelayMs * (attempt + 1));
                    
                    continue;
                }
                errorHandler.handleError(err);
                
                // Remove stale token.
                this.cache.delete(scope);
                if (log.isInfoEnabled()) {
                    log.info('Removed stale token for scope %s from the token cache', scope);
                }
                throw err;
            }
        }
    }
    
    async slee(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = new TokenManager();
