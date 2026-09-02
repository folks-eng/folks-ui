/* =========================================================================
 FOLKS — professional-dashboard.js
 Drives the Professional Dashboard page: the screen a Folks professional
 lands on instead of the regular customer experience. Shows their
 application status, the expertise areas they applied with, and a summary
 of their booking activity (no browsing/booking UI lives here — this is a
 read-only account screen, not a storefront).

 Reads session helpers from script.js (getCurrentUser, saveCurrentUser,
 isLoggedIn) and calls FolksAPI (api.js) for the actual GET requests. No
 network calls happen directly in this file.
 ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCurrentUser === 'undefined')
        return; // guard: only runs on this page
    initProfessionalDashboardPage();
});

function initProfessionalDashboardPage() {
    const gate = document.getElementById('proDashGate');
    const notPro = document.getElementById('proDashNotPro');
    const content = document.getElementById('proDashContent');
    if (!gate || !notPro || !content)
        return;

    const showEl = (el) => {
        if (el)
            el.hidden = false;
    };
    const hideEl = (el) => {
        if (el)
            el.hidden = true;
    };

    if (!isLoggedIn() || !getCurrentUser()) {
        showEl(gate);
        hideEl(notPro);
        hideEl(content);
        document.getElementById('proDashGateLoginBtn')?.addEventListener('click', () => {
            document.getElementById('loginBtn')?.click();
        });
        return;
    }

    hideEl(gate);
    loadProfessional(notPro, content, showEl, hideEl);
}

async function loadProfessional(notPro, content, showEl, hideEl) {
    const cached = getCurrentUser();

    let user = cached;
    const res = await FolksAPI.viewUser(cached.externalId || cached.id);
    if (res.success && res.result) {
        user = res.result;
        saveCurrentUser(user); // keep the cached copy (and header chip) fresh
        renderUserChip(user);
    }

    if (!isProfessionalUser(user)) {
        hideEl(content);
        showEl(notPro);
        return;
    }

    hideEl(notPro);
    showEl(content);

    renderGreeting(user);
    renderApplicationStatus(user);
    renderExpertise(user);
    loadBookingActivity();
}

function isProfessionalUser(user) {
    return String((user || {}).role || '').toUpperCase() === 'PROFESSIONAL';
}

/* ---- header / greeting -------------------------------------------------- */
function renderGreeting(user) {
    const heading = document.getElementById('proDashGreeting');
    if (!heading)
        return;
    const firstName = (user.fullName || 'there').trim().split(' ')[0];
    heading.textContent = `Welcome back, ${firstName}`;
}

/* ---- application status card -------------------------------------------- */
function renderApplicationStatus(user) {
    const status = user.professionalStatus || user.applicationStatus || 'Pending Review';
    const applicationId = user.applicationId || user.professionalApplicationId || user.applicationNumber;
    const appliedOn = user.professionalAppliedOn || user.appliedOn || user.professionalSubmittedOn || user.createdAt;
    const experienceYears = user.experienceYears ?? user.yearsOfExperience;
    const servingCities = user.servingCities || user.servingCity;

    const badge = document.getElementById('proDashStatusBadge');
    const meta = statusMetaPro(status);
    badge.textContent = status;
    badge.style.background = meta.bg;
    badge.style.color = meta.color;

    setText('proDashApplicationId', applicationId);
    setText('proDashAppliedOn', formatDatePro(appliedOn));
    setText('proDashExperience', experienceYears !== undefined && experienceYears !== null && experienceYears !== ''
            ? `${experienceYears} yr${Number(experienceYears) === 1 ? '' : 's'}` : null);
    setText('proDashServingCities', servingCities);

    const hint = document.getElementById('proDashStatusHint');
    const hintByStatus = {
        pending: "We're reviewing your application — this usually takes 2–3 business days.",
        rejected: 'Your application was not approved this time. Contact support if you think this is a mistake.',
    };
    const key = String(status).toLowerCase().includes('reject') ? 'rejected'
            : String(status).toLowerCase().includes('approve') || String(status).toLowerCase().includes('active') ? null
            : 'pending';
    if (key && hintByStatus[key]) {
        hint.textContent = hintByStatus[key];
        hint.hidden = false;
    } else {
        hint.hidden = true;
    }
}

function statusMetaPro(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('approve') || s.includes('active'))
        return {bg: 'var(--color-sage-20)', color: 'var(--color-sage)'};
    if (s.includes('reject') || s.includes('declin') || s.includes('suspend'))
        return {bg: 'var(--color-error-10)', color: 'var(--color-error)'};
    return {bg: 'var(--color-gold-20)', color: 'var(--color-clay-dark)'};
}

/* ---- expertise chips (read-only, sourced from CATEGORY hierarchy) ------- */
async function renderExpertise(user) {
    const container = document.getElementById('proDashExpertise');
    const emptyEl = document.getElementById('proDashExpertiseEmpty');
    if (!container)
        return;

    const selectedIds = (user.expertise || user.expertiseAreas || user.expertiseIds || []).map(String);

    if (selectedIds.length === 0) {
        container.innerHTML = '';
        emptyEl.hidden = false;
        return;
    }

    let idToName = {};
    const res = await FolksAPI.viewCategories();
    if (res.success && res.result && Array.isArray(res.result.items)) {
        res.result.items.forEach(cat => {
            (cat.subCategories || []).forEach(sub => {
                idToName[String(sub.categoryId)] = sub.name;
            });
        });
    }

    emptyEl.hidden = true;
    container.innerHTML = selectedIds.map(id => `
    <span class="pro-expertise-chip">
      <span style="background: var(--color-clay); border-color: var(--color-clay); color: var(--color-cream);">
        ${escapeHtmlProDash(idToName[id] || id)}
      </span>
    </span>
  `).join('');
}

/* ---- booking activity: reuses the same GET /bookings the customer
 "My Bookings" screen calls (the server scopes the result to whoever the
 session cookie identifies), classified the same way bookings.js does. --- */
async function loadBookingActivity() {
    const loading = document.getElementById('proDashBookingsLoading');
    const errorEl = document.getElementById('proDashBookingsError');
    const recentEl = document.getElementById('proDashRecentBookings');
    const emptyEl = document.getElementById('proDashBookingsEmpty');

    loading.hidden = false;
    errorEl.hidden = true;
    recentEl.innerHTML = '';
    emptyEl.hidden = true;

    const result = await FolksAPI.getBookings();
    loading.hidden = true;

    if (!result.success) {
        errorEl.textContent = result.message || 'Could not load your booking activity. Please try again.';
        errorEl.hidden = false;
        return;
    }

    const bookings = (result.result && result.result.items) || [];
    if (bookings.length === 0) {
        emptyEl.hidden = false;
        setText('proDashStatTotal', 0);
        setText('proDashStatCompleted', 0);
        setText('proDashStatUpcoming', 0);
        setText('proDashStatCancelled', 0);
        return;
    }

    const classified = bookings.map(b => ({...b, _tab: classifyBookingPro(b)}));
    const counts = {upcoming: 0, past: 0, cancelled: 0};
    classified.forEach(b => counts[b._tab]++);

    setText('proDashStatTotal', classified.length);
    setText('proDashStatCompleted', counts.past);
    setText('proDashStatUpcoming', counts.upcoming);
    setText('proDashStatCancelled', counts.cancelled);

    const recent = classified
            .slice()
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 5);
    recentEl.innerHTML = recent.map(renderRecentBookingRow).join('');
}

function classifyBookingPro(booking) {
    if (booking.status === 'CANCELLED')
        return 'cancelled';
    if (booking.scheduledAt < Date.now())
        return 'past';
    return 'upcoming';
}

function renderRecentBookingRow(booking) {
    const statusMeta = {
        upcoming: {label: 'Upcoming', cls: 'booking-status-upcoming'},
        past: {label: 'Completed', cls: 'booking-status-past'},
        cancelled: {label: 'Cancelled', cls: 'booking-status-cancelled'}
    }[booking._tab];
    const customer = booking.customerName || (booking.customer && booking.customer.name);

    return `
    <div class="profile-field" style="flex-direction: row; align-items: center; justify-content: space-between; gap: var(--space-sm); border-bottom: 1px solid var(--color-line); padding-block: 0.6rem;">
      <span>
        <span class="profile-field-value" style="padding-block: 0; display:block;">${escapeHtmlProDash(booking.serviceName || 'Service')}</span>
        <span class="profile-field-label" style="text-transform:none; letter-spacing:0;">
          ${formatDatePro(booking.scheduledAt)}${customer ? ' · ' + escapeHtmlProDash(customer) : ''}
        </span>
      </span>
      <span class="booking-status-badge ${statusMeta.cls}">${statusMeta.label}</span>
    </div>
  `;
}

/* ---- helpers -------------------------------------------------------------- */
function setText(id, value) {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.textContent = (value === undefined || value === null || value === '') ? '—' : value;
}

function formatDatePro(value) {
    if (!value)
        return null;
    try {
        return new Date(value).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
    } catch (err) {
        return value;
    }
}

function escapeHtmlProDash(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
