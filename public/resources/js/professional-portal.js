/* =========================================================================
 FOLKS — professional-portal.js
 Drives professional-portal.html: the left-navigation dashboard a
 registered professional lands on after verifying through
 professional-onboarding.html. Sections (switched via the URL hash, so
 each one is linkable and the browser back button works):

   #profile         My Profile — account details, professional details
                    (application status) and saved addresses
   #bookings        My Bookings — upcoming / completed / cancelled
   #neighbourhoods  My Neighbourhoods — localities the professional serves
   #services        My Services — services on the professional's profile
   #earnings        My Earnings — totals derived from booking amounts

 Read-only by design; editing profile/addresses links to the existing
 profile.html editor rather than duplicating it here.

 Reuses session helpers from script.js (isLoggedIn, getCurrentUser,
 renderUserChip, postLogout) and FolksAPI (api.js) for every request.
 Wrapped in an IIFE so nothing here collides with other page scripts.
 ========================================================================= */

(function () {
    'use strict';

    const SECTIONS = ['profile', 'bookings', 'neighbourhoods', 'services', 'earnings'];
    const DEFAULT_SECTION = 'profile';
    const ALL_LOCALITIES_ID = '-1';

    const ctx = {
        user: null,
        professional: null,
        loaded: {},               // section -> true once rendered
        bookingsPromise: null,    // shared by My Bookings + My Earnings
        activeBookingTab: 'upcoming',
        bookings: []
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof FolksAPI === 'undefined' || typeof getCurrentUser === 'undefined') {
            return;
        }
        if (!document.getElementById('ppContent')) {
            return; // guard: only runs on this page
        }
        initPortal();
    });

    async function initPortal() {
        alert('Init Portal');
        let loggedIn = false;
        try {
            loggedIn = await isLoggedIn();
            alert('Is logged in: ' + loggedIn);
        } catch (err) {
            loggedIn = false;
        }
        const cachedUser = getCurrentUser();
        alert('Cached User:\n' + JSON.stringify(cachedUser, null, 2));
        
        if (!loggedIn || !cachedUser) {
            hide('ppLoading');
            show('ppGate');
            return;
        }

        const res = await FolksAPI.viewProfessional();
        hide('ppLoading');

        if (!res.success) {
            if (res.code === 401 || res.authExpired) {
                postLogout();
                show('ppGate');
                return;
            }
            if (res.code === 404 || res.code === 403) {
                show('ppNotPro');
                return;
            }
            showErr('ppLoadError', res.message || 'Could not load your dashboard. Please refresh and try again.');
            return;
        }
        alert('Queried professional:\n' + JSON.stringify(res.result, null, 2));
        
        ctx.professional = res.result || {};
        ctx.user = ctx.professional.user || cachedUser;
        if (ctx.professional.user) {
            renderUserChip(ctx.professional.user);
        }
        const firstName = String(ctx.user.fullName || 'there').trim().split(' ')[0];
        document.getElementById('ppGreeting').textContent = `Welcome back, ${firstName}`;

        show('ppContent');
        wireBookingTabs();
        window.addEventListener('hashchange', showSectionFromHash);
        showSectionFromHash();
    }

    /* ---- left-nav section switching ------------------------------------- */
    function showSectionFromHash() {
        const requested = (window.location.hash || '').replace('#', '');
        const section = SECTIONS.includes(requested) ? requested : DEFAULT_SECTION;

        document.querySelectorAll('[data-pp-nav]').forEach(link => {
            const active = link.dataset.ppNav === section;
            link.classList.toggle('is-active', active);
            if (active) {
                link.setAttribute('aria-current', 'page');
            }
            else {
                link.removeAttribute('aria-current');
            }
        });
        document.querySelectorAll('[data-pp-panel]').forEach(panel => {
            panel.hidden = panel.dataset.ppPanel !== section;
        });

        if (! ctx.loaded[section]) {
            ctx.loaded[section] = true;
            ({
                profile: loadProfile,
                bookings: loadBookings,
                neighbourhoods: loadNeighbourhoods,
                services: loadServices,
                earnings: loadEarnings
            })[section]();
        }
    }

    /* =====================================================================
     MY PROFILE
     ===================================================================== */
    function loadProfile() {
        alert('Called loadProfile');
        
        loadProfileDetails();
        loadProfessionalDetails();
        loadAddresses();
    }

    async function loadProfileDetails() {
        const grid = document.getElementById('ppProfileFields');
        // const res = await FolksAPI.viewUser();
        // const user = res.success && res.result ? res.result : ctx.user;
        // if (!res.success) {
        //     showErr('ppProfileError', res.message || 'Could not load your latest profile details.');
        // }
        // alert('Queried User (2nd time):\n' + JSON.stringify(res.result, null, 2));
        
        const user = ctx.professional.user;
        
        grid.innerHTML = [
            field('User ID', user.externalId),
            field('Full name', user.fullName),
            field('Email address', user.email),
            field('Primary phone', user.phone1),
            field('Secondary phone', user.phone2),
            field('User role', user.role),
            field('Account status', user.status),
            field('Member since', formatDate(user.createdAt))
        ].join('');
    }

    async function loadProfessionalDetails() {
        const pro = ctx.professional || {};
        const grid = document.getElementById('ppProFields');
        const badge = document.getElementById('ppStatusBadge');

        // Application status lives on the submitted identity document
        // (same source professional-dashboard.js uses).
        let doc = null;
        const res = await FolksAPI.viewDocuments();
        if (res.success && res.result && Array.isArray(res.result.items)) {
            doc = res.result.items[0] || null;
        }
        alert('Queried Document(s):\n' + JSON.stringify(res.result.items, null, 2));
        
        const rawStatus = doc && doc.verificationStatus ? doc.verificationStatus : (pro.status || '');
        const status = String(rawStatus).toUpperCase() === 'PENDING' ? 'Pending Review' : (rawStatus || '—');
        const meta = statusMeta(status);
        badge.textContent = status;
        badge.style.background = meta.bg;
        badge.style.color = meta.color;

        const exp = pro.experienceYears;
        grid.innerHTML = [
            field('Application ID', (doc && doc.applicationId) || pro.applicationId),
            field('Applied on', formatDate((doc && doc.createdAt) || pro.createdAt)),
            field('Years of experience', exp !== undefined && exp !== null && exp !== ''
                    ? `${exp} yr${Number(exp) === 1 ? '' : 's'}` : null),
            field('Serving cities', pro.servingCities)
        ].join('');

        const hint = document.getElementById('ppStatusHint');
        const s = String(status).toLowerCase();
        if (s.includes('reject')) {
            hint.textContent = 'Your application was not approved this time. Contact support if you think this is a mistake.';
            hint.hidden = false;
        } else if (s.includes('pending') || s.includes('review')) {
            hint.textContent = "We're reviewing your application — this usually takes 2–3 business days.";
            hint.hidden = false;
        }
    }

    async function loadAddresses() {
        const body = document.getElementById('ppAddressBody');
        const res = await FolksAPI.viewAddresses();
        if (!res.success) {
            body.innerHTML = '';
            showErr('ppAddressError', res.message || 'Could not fetch addresses. Please try again.');
            return;
        }
        alert('Queried Addres(s):\n' + JSON.stringify(res.result.items, null, 2));
        
        const addresses = (res.result && res.result.items) || [];
        if (addresses.length === 0) {
            body.innerHTML = `
        <div class="address-empty-state">
          <span class="address-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="2"/></svg>
          </span>
          <p>You haven't added an address yet.</p>
          <a href="profile.html" class="btn btn-primary btn-ripple">Add an Address</a>
        </div>`;
            return;
        }
        body.innerHTML = `<div class="address-list">${addresses.map(a => `
      <div class="address-entry">
        <div class="address-entry-header">
          <span class="address-entry-label">${esc(a.label || 'Address')}</span>
        </div>
        <div class="profile-fields-grid">${[
                field('Primary address line', a.addressLine1),
                field('Secondary address line', a.addressLine2),
                field('Locality', a.locality),
                field('City', a.city),
                field('State', a.province),
                field('Pincode', a.pincode)
            ].join('')}</div>
      </div>`).join('')}</div>`;
    }

    /* =====================================================================
     MY BOOKINGS (+ shared fetch for My Earnings)
     ===================================================================== */
    function fetchBookings() {
        if (!ctx.bookingsPromise) {
            ctx.bookingsPromise = FolksAPI.getBookings().then(result => {
                if (result.success) {
                    const items = (result.result && result.result.items) || [];
                    ctx.bookings = items.map(b => ({...b, _tab: classifyBooking(b)}));
                } else {
                    ctx.bookingsPromise = null; // allow a retry on next visit
                }
                return result;
            });
        }
        return ctx.bookingsPromise;
    }

    function classifyBooking(booking) {
        if (String(booking.status || '').toUpperCase() === 'CANCELLED')
            return 'cancelled';
        if (booking.scheduledAt && new Date(booking.scheduledAt).getTime() < Date.now())
            return 'past';
        return 'upcoming';
    }

    async function loadBookings() {
        show('ppBookingsLoading');
        hide('ppBookingsError');
        const result = await fetchBookings();
        
        hide('ppBookingsLoading');
        if (!result.success) {
            ctx.loaded.bookings = false;
            showErr('ppBookingsError', result.message || 'Could not load your bookings. Please try again.');
            return;
        }
        alert('Queried Bookings:\n' + JSON.stringify(result, null, 2));
        renderBookings();
    }

    function wireBookingTabs() {
        document.querySelectorAll('[data-pp-booking-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                ctx.activeBookingTab = btn.dataset.ppBookingTab;
                document.querySelectorAll('[data-pp-booking-tab]').forEach(b => b.classList.toggle('is-active', b === btn));
                renderBookings();
            });
        });
    }

    function renderBookings() {
        document.querySelectorAll('[data-pp-booking-tab]').forEach(btn => {
            const count = ctx.bookings.filter(b => b._tab === btn.dataset.ppBookingTab).length;
            const label = btn.querySelector('[data-pp-tab-count]');
            if (label)
                label.textContent = `(${count})`;
        });

        const list = document.getElementById('ppBookingsList');
        const filtered = ctx.bookings
                .filter(b => b._tab === ctx.activeBookingTab)
                .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

        document.getElementById('ppBookingsEmpty').hidden = filtered.length > 0;
        list.innerHTML = filtered.map(renderBookingCard).join('');
    }

    function renderBookingCard(booking) {
        const meta = {
            upcoming: {label: 'Upcoming', cls: 'booking-status-upcoming'},
            past: {label: 'Completed', cls: 'booking-status-past'},
            cancelled: {label: 'Cancelled', cls: 'booking-status-cancelled'}
        } [booking._tab];
        
        // const customer = booking.customerName;

        return `
    <article class="booking-card">
      <div class="booking-card-header">
        <p class="order-line-breadcrumb">Booking ${esc(booking.bookingId || '')}${booking.createdAt ? ' · Booked on ' + esc(formatDate(booking.createdAt)) : ''}</p>
        <span class="booking-status-badge ${meta.cls}">${meta.label}</span>
      </div>
      <h4>${esc(booking.serviceName || 'Service')}</h4>
      <p class="profile-field-label" style="text-transform:none; letter-spacing:0; margin-top: 0.3rem;">
        ${esc(formatDate(booking.scheduledAt))}${' - ' + esc(booking.timeSlot)}${' · ' + esc(booking.customerName)}${' · ' + esc(booking.customerContact)}
      </p>
      ${booking.address ? `<p class="profile-field-label" style="text-transform:none; letter-spacing:0;">${esc(booking.address)}</p>` : ''}
      ${amountOf(booking) ? `<p class="sku-price" style="margin-top: 0.4rem;">${formatInr(amountOf(booking))}</p>` : ''}
    </article>`;
    }

    /* =====================================================================
     MY NEIGHBOURHOODS
     ===================================================================== */
    async function loadNeighbourhoods() {
        alert('Loading Neighbourhoods ...');
        
        const container = document.getElementById('ppNeighbourhoods');
        const empty = document.getElementById('ppNeighbourhoodsEmpty');
        
        const res = await FolksAPI.viewProfessionalNeighbourhoods();
        if (! res.success) {
            ctx.loaded.neighbourhoods = false;
            showErr('ppNeighbourhoodsError', res.message || 'Could not load your servicing localities. Please try again.');
            return;
        }
        const nbhoods = (res.result && res.result.items) || [];
        if (nbhoods.length === 0) {
            container.innerHTML = '';
            empty.hidden = false;
            return;
        }
        empty.hidden = true;
        container.innerHTML = nbhoods
                .slice()
                .sort((a, b) => String(a.locality || '').localeCompare(String(b.locality || ''), undefined, {numeric: true, sensitivity: 'base'}))
                .map(n => chip(n.pincode ? `${n.locality} - ${n.pincode}` : (n.locality || n.name || n.neighbourhoodId)))
                .join('');
    }

    /* =====================================================================
     MY SERVICES
     ===================================================================== */
    async function loadServices() {
        alert('Loading Services ...');

        hide('ppServicesError');
        show('ppServicesLoading');

        // The category hierarchy (category › sub-category › services, each
        // service with its image) drives both the read view and the editor.
        // The professional's own services only decide which sub-categories
        // are selected.
        const [catRes, svcRes] = await Promise.all([
            ctx.hierarchy ? Promise.resolve({success: true, result: {items: ctx.hierarchy}}) : FolksAPI.viewCategories(),
            FolksAPI.viewProfessionalServices()
        ]);
        hide('ppServicesLoading');

        if (!catRes.success || !svcRes.success) {
            ctx.loaded.services = false;
            showErr('ppServicesError', (!catRes.success ? catRes.message : svcRes.message) || 'Could not load your services. Please try again.');
            return;
        }

        ctx.hierarchy = (catRes.result && catRes.result.items) || [];
        ctx.selectedSubIds = selectedSubCategoryIds(ctx.hierarchy, (svcRes.result && svcRes.result.items) || []);

        wireServicesEditor();
        renderServicesView();
    }

    /** Works out which sub-categories the professional has selected from the
     *  services GET /professionalServices returns. Matches on, in order: an
     *  explicit sub-category id on the item, the serviceId, then the service
     *  name — whichever the backend provides. */
    function selectedSubCategoryIds(hierarchy, items) {
        const bySubId = new Map(), byServiceId = new Map(), byName = new Map();
        const norm = v => String(v || '').trim().toLowerCase();
        hierarchy.forEach(cat => (cat.subCategories || []).forEach(sub => {
            bySubId.set(String(sub.categoryId), sub.categoryId);
            (sub.services || []).forEach(svc => {
                byServiceId.set(String(svc.serviceId), sub.categoryId);
                byName.set(norm(svc.name), sub.categoryId);
            });
        }));

        const selected = new Set();
        items.forEach(it => {
            const subId = [it.subCategoryId, it.categoryId].find(v => v !== undefined && v !== null && bySubId.has(String(v)));
            if (subId !== undefined) {
                selected.add(String(subId));
                return;
            }
            if (it.serviceId !== undefined && byServiceId.has(String(it.serviceId))) {
                selected.add(String(byServiceId.get(String(it.serviceId))));
                return;
            }
            const name = norm(it.serviceName || it.name);
            if (byName.has(name))
                selected.add(String(byName.get(name)));
        });
        return selected;
    }

    /* ---- read view: category › sub-category › service cards -------------- */
    function renderServicesView() {
        const container = document.getElementById('ppServices');
        const empty = document.getElementById('ppServicesEmpty');

        document.getElementById('ppServicesEditor').hidden = true;
        container.hidden = false;
        document.getElementById('ppServicesEditBtn').hidden = false;
        document.getElementById('ppServicesCancelBtn').hidden = true;
        document.getElementById('ppServicesSaveBtn').hidden = true;
        document.getElementById('ppServicesHint').textContent =
                'Services you\'re set up to take bookings for, grouped by category and sub-category.';

        const groups = ctx.hierarchy
                .map(cat => ({cat, subs: (cat.subCategories || []).filter(sub => ctx.selectedSubIds.has(String(sub.categoryId)))}))
                .filter(g => g.subs.length > 0);

        if (groups.length === 0) {
            container.innerHTML = '';
            empty.hidden = false;
            return;
        }
        empty.hidden = true;

        container.innerHTML = groups.map(({cat, subs}) => `
      <section class="pp-svc-cat">
        <h3 class="pp-svc-cat-title">${esc(cat.name)}</h3>
        ${subs.map(sub => {
            const services = sub.services || [];
            return `
          <div class="pp-svc-sub">
            <div class="pp-svc-sub-head">
              <span class="pp-svc-sub-name">${esc(sub.name)}</span>
              <span class="pp-svc-sub-count">${services.length} service${services.length === 1 ? '' : 's'}</span>
            </div>
            ${services.length ? `
            <div class="pp-svc-grid">
              ${services.map(svc => `
                <div class="pp-svc-card">
                  <img src="${esc(svc.image || sub.image || cat.image || '')}" alt="${esc(svc.name)}" loading="lazy">
                  <span>${esc(svc.name)}</span>
                </div>`).join('')}
            </div>` : '<p class="modal-hint">No services listed under this sub-category yet.</p>'}
          </div>`;
        }).join('')}
      </section>`).join('');
    }

    /* ---- edit view: choose sub-categories under each category ------------ */
    function renderServicesEditor() {
        const editor = document.getElementById('ppServicesEditor');
        document.getElementById('ppServices').hidden = true;
        document.getElementById('ppServicesEmpty').hidden = true;
        editor.hidden = false;
        document.getElementById('ppServicesEditBtn').hidden = true;
        document.getElementById('ppServicesCancelBtn').hidden = false;
        document.getElementById('ppServicesSaveBtn').hidden = false;
        document.getElementById('ppServicesHint').textContent =
                'Tap a sub-category to select it — you\'ll take bookings for every service under it. Tap a selected one again to remove it.';

        // Each sub-category is a clickable image tile wrapping a real (visually
        // hidden) checkbox, so it works with mouse, touch and keyboard.
        editor.innerHTML = ctx.hierarchy.map(cat => `
      <section class="pp-svc-cat pp-svc-edit-cat">
        <h3 class="pp-svc-cat-title">${esc(cat.name)}</h3>
        <div class="pp-sub-grid">
          ${(cat.subCategories || []).map(sub => {
            const count = (sub.services || []).length;
            return `
            <label class="pp-sub-tile">
              <input type="checkbox" value="${esc(sub.categoryId)}" data-pp-sub ${ctx.draftSubIds.has(String(sub.categoryId)) ? 'checked' : ''}>
              <span class="pp-sub-tile-media">
                <img src="${esc(sub.image || cat.image || '')}" alt="" loading="lazy">
                <span class="pp-sub-tile-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </span>
              <span class="pp-sub-tile-body">
                <span class="pp-sub-tile-name">${esc(sub.name)}</span>
                <span class="pp-sub-tile-count">${count} service${count === 1 ? '' : 's'}</span>
              </span>
            </label>`;
          }).join('')}
        </div>
      </section>`).join('');

        editor.querySelectorAll('[data-pp-sub]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked)
                    ctx.draftSubIds.add(cb.value);
                else
                    ctx.draftSubIds.delete(cb.value);
                hide('ppServicesError');
            });
        });
    }

    function wireServicesEditor() {
        if (ctx.servicesEditorWired)
            return;
        ctx.servicesEditorWired = true;

        const editBtn = document.getElementById('ppServicesEditBtn');
        const cancelBtn = document.getElementById('ppServicesCancelBtn');
        const saveBtn = document.getElementById('ppServicesSaveBtn');

        editBtn.addEventListener('click', () => {
            ctx.draftSubIds = new Set(ctx.selectedSubIds);
            hide('ppServicesError');
            renderServicesEditor();
        });

        cancelBtn.addEventListener('click', () => {
            hide('ppServicesError');
            renderServicesView();
        });

        saveBtn.addEventListener('click', async () => {
            hide('ppServicesError');
            if (ctx.draftSubIds.size === 0) {
                showErr('ppServicesError', 'Select at least one sub-category to keep taking bookings.');
                return;
            }

            // Keep the ids' original type (number vs string) as the hierarchy has them.
            const ids = [];
            ctx.hierarchy.forEach(cat => (cat.subCategories || []).forEach(sub => {
                if (ctx.draftSubIds.has(String(sub.categoryId)))
                    ids.push(sub.categoryId);
            }));

            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            
            alert(JSON.stringify(ids));
            const res = await FolksAPI.updateProfessionalServices(ids);
            
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            saveBtn.textContent = 'Save';

            if (!res.success) {
                showErr('ppServicesError', res.message || 'Could not save your services. Please try again.');
                return;
            }

            // Re-read from the server rather than trusting the local draft, so
            // the view always shows what was actually stored.
            const svcRes = await FolksAPI.viewProfessionalServices();
            if (svcRes.success) {
                ctx.selectedSubIds = selectedSubCategoryIds(ctx.hierarchy, (svcRes.result && svcRes.result.items) || []);
            } else {
                ctx.selectedSubIds = new Set(ctx.draftSubIds);
            }
            renderServicesView();
        });
    }

    /* =====================================================================
     MY EARNINGS
     ===================================================================== */
    async function loadEarnings() {
        alert('Loading Earnings ...');
        
        show('ppEarningsLoading');
        hide('ppEarningsError');
        const result = await fetchBookings();
        hide('ppEarningsLoading');
        if (!result.success) {
            ctx.loaded.earnings = false;
            showErr('ppEarningsError', result.message || 'Could not load your earnings. Please try again.');
            return;
        }

        const completed = ctx.bookings.filter(b => b._tab === 'past');
        const upcoming = ctx.bookings.filter(b => b._tab === 'upcoming');
        const sum = list => list.reduce((total, b) => total + (amountOf(b) || 0), 0);

        document.getElementById('ppEarnCompleted').textContent = formatInr(sum(completed));
        document.getElementById('ppEarnUpcoming').textContent = formatInr(sum(upcoming));
        document.getElementById('ppEarnJobs').textContent = completed.length;

        const listEl = document.getElementById('ppEarningsList');
        if (completed.length === 0) {
            listEl.innerHTML = '';
            show('ppEarningsEmpty');
            return;
        }
        hide('ppEarningsEmpty');
        listEl.innerHTML = completed
                .slice()
                .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0))
                .map(b => `
      <div class="profile-field" style="flex-direction: row; align-items: center; justify-content: space-between; gap: var(--space-sm); border-bottom: 1px solid var(--color-line); padding-block: 0.6rem;">
        <span>
          <span class="profile-field-value" style="padding-block: 0; display:block;">${esc(b.serviceName || 'Service')}</span>
          <span class="profile-field-label" style="text-transform:none; letter-spacing:0;">${esc(formatDate(b.scheduledAt))}</span>
        </span>
        <span class="sku-price">${formatInr(amountOf(b) || 0)}</span>
      </div>`).join('');
    }

    /* ---- helpers --------------------------------------------------------- */
    function amountOf(booking) {
        const value = booking.totalAmount !== undefined ? booking.totalAmount : booking.amount;
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function formatInr(n) {
        return '₹' + Number(n || 0).toLocaleString('en-IN');
    }

    function statusMeta(status) {
        const s = String(status || '').toLowerCase();
        if (s.includes('approve') || s.includes('active') || s.includes('verified'))
            return {bg: 'var(--color-sage-20)', color: 'var(--color-sage)'};
        if (s.includes('reject') || s.includes('declin') || s.includes('suspend'))
            return {bg: 'var(--color-error-10)', color: 'var(--color-error)'};
        return {bg: 'var(--color-gold-20)', color: 'var(--color-clay-dark)'};
    }

    function field(label, value) {
        const v = value !== undefined && value !== null && value !== '' ? value : '—';
        return `
    <div class="profile-field">
      <span class="profile-field-label">${esc(label)}</span>
      <span class="profile-field-value">${esc(v)}</span>
    </div>`;
    }

    function chip(text) {
        return `
    <span class="pro-expertise-chip">
      <span style="background: var(--color-clay); border-color: var(--color-clay); color: var(--color-cream);">${esc(text)}</span>
    </span>`;
    }

    function formatDate(value) {
        if (!value)
            return null;
        const d = new Date(value);
        if (isNaN(d.getTime()))
            return String(value);
        return d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
    }

    function show(id) {
        const el = document.getElementById(id);
        if (el)
            el.hidden = false;
    }
    function hide(id) {
        const el = document.getElementById(id);
        if (el)
            el.hidden = true;
    }
    function showErr(id, msg) {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.textContent = msg;
        el.hidden = false;
    }
    function esc(str) {
        const div = document.createElement('div');
        div.textContent = String(str === undefined || str === null ? '' : str);
        return div.innerHTML;
    }
})();
