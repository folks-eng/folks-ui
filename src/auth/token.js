
class Token {

    constructor(jwt, expiresAt) {
        this.jwt = jwt;
        this.expiresAt = expiresAt;
        this.refreshPromise = null;
    }

    isValid() {
        return Date.now() < (this.expiresAt - 30000);   // Refresh 30s early
    }
}

module.exports = Token;

