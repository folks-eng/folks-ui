/* =========================================================================
 HEARTH — admin-session.js
 The admin equivalent of script.js's customer session helpers (isLoggedIn,
 getCurrentUser, ...), but kept separate on purpose: own localStorage keys
 so an admin session never mixes with a customer/professional session in
 the same browser.

 Loaded by BOTH admin-login.html and admin-dashboard.html. It must stay
 free of any page-specific behaviour (no DOMContentLoaded handlers, no
 redirects) — that's what admin-login.js is for. Putting the
 "already logged in? redirect to the dashboard" check in here, instead of
 in admin-login.js, previously caused admin-dashboard.html to redirect to
 itself in a loop (it loaded admin-login.js too, for these same helper
 functions, and that check fired there as well) — reloading the whole page,
 and with it, re-running loadOverview() and every other tab's fetch, over
 and over. Splitting the helpers out into this file is the actual fix.

 The server is the real source of truth (the _fks cookie + its `priv`
 claim, checked by auth.js's requireAdmin on every admin API call). What's
 cached here is only a UI convenience so admin-dashboard.html doesn't have
 to hit the network just to decide whether to show the login gate or the
 dashboard shell.
 ========================================================================= */

const ADMIN_STORAGE_KEYS = {
    session: 'hearth_admin_logged_in',
    user: 'hearth_admin_user'
};

function adminIsLoggedIn() {
    try {
        return localStorage.getItem(ADMIN_STORAGE_KEYS.session) === 'true';
    } catch (err) {
        return false;
    }
}

function getCurrentAdmin() {
    try {
        const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.user);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
}

function saveAdminSession(admin) {
    try {
        localStorage.setItem(ADMIN_STORAGE_KEYS.user, JSON.stringify(admin));
        localStorage.setItem(ADMIN_STORAGE_KEYS.session, 'true');
    } catch (err) {
        console.warn('[Hearth Admin] Could not persist admin session (safe to ignore):', err);
    }
}

function clearAdminSession() {
    try {
        localStorage.removeItem(ADMIN_STORAGE_KEYS.user);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.session);
    } catch (err) { /* no-op */ }
}
