/* =========================================================================
   server.js
   Entry point. Plain Node.js (no Express, no npm dependencies at all) —
   run with `node server.js` or `npm start`, nothing to install first.

   Routes any /api/* request to the API router (src/apiRouter.js) and
   everything else to the static file server (src/staticServer.js), which
   serves the existing frontend out of /public unchanged.
   ========================================================================= */

const http = require('http');
const url = require('url');

const { handleApiRequest } = require('./src/apiRouter');
const { serveStatic } = require('./src/staticServer');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname.startsWith('/api/')) {
    handleApiRequest(req, res, parsedUrl);
  } else {
    serveStatic(req, res, parsedUrl);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Folks server running at http://localhost:${PORT}\n`);
  console.log('  Frontend served from /public');
  console.log('  API data files served/persisted from src/data/*\n');
});
