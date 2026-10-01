/* =========================================================================
 staticServer.js
 Serves everything in /public (the existing frontend, unchanged except
 for api.js's DEMO_MODE flag). No framework — just fs + correct
 Content-Type headers, with a basic path-traversal guard.
 ========================================================================= */

const fs = require('fs');
const path = require('path');
const {getLogger} = require('./util/logger');

const log = getLogger(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

// Convert to an Express middleware signature: (req, res, next)
function serveStatic(req, res, next) {
    let pathname = decodeURIComponent(req.path); // Express provides req.path out of the box
    
    // if (pathname.endsWith('.html')) {
    //     res.writeHead(403, {'Content-Type': 'text/plain'});
    //     res.end('403 Forbidden');
    //     return;
    // }
    if (pathname === '/') {
        pathname = '/index.html';
    }

    if (log.isTraceEnabled()) {
        log.trace('Serving static file %s for uri %s. Cookie: %s', pathname, req.originalUrl, req.cookies._fks);
    }
    
    // Strip any attempt to walk out of PUBLIC_DIR before joining.
    let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(PUBLIC_DIR, safePath);

    if (! filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, {'Content-Type': 'text/plain'});
        res.end('403 Forbidden');
        return;
    }

    // 1. Try serving the path exactly as requested
    fs.stat(filePath, (err, stats) => {
        if (! err && stats.isFile()) {
            return sendStaticFile(filePath, res);
        }

        // 2. Clean URLs: If no extension, check if a corresponding .html file exists
        if (! path.extname(filePath)) {
            const htmlFilePath = filePath + '.html';
            fs.stat(htmlFilePath, (htmlErr, htmlStats) => {
                if (!htmlErr && htmlStats.isFile()) {
                    return sendStaticFile(htmlFilePath, res);
                }
                res.writeHead(403, {'Content-Type': 'text/plain'});
                res.end('403 Forbidden');
                return;
            });
        }
        else {
            // Extension exists but file wasn't found, pass to next middleware (e.g., API router or 404 handler)
            next(); 
        }
    });
}

// Helper function to read and stream the file out
function sendStaticFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('500 Internal Server Error');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'});
        res.end(data);
    });
}

// Export the middleware
module.exports = serveStatic;