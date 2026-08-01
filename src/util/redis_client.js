const path = require('path');
const redis = require('redis');

const {getLogger} = require('./../util/logger');

const log = getLogger(path.basename(__filename, ".js"));

class RedisClient {
    
    constructor() {
        this.client = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) {
            return;
        }
        
        const protocol = 'redis://';
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || '6379';
        const url = `${protocol}${host}:${port}`;

        const start = Date.now();

        this.client = redis.createClient({url});

        this.client.on('connect', () => {
            if (log.isInfoEnabled()) {
                log.info(`Connecting to redis [ Url: ${url} ] ... `);
            }
        });

        this.client.on('ready', () => {
            if (log.isInfoEnabled()) {
                log.info('Successfully connected to redis server. Elapsed time(ms): %d', (Date.now() - start));
            }
        });

        this.client.on('error', (err) => {
            log.error('Error while connecting to redis', err);
        });

        this.client.connect()
            .then(() => {
                this.initialized = true;
            })
            .finally(() => {
                // Do nothing
            });
    }

    async setValue(key, val, ttl) {
        if (ttl) {
            return this.client.set(key, val, {EX: ttl});
        }
        return this.client.set(key, val);
    }

    async getValue(key) {
        return this.client.get(key);
    }
}

module.exports = new RedisClient();
