/* =========================================================================
 FOLKS — admin-dashboard.js
 Drives admin-dashboard.html: the left-nav tab shell plus one loader/render
 pair per tab. No client-side router/history — tabs are plain show/hide,
 matching the rest of this codebase's "no framework" approach.

 Each tab is only fetched the first time it's opened (see ADMIN_TABS below);
 the filter pills on Professional Applications / Bookings re-fetch with a
 status query param each time they're clicked, since that's a different
 slice of data, not just a client-side re-render.

 ASSUMPTIONS flagged inline below are places this reads a handful of likely
 backend field names/shapes defensively because the exact Vert.x response
 contract for the admin list endpoints isn't confirmed yet. Once it is,
 trim each spot down to the one real field name instead of guessing.
 ========================================================================= */

/**
 * One entry per left-nav tab. `load(status)` does the fetch + render for
 * that tab; `loaded` tracks whether it's already been fetched once (so
 * switching tabs back and forth doesn't re-hit the network). Adding a new
 * tab later is: a nav button + panel in the HTML, and one more entry here.
 */
const ADMIN_TABS = {
    overview: {title: 'Overview', loaded: false, load: loadOverview},
    professionals: {title: 'Professional Applications', loaded: false, load: loadProfessionals},
    bookings: {title: 'Bookings', loaded: false, load: loadBookings},
    customers: {title: 'Customers', loaded: false, load: loadCustomers}
};

document.addEventListener('DOMContentLoaded', () => {
    if (!adminIsLoggedIn() || !getCurrentAdmin()) {
        document.getElementById('adminGate').hidden = false;
        document.getElementById('adminShell').hidden = true;
        return;
    }

    document.getElementById('adminGate').hidden = true;
    document.getElementById('adminShell').hidden = false;

    initAdminTopbar();
    initAdminNav();
    initFilterBar('professionalsFilterBar', (status) => loadProfessionals(status));
    initFilterBar('bookingsFilterBar', (status) => loadBookings(status));
    initAdminLogout();

    // Overview is the default open tab.
    switchAdminTab('overview');
});

/* ---- topbar: who's logged in ------------------------------------------- */
function initAdminTopbar() {
    const admin = getCurrentAdmin() || {};
    const name = admin.fullName || admin.externalId || 'Admin';
    document.getElementById('adminTopbarName').textContent = name;
    document.getElementById('adminTopbarAvatar').textContent = name.charAt(0).toUpperCase();
}

/* ---- left nav: tab switching -------------------------------------------- */
function initAdminNav() {
    document.querySelectorAll('.admin-nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
    });
}

function switchAdminTab(tab) {
    const entry = ADMIN_TABS[tab];
    if (!entry) return;

    document.querySelectorAll('.admin-nav-item[data-tab]').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.hidden = panel.id !== `adminPanel-${tab}`;
    });
    document.getElementById('adminTopbarTitle').textContent = entry.title;

    if (!entry.loaded) {
        entry.loaded = true;
        entry.load();
    }
}

/* ---- filter pills (Professional Applications / Bookings) --------------- */
function initFilterBar(containerId, onChange) {
    const bar = document.getElementById(containerId);
    if (!bar) return;
    bar.addEventListener('click', (e) => {
        const pill = e.target.closest('.admin-filter-pill');
        if (!pill) return;
        bar.querySelectorAll('.admin-filter-pill').forEach(p => p.classList.toggle('is-active', p === pill));
        onChange(pill.dataset.status || '');
    });
}

/* ---- logout -------------------------------------------------------------- */
function initAdminLogout() {
    document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
        await FolksAPI.logout(); // clears the shared _fks cookie server-side
        clearAdminSession();
        window.location.replace('admin-login.html');
    });
}

/* =========================================================================
 OVERVIEW
 Pulls all three list endpoints unfiltered/unpaged and either reads an
 aggregate count field off the response if the backend provides one, or
 falls back to tallying the returned items client-side. Whichever endpoints
 actually paginate by default will undercount the tally fallback until
 that's confirmed — flagged below at the point it matters.
 ========================================================================= */
async function loadOverview() {
    const loading = document.getElementById('overviewLoading');
    const errorEl = document.getElementById('overviewError');
    loading.hidden = false;
    errorEl.hidden = true;

    const [proRes, userRes, bookingRes] = await Promise.all([
        FolksAPI.viewAllProfessionals(),
        FolksAPI.viewAllUsers(),
        FolksAPI.viewAllBookings()
    ]);

    loading.hidden = true;

    if (!proRes.success || !userRes.success || !bookingRes.success) {
        errorEl.textContent = [proRes, userRes, bookingRes].find(r => !r.success)?.message
            || 'Could not load the dashboard summary. Please try again.';
        errorEl.hidden = false;
        return;
    }

    const professionals = itemsOf(proRes.result);
    const users = itemsOf(userRes.result);
    const bookings = itemsOf(bookingRes.result);

    // ASSUMPTION: prefer an aggregate count field (count/total) over
    // items.length, since items.length only reflects one page if the
    // backend paginates by default.
    const totalProfessionals = countOf(proRes.result, professionals);
    const totalCustomers = countOf(userRes.result, users);
    const totalBookings = countOf(bookingRes.result, bookings);

    const proStatusCounts = tallyByField(professionals, ['status', 'verificationStatus', 'applicationStatus']);
    const bookingStatusCounts = tallyByField(bookings, ['status']);

    setText('statTotalProfessionals', totalProfessionals);
    setText('statPendingProfessionals', proStatusCounts.PENDING || 0);
    setText('statApprovedProfessionals', proStatusCounts.APPROVED || proStatusCounts.ACTIVE || 0);
    setText('statTotalCustomers', totalCustomers);

    setText('statTotalBookings', totalBookings);
    setText('statPendingBookings', bookingStatusCounts.PENDING || 0);
    setText('statCompletedBookings', bookingStatusCounts.COMPLETED || 0);
    setText('statCancelledBookings', bookingStatusCounts.CANCELLED || 0);
}

/* =========================================================================
 PROFESSIONAL APPLICATIONS
 ========================================================================= */
async function loadProfessionals(status) {
    const loading = document.getElementById('professionalsLoading');
    const errorEl = document.getElementById('professionalsError');
    const emptyEl = document.getElementById('professionalsEmpty');
    const body = document.getElementById('professionalsTableBody');

    loading.hidden = false;
    errorEl.hidden = true;
    emptyEl.hidden = true;
    body.innerHTML = '';

    const res = await FolksAPI.viewAllProfessionals(status ? {status} : undefined);
    loading.hidden = true;

    if (!res.success) {
        errorEl.textContent = res.message || 'Could not load professional applications. Please try again.';
        errorEl.hidden = false;
        return;
    }

    const items = itemsOf(res.result);
    if (items.length === 0) {
        emptyEl.hidden = false;
        return;
    }

    body.innerHTML = items.map(p => {
        // ASSUMPTION: field names below (name/appliedOn/status) are the most
        // likely candidates based on professional-dashboard.js's usage of
        // the single-record GET /professionals/:id and GET /documents
        // responses — confirm against the real admin list response.
        const name = p.fullName || p.name || '—';
        const appliedOn = formatAdminDate(p.appliedOn || p.createdAt || p.applicationDate);
        const experience = (p.experienceYears !== undefined && p.experienceYears !== null && p.experienceYears !== '')
            ? `${p.experienceYears} yr${Number(p.experienceYears) === 1 ? '' : 's'}` : '—';
        const cities = p.servingCities || '—';
        const status = p.status || p.verificationStatus || p.applicationStatus || 'PENDING';

        return `
      <tr>
        <td>${escapeAdminHtml(name)}</td>
        <td>${appliedOn}</td>
        <td>${escapeAdminHtml(String(experience))}</td>
        <td>${escapeAdminHtml(String(cities))}</td>
        <td>${adminBadge(status)}</td>
      </tr>
    `;
    }).join('');
}

/* =========================================================================
 BOOKINGS
 ========================================================================= */
async function loadBookings(status) {
    const loading = document.getElementById('bookingsLoading');
    const errorEl = document.getElementById('bookingsError');
    const emptyEl = document.getElementById('bookingsEmpty');
    const body = document.getElementById('bookingsTableBody');

    loading.hidden = false;
    errorEl.hidden = true;
    emptyEl.hidden = true;
    body.innerHTML = '';

    const res = await FolksAPI.viewAllBookings(status ? {status} : undefined);
    loading.hidden = true;

    if (!res.success) {
        errorEl.textContent = res.message || 'Could not load bookings. Please try again.';
        errorEl.hidden = false;
        return;
    }

    const items = itemsOf(res.result);
    if (items.length === 0) {
        emptyEl.hidden = false;
        return;
    }

    body.innerHTML = items.map(b => {
        const id = b.bookingId || b.id || '—';
        const customer = b.customerName || (b.customer && b.customer.name) || '—';
        const professional = b.professionalName || (b.professional && b.professional.name) || '—';
        const service = b.serviceName || '—';
        const scheduled = formatAdminDate(b.scheduledAt);
        const status = b.status || 'PENDING';

        return `
      <tr>
        <td>${escapeAdminHtml(String(id))}</td>
        <td>${escapeAdminHtml(customer)}</td>
        <td>${escapeAdminHtml(professional)}</td>
        <td>${escapeAdminHtml(service)}</td>
        <td>${scheduled}</td>
        <td>${adminBadge(status)}</td>
      </tr>
    `;
    }).join('');
}

/* =========================================================================
 CUSTOMERS
 ========================================================================= */
async function loadCustomers() {
    const loading = document.getElementById('customersLoading');
    const errorEl = document.getElementById('customersError');
    const emptyEl = document.getElementById('customersEmpty');
    const body = document.getElementById('customersTableBody');

    loading.hidden = false;
    errorEl.hidden = true;
    emptyEl.hidden = true;
    body.innerHTML = '';

    const res = await FolksAPI.viewAllUsers();
    loading.hidden = true;

    if (!res.success) {
        errorEl.textContent = res.message || 'Could not load customers. Please try again.';
        errorEl.hidden = false;
        return;
    }

    const items = itemsOf(res.result);
    if (items.length === 0) {
        emptyEl.hidden = false;
        return;
    }

    body.innerHTML = items.map(u => {
        const name = u.fullName || u.name || '—';
        const mobile = u.phone1 || u.mobile || '—';
        const email = u.email || '—';
        const joined = formatAdminDate(u.createdAt || u.joinedOn);

        return `
      <tr>
        <td>${escapeAdminHtml(name)}</td>
        <td>${escapeAdminHtml(String(mobile))}</td>
        <td>${escapeAdminHtml(email)}</td>
        <td>${joined}</td>
      </tr>
    `;
    }).join('');
}

/* ---- shared helpers ------------------------------------------------------ */

/** Normalizes a list response to a plain array regardless of the wrapper
 * field name (items vs results vs data — ASSUMPTION: `items` is the
 * convention seen elsewhere in this codebase, e.g. GET /bookings, GET
 * /documents; kept flexible in case the admin endpoints differ). */
function itemsOf(result) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    return result.items || result.results || result.data || [];
}

/** Prefers an explicit aggregate count field over items.length. */
function countOf(result, items) {
    if (!result) return items.length;
    return result.count ?? result.total ?? items.length;
}

function tallyByField(items, candidateFields) {
    const counts = {};
    items.forEach(item => {
        const field = candidateFields.find(f => item[f] !== undefined && item[f] !== null);
        const value = field ? String(item[field]).toUpperCase() : null;
        if (value) counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
}

function adminBadge(status) {
    const s = String(status || '').toUpperCase();
    const cls = {
        PENDING: 'admin-badge-pending',
        APPROVED: 'admin-badge-approved',
        ACTIVE: 'admin-badge-active',
        COMPLETED: 'admin-badge-completed',
        REJECTED: 'admin-badge-rejected',
        CANCELLED: 'admin-badge-cancelled'
    }[s] || 'admin-badge-neutral';
    return `<span class="admin-badge ${cls}">${escapeAdminHtml(s || 'UNKNOWN')}</span>`;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = (value === undefined || value === null) ? '—' : value;
}

function formatAdminDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
    } catch (err) {
        return String(value);
    }
}

function escapeAdminHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
