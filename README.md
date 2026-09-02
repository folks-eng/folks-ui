# Folks — Node.js Backend

This is the existing Folks frontend (unchanged, aside from one flag) plus a small Node.js server that answers every REST call it makes. **No database,
no npm dependencies, no build step.** Everything the server knows lives in plain JSON files under `src/data/`.

## Running it

```bash
npm start
```

or just:

```bash
SERVICE_CLIENT_ID={clien_id} SERVICE_CLIENT_SECRET={secret} node --env-file=.env server.js
```

```windows
set SERVICE_CLIENT_ID={clien_id}&&set SERVICE_CLIENT_SECRET={secret}&&node --env-file=.env server.js
```

Then open **https://localhost:8443**. That's it

## How it's wired together

```
folks-backend/
├── server.js              entry point — one http.createServer, no framework
├── package.json
├── keystore/
│   └── server.pkcs         self-signed PKCS#12 keystore (private key + cert)
├── public/                 the frontend, served as-is
│   ├── index.html, categories.html, checkout.html, ... (all unchanged)
│   ├── styles.css
│   ├── script.js, categories.js, ... (all unchanged)
│   ├── api.js               ← DEMO_MODE = false, credentials: 'include' on every fetch
│   └── checkout.js          ← booking payload no longer includes `customer`
└── src/
    ├── apiRouter.js         routes /api/v1/* to the right controller
    ├── staticServer.js      serves everything else out of /public
    ├── auth/
    │   ├── keystore.js       extracts the private key from server.pkcs at startup
    │   ├── jwt.js             minimal RS256 sign/verify (no jsonwebtoken package)
    │   └── session.js        reads+verifies the folks_token cookie -> { userId, mobile, name }
    ├── utils/
    │   ├── jsonStore.js      read/write JSON files (the entire "database layer")
    │   └── cookies.js        parse/serialize Set-Cookie headers (no `cookie` package)
    ├── controllers/
    │   ├── otpController.js
    │   ├── usersController.js
    │   ├── addressesController.js
    │   ├── bookingsController.js
    │   ├── professionalsController.js
    │   └── categoriesController.js
    └── data/                 ← the "database": one JSON file per resource
        ├── users/users.json
        ├── addresses/addresses.json
        ├── bookings/bookings.json
        ├── professionals/applications.json
        └── categories/categories.json
```



## Why no dependencies

The frontend's `api.js` already talks to these exact paths with
`fetch(...)`. The only thing missing was a server on the other end — that
didn't need Express, `body-parser`, or anything else, so it doesn't have
any. `server.js` uses only Node's built-in `http`, `url`, and `fs` modules.
This also means there is nothing to install before running it, and nothing
that can go stale in `node_modules`.

If you'd rather build this out with Express later (for routing sugar,
middleware, etc.), the controller functions in `src/controllers/*.js` are
already framework-agnostic — each just takes plain data in and returns
plain data out, so wiring them behind Express routes instead of
`apiRouter.js` is a small, mechanical change.

## Switching back to demo mode

`public/api.js` has one flag near the top:

```js
const DEMO_MODE = false;
```

Set it back to `true` and the frontend reverts to simulating every
endpoint entirely client-side (in `localStorage`) — useful if you ever want
to open the HTML files directly again without running this server at all.
Every endpoint also has a runtime fallback: if a fetch to this server ever
fails (server not running, network hiccup), the frontend automatically
falls back to its own demo simulation for that one call, logs a warning to
the console, and keeps working.

## Setup Redis

Node application requires `redis`. Therefore install `redis` 

### Prerequisites 

First, make sure you have Homebrew installed. From the terminal, run:

```
brew --version
```

If this command fails, you'll need to follow the Homebrew installation instructions.

### Installation 

From the terminal, run:

```
brew install redis
```

This will install Redis on your system.

### Starting and stopping Redis in the foreground 

To test your Redis installation, you can run the redis-server executable from the command line:

```
redis-server
```

If successful, you'll see the startup logs for Redis, and Redis will be running in the foreground.

To stop Redis, enter `Ctrl-C`.

### Connect to Redis 

Once Redis is running, you can test it by running `redis-cli`:

```
<prompt>redis-cli
```

Test the connection with the ping command:

```
127.0.0.1:6379> ping
PONG
```

## Setup Memurai - For Windows

Memurai is the windows version of Redis.

### Installation

Go to https://www.memurai.com/get-memurai?version=windows-valkey to download and install `Memural`.

### Run Memurai

Open memurai.conf and add the below line:

```
dir %HOME%\Memurai\data
dbfilename dump.rdb
```

### Start Redis (Memurai) Server

```
C:\Program Files\Memurai>memurai.exe
```

### Start Memurai CLI:

```
C:\Program Files\Memurai>memurai-cli.exe
```
