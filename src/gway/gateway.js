class Gateway {

    constructor() {
        if (new.target === Gateway) {
            throw new Error('Gateway is an abstract class and cannot be instantiated directly');
        }
    }

    async send(param) {
        throw new Error('send() must be implemented by subclass');
    }
}

module.exports = Gateway;

