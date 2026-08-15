/* =========================================================================
 cookies.js
 Minimal cookie parse/serialize helpers — no dependency on the `cookie`
 npm package, since this project deliberately has none.
 ========================================================================= */

/** Parses a `Cookie` request header into a plain object. */
function parseCookies(cookieHeader) {
    const result = {};
    if (!cookieHeader)
        return result;

    cookieHeader.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1)
            return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (!key)
            return;
        try {
            result[key] = decodeURIComponent(value);
        } catch (err) {
            result[key] = value;
        }
    });

    return result;
}

/**
 * Builds a `Set-Cookie` header value.
 * @param {string} name
 * @param {string} value
 * @param {{ httpOnly?: boolean, path?: string, maxAgeSeconds?: number, sameSite?: 'Lax'|'Strict'|'None', secure?: boolean }} [options]
 */
function serializeCookie(name, value, options = {}) {
    const {
        httpOnly = true,
        path = '/',
        maxAgeSeconds,
        sameSite = 'Lax',
        secure = false,
    } = options;

    let cookie = `${name}=${encodeURIComponent(value)}`;
    if (path)
        cookie += `; Path=${path}`;
    if (typeof maxAgeSeconds === 'number')
        cookie += `; Max-Age=${maxAgeSeconds}`;
    if (httpOnly)
        cookie += '; HttpOnly';
    if (sameSite)
        cookie += `; SameSite=${sameSite}`;
    if (secure)
        cookie += '; Secure';
    return cookie;
}

/** Builds a `Set-Cookie` header value that immediately expires a cookie. */
function serializeExpiredCookie(name, options = {}) {
    return serializeCookie(name, '', {...options, maxAgeSeconds: 0});
}

module.exports = {parseCookies, serializeCookie, serializeExpiredCookie};
