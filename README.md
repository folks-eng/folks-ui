# Folks — Node.js Backend

This is the existing Folks frontend (unchanged, aside from one flag) plus a
small Node.js server that answers every REST call it makes. **No database,
no npm dependencies, no build step.** Everything the server knows lives in
plain JSON files under `src/data/`.

## Running it

```bash
npm start
```

or just:

```bash
node server.js
```

Then open **http://localhost:3000**. That's it — there is nothing to
`npm install` (see [Why no dependencies](#why-no-dependencies) below).

To change the port:

```bash
PORT=4000 npm start
```

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

Every request either:
- starts with `/api/` → handled by `src/apiRouter.js`, which reads the request
  body (if any) and calls a controller, or
- is anything else → served as a static file straight out of `public/`
  by `src/staticServer.js` (so `/` → `public/index.html`, `/styles.css` →
  `public/styles.css`, etc. — identical to how you'd open these files
  directly, just now with a real server behind the API calls).

## Authentication: JWT signed by the keystore, held in a cookie

`keystore/server.pkcs` is a self-signed PKCS#12 keystore — one RSA
private key + its self-signed certificate, bundled together and protected
by a passphrase. **This is how it was generated** (already done — you don't
need to re-run this unless you want a fresh key):

```bash
openssl req -x509 -newkey rsa:2048 -keyout server.key.pem -out server.cert.pem \
  -days 3650 -nodes -subj "/CN=folks.local"

openssl pkcs12 -export -inkey server.key.pem -in server.cert.pem \
  -out keystore/server.pkcs -name folks-server -passout pass:folks-dev-passphrase
```

**At startup**, `src/auth/keystore.js` shells out to the `openssl` CLI once
(Node's core `crypto` module can parse a plain PEM key, but not a PKCS#12
container) to pull the private key out of `server.pkcs` into memory, and
derives the public key directly from it. Both are cached for the life of
the process — the keystore file is never decrypted to a second file on
disk.

**The flow:**

1. `POST /api/v1/otp/verify` succeeds → the server signs a JWT
   (`{ userId, mobile, name, iat, exp }`, RS256, 7-day expiry) with the
   private key and sets it as an **httpOnly** cookie (`folks_token`).
   Existing users get their real name/id right away (looked up by mobile
   in `users.json`); a brand-new number gets a token with just the mobile
   number, since no account exists yet to pull a name from.
2. `POST /api/v1/users` (signup completing) → the cookie is **reissued**
   with the now-known `userId` and `name`.
3. From then on, **every booking-related request is authenticated purely
   by that cookie** — `src/auth/session.js` verifies its signature against
   the derived public key and decodes `{ userId, mobile, name }` from it.

**What this means for booking a service:** the browser's request body for
`POST /api/v1/bookings` contains only `{ services, paymentMethod, amount }`
— no customer/identity fields at all. `bookingsController.createBooking`
takes the customer entirely from the verified JWT, not from anything the
client sent. The same applies to `GET /api/v1/bookings` (returns only the
signed-in user's bookings — no `?userId=` query param) and
`PUT /api/v1/bookings/:id` (cancelling someone else's booking now returns
`403 Forbidden`, verified by identity, not by a client-supplied id).

I verified this concretely, not just by reading the code: with a real
browser session, the actual network request for creating a booking was
captured and confirmed to contain zero identity fields, while the booking
that landed in `bookings.json` still had the correct `customer.id`/`name`
attached — because the server pulled it from the cookie. I also confirmed
a tampered cookie, a missing cookie, and a valid cookie for the wrong user
are each rejected correctly (401 / 401 / 403 respectively).

> **Heads up if you already had a session from an older build**: this
> replaces trust in the browser's own localStorage-recorded "I'm logged
> in as X" with a real server-issued credential. Anyone who was already
> "logged in" client-side before this change won't have a `folks_token`
> cookie yet, so their next booking attempt will correctly ask them to log
> in again rather than silently trusting old client state — that's the
> point of the change, not a bug.

## What "no database" means here

Each controller reads a JSON file, does a plain-array find/filter/push, and
writes the file back with `fs.promises`. `src/utils/jsonStore.js` is the
entire storage layer — about 20 lines. There's no ORM, no schema, no
migrations. A few consequences worth knowing:

- **Concurrent writes aren't safe.** Two requests writing to the same file
  at the exact same instant could race. Fine for local/demo use with one
  person clicking around; not something to point real traffic at.
- **`src/data/*.json` are pre-created and start empty** (`[]`), except
  `categories.json`, which holds the real service catalogue (the same data
  `public/categories-data.js` already had — mirrored here so it's available
  over `GET /api/v1/categories` too, even though the frontend doesn't call
  that endpoint yet).
- OTPs are **not** written to a file — they live in an in-memory `Map` in
  `otpController.js` and vanish on restart, which is the right behavior for
  a short-lived one-time code anyway.

## API reference

All endpoints return `{ success: boolean, message?: string, ...data }`.

| Method | Path                         | Body / Query                                  | Returns              |
|--------|------------------------------|------------------------------------------------|-----------------------|
| POST   | `/api/v1/otp`                | `{ mobile }`                                    | `{ demoOtp }` — no real SMS gateway, so the OTP is handed back directly (and logged server-side) so you can actually complete the flow |
| POST   | `/api/v1/otp/verify`         | `{ mobile, otp }`                               | `{ token }` on success |
| POST   | `/api/v1/users`              | `{ mobile, name, email }`                       | `{ user }` |
| PUT    | `/api/v1/users`               | full user object incl. `id`                     | `{ user }` |
| POST   | `/api/v1/addresses`          | address fields                                  | `{ address }` |
| PUT    | `/api/v1/addresses`           | address fields incl. `id`                       | `{ address }` |
| POST   | `/api/v1/bookings`           | `{ customer, services[], paymentMethod, amount }` | `{ booking }` |
| GET    | `/api/v1/bookings?userId=`   | —                                               | `{ bookings: [] }`, newest first |
| PUT    | `/api/v1/bookings/:id`       | `{ status: 'cancelled' }`                       | `{ booking }` |
| POST   | `/api/v1/professionals`      | Aadhaar/expertise application fields            | `{ application }` |
| GET    | `/api/v1/categories`          | —                                               | `{ categories: [] }` (bonus, unused by the frontend today) |

Try any of them directly:

```bash
curl -X POST http://localhost:3000/api/v1/otp \
  -H "Content-Type: application/json" \
  -d '{"mobile":"9876543210"}'
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
