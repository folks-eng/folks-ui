const fs = require('fs');
const path = require('path');

const { getLogger } = require('./../util/logger');

const log = getLogger(path.basename(__filename, '.js'));

const privateKeyFile = path.join(__dirname, '..', '..', 'keystore', 'folks_prv.pem');
const publicKeyFile = path.join(__dirname, '..', '..', 'keystore', 'folks_pub.pem');

class KeyStore {

    constructor() {
        this.privateKey = null;
        this.publicKey = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) {
            return;
        }
        this.privateKey = fs.readFileSync(privateKeyFile, 'utf8');
        this.publicKey = fs.readFileSync(publicKeyFile, 'utf8');

        this.initialized = true;
        
        if (log.isDebugEnabled()) {
            log.debug(`Read private key from ${privateKeyFile}`);
            log.debug(`Read public key from ${publicKeyFile}`);
        }
        if (log.isInfoEnabled()) {
            log.info("Initialized keystore");
        }
    }

    getPrivateKey() {
        return this.privateKey;
    }

    getPublicKey() {
        return this.publicKey;
    }
}

// Every require('./keystore') gets the same instance.
module.exports = new KeyStore();
