/* =========================================================================
 HEARTH — profile.js
 Drives the My Profile page: Profile Details + Address sections, each with
 independent Edit/Save/Cancel state. Reads/writes the session helpers
 defined in script.js (getCurrentUser, saveCurrentUser, getStoredAddress,
 saveStoredAddress, isLoggedIn, renderUserChip) and calls HearthAPI
 (api.js) for the actual PUT/POST requests. No network calls happen in
 this file directly.
 ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCurrentUser === 'undefined')
        return; // guard: only runs on profile.html
    initProfilePage();
});

function initProfilePage() {
    const gate = document.getElementById('profileGate');
    const content = document.getElementById('profileContent');
    if (!gate || !content)
        return;

    if (!isLoggedIn() || !getCurrentUser()) {
        gate.hidden = false;
        content.hidden = true;
        const gateSignupBtn = document.getElementById('profileGateSignupBtn');
        if (gateSignupBtn) {
            gateSignupBtn.addEventListener('click', () => {
                document.getElementById('signupBtn')?.click();
            });
        }
        return;
    }

    gate.hidden = true;
    content.hidden = false;

    initProfileDetailsSection();
    initAddressSection();
}

/* ---- SECTION 1: Profile Details ---------------------------------------- */
async function initProfileDetailsSection() {
    const grid = document.getElementById('profileFieldsGrid');
    const actions = document.getElementById('profileCardActions');
    const errorEl = document.getElementById('profileFormError');
    if (!grid) {
        return;
    }
    let editing = false;
    
    // Fetch the user details.
    let res = await HearthAPI.viewUser();
    if (! res.success) {
        if (res.message === 'Cookie expired') {
            showError(errorEl, 'Your session is expired. Forwarding you to the home screen ...');
            postLogout();
            window.location.href = "/";
        }
        else {
            showError(errorEl, res.message || 'Could fetch user details. Please try again.');
        }
        return;
    }
    let user = res.result;

    function render() {
        hideError(errorEl);

        if (!editing) {
            grid.innerHTML = [
                readField('User ID', user.externalId),
                readField('Full name', user.fullName),
                readField('Email address', user.email),
                readField('Primary phone', user.phone1),
                readField('Secondary phone', user.phone2),
                readField('User role', user.role || 'Customer'),
                readField('Account status', user.status || 'Active'),
                readField('Created On', formatDate(user.createdAt)),
                user.professionalStatus ? readField('Professional application', user.professionalStatus) : ''
            ].join('');

            actions.innerHTML = `<button type="button" class="btn btn-ghost btn-sm" id="profileEditBtn">Edit</button>`;
            document.getElementById('profileEditBtn').addEventListener('click', () => {
                editing = true;
                render();
            });
            return;
        }

        grid.innerHTML = [
            inputField('User ID', 'id', user.externalId, {disabled: true}),
            inputField('Full name', 'fullName', user.fullName, {required: true}),
            inputField('Email address', 'email', user.email, {type: 'email', required: true}),
            inputField('Primary phone', 'phone1', user.phone1, {type: 'tel', required: true}),
            inputField('Secondary phone', 'phone2', user.phone2, {type: 'tel'}),
            selectField('User role', 'role', user.role, ['CUSTOMER', 'PROFESSIONAL', 'ADMIN'], {disabled: true}),
            selectField('Account status', 'status', user.status, ['ACTIVE', 'INACTIVE', 'BLOCKED'], {disabled: true}),
            inputField('Created On', 'createdOn', formatDate(user.createdAt), {disabled: true})
        ].join('');

        actions.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" id="profileCancelBtn">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm btn-ripple" id="profileSaveBtn">Save</button>
    `;
        initRipple();

        document.getElementById('profileCancelBtn').addEventListener('click', () => {
            editing = false;
            render();
        });
        document.getElementById('profileSaveBtn').addEventListener('click', onSave);
    }

    async function onSave() {
        const id = grid.querySelector('[name="id"]').value.trim();
        const fullName = grid.querySelector('[name="fullName"]').value.trim();
        const email = grid.querySelector('[name="email"]').value.trim();
        const phone1 = grid.querySelector('[name="phone1"]').value.trim();
        const phone2 = grid.querySelector('[name="phone2"]').value.trim();
        // const role = grid.querySelector('[name="role"]').value;
        // const status = grid.querySelector('[name="status"]').value;

        if (fullName.length < 2)
            return showError(errorEl, 'Please enter a valid full name.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return showError(errorEl, 'Please enter a valid email address.');
        if (phone1.replace(/\D/g, '').length < 7)
            return showError(errorEl, 'Please enter a valid primary phone number.');
        if (phone2.replace(/\D/g, '').length < 7)
            return showError(errorEl, 'Please enter a valid secondary phone number.');

        const saveBtn = document.getElementById('profileSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        const payload = {...user, fullName, email, phone1, phone2};
        const res = await HearthAPI.updateUser(id, payload);
        
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';

        if (!res.success) {
            showError(errorEl, res.message || 'Could not save changes. Please try again.');
            return;
        }

        user = res.result;
        saveCurrentUser(user);
        renderUserChip(user); // keep the header chip's name in sync immediately
        editing = false;
        render();
    }

    render();
}

/* ---- SECTION 2: Address(es) ----------------------------------------------
 A person can save more than one address (Home, Work, ...). Each has its
 own card with its own Edit/Cancel/Save; a persistent "Add address"
 button sits above the list so adding another is always one click away.
 ------------------------------------------------------------------------ */
async function initAddressSection() {
    const actions = document.getElementById('addressCardActions');
    const body = document.getElementById('addressCardBody');
    const errorEl = document.getElementById('addressFormError');
    if (! body) {
        return;
    }

    let editingId = null; // id of the address card currently in edit mode, or 'new'

    // Fetch the address details.
    let res = await HearthAPI.viewAddresses();

    if (! res.success) {
        showError(errorEl, res.message || 'Could not fetch addresses. Please try again.');
        return;
    }
    let addresses = res.result.items;

    // Hearth only operates in selected states/cities/localities, so a new (or
    // relocated) address has to be pinned to a serviceable locality before
    // the rest of the address form is shown. The state list is small and
    // shared by every card, so it's fetched once up front; cities and
    // localities are fetched on demand as the customer narrows things down.
    let provincesRes = await HearthAPI.viewProvinces();
    let provinces = provincesRes.success ? (provincesRes.result.items || provincesRes.result || []) : [];
    if (!provincesRes.success) {
        console.error('[Hearth] Failed to load provinces:', provincesRes.message);
    }

    // Per-card location-picker state, keyed by the card's id attribute
    // ('new', or the numeric addressId). Kept outside render() so it
    // survives re-renders the same way `editingId` does.
    const locationState = {};

    function getLocationState(idAttr, address) {
        if (!locationState[idAttr]) {
            const state = {
                provinceId: (address && address.provinceId) || '',
                province: (address && address.province) || '',
                cityId: (address && address.cityId) || '',
                city: (address && address.city) || '',
                neighbourhoodId: (address && address.neighbourhoodId) || '',
                locality: (address && address.locality) || '',
                pincode: (address && address.pincode) || '',
                cities: [],
                neighbourhoods: [],
                loadingCities: false,
                loadingNeighbourhoods: false,
                // An existing, previously-saved address is assumed to already
                // sit in a serviceable locality; a brand-new one has to prove
                // it via the picker before the rest of the form appears.
                serviceable: address ? true : null,
                confirmed: !!address,
                // Existing addresses show their location as read-only text by
                // default; this flips to true once the customer asks to pick
                // a different state/city/locality for it.
                changingLocation: false,
                // 'pincode' (quick check, the default), 'pincode-results'
                // (a pincode matched more than one locality), or 'cascade'
                // (the full state → city → locality picker, reached via the
                // "pick manually" fallback).
                mode: 'pincode',
                pincodeInput: '',
                pincodeChecking: false,
                pincodeChecked: false,
                pincodeMatches: []
            };
            if (!state.provinceId && state.province) {
                const match = provinces.find(p => (p.provinceName || '').toLowerCase() === state.province.toLowerCase());
                if (match) {
                    state.provinceId = match.provinceId;
                }
            }
            // Snapshot of the saved location, so "Keep current location" can
            // discard an in-progress state/city/locality change and restore
            // exactly what the address had before Change location was clicked.
            state.original = {
                provinceId: state.provinceId,
                province: state.province,
                cityId: state.cityId,
                city: state.city,
                neighbourhoodId: state.neighbourhoodId,
                locality: state.locality,
                pincode: state.pincode
            };
            locationState[idAttr] = state;
        }
        return locationState[idAttr];
    }

    async function render() {
        hideError(errorEl);
        actions.innerHTML = editingId
                ? ''
                : `<button type="button" class="btn btn-primary btn-sm btn-ripple" id="addAddressBtn">+ Add Address</button>`;
        if (!editingId) {
            initRipple();
            document.getElementById('addAddressBtn').addEventListener('click', () => {
                editingId = 'new';
                render();
            });
        }

        const cards = addresses.map(a => renderAddressEntry(a, a.addressId === Number(editingId))).join('');
        const newCard = editingId === 'new' ? renderAddressEntry(null, true) : '';
        
        if (addresses.length === 0 && editingId !== 'new') {
            body.innerHTML = `
        <div class="address-empty-state">
          <span class="address-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="2"/></svg>
          </span>
          <p>You haven't added an address yet. Add one so professionals know exactly where to show up.</p>
          <button type="button" class="btn btn-primary btn-ripple" id="addAddressBtnEmpty">Add an Address</button>
        </div>
      `;
            initRipple();
            document.getElementById('addAddressBtnEmpty').addEventListener('click', () => {
                editingId = 'new';
                render();
            });
            return;
        }

        body.innerHTML = `<div class="address-list">${cards}${newCard}</div>`;
        initRipple();
        wireAddressEntries(addresses);
    }

    function renderAddressEntry(address, isEditing) {
        const isNew = !address;
        const idAttr = isNew ? 'new' : address.addressId;
        
        if (!isEditing) {
            return `
        <div class="address-entry" data-address-id="${idAttr}">
          <div class="address-entry-header">
            <span class="address-entry-label">${escapeHtmlP(address.label || 'Address')}</span>
            <div class="profile-card-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-address="${idAttr}">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" data-delete-address="${idAttr}" style="color: var(--color-error);">Delete</button>
            </div>
          </div>
          <div class="profile-fields-grid">${[
                readField('Primary address line', address.addressLine1),
                readField('Secondary address line', address.addressLine2),
                readField('Locality', address.locality),
                readField('City', address.city),
                readField('State', address.province),
                readField('Postal code', address.pincode),
                readField('Latitude', address.latitude),
                readField('Longitude', address.longitude)
            ].join('')}</div>
        </div>
      `;
        }

        const a = address || {};
        const loc = getLocationState(idAttr, address);
        const showPicker = isNew || loc.changingLocation;

        return `
      <div class="address-entry" data-address-id="${idAttr}">
        <div class="address-entry-header">
          <span class="address-entry-label">${isNew ? 'New address' : escapeHtmlP(a.label || 'Address')}</span>
        </div>

        ${renderLocationSection(idAttr, loc, isNew, showPicker)}

        <div class="profile-fields-grid" data-address-details="${idAttr}" style="margin-top: var(--space-sm);" ${loc.confirmed ? '' : 'hidden'}>
          ${selectField('Label', 'label', a.label || 'Home', ['Home', 'Work', 'Other'])}
          ${inputField('Primary address line', 'addressLine1', a.addressLine1, {required: true})}
          ${inputField('Secondary address line', 'addressLine2', a.addressLine2)}
          ${inputField('Postal code', 'pincode', loc.pincode, {required: true})}
          ${inputField('Latitude', 'latitude', a.latitude, {type: 'number', step: 'any'})}
          ${inputField('Longitude', 'longitude', a.longitude, {type: 'number', step: 'any'})}
        </div>
        <div class="profile-card-actions" style="margin-top: var(--space-sm);">
          <button type="button" class="btn btn-ghost btn-sm" data-cancel-address="${idAttr}">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm btn-ripple" data-save-address="${idAttr}" ${loc.confirmed ? '' : 'disabled'}>${isNew ? 'Submit' : 'Save'}</button>
        </div>
      </div>
    `;
    }

    /* ---- location picker (pincode-first, State → City → Locality fallback)
     Hearth only operates in selected states, cities and localities, so this
     gate has to be cleared — with a locality the backend reports as
     serviceable — before the rest of the address fields are shown.

     The quick path is a single pincode check (fast, familiar); it falls
     back to the explicit state → city → locality picker when the pincode
     isn't recognized or the customer would rather browse by name. An
     existing address shows its saved location as read-only text with a
     "Change location" escape hatch, rather than forcing a re-check.
     ------------------------------------------------------------------------ */
    function renderLocationSection(idAttr, loc, isNew, showPicker) {
        if (!showPicker) {
            return `
        <div class="profile-fields-grid">${[
                    readField('State', loc.province),
                    readField('City', loc.city),
                    readField('Locality', loc.locality)
                ].join('')}</div>
        <div class="profile-card-actions" style="margin-bottom: var(--space-sm);">
          <button type="button" class="btn btn-ghost btn-sm" data-change-location="${idAttr}">Change location</button>
        </div>
      `;
        }

        // Only shown while the customer is still narrowing things down — once
        // a serviceable locality is picked, the address form itself makes it
        // obvious they're good to continue.
        const intro = !loc.confirmed
                ? `<p class="modal-hint">Before you add this address, let's check Hearth is live in your area — enter your pincode.</p>`
                : '';

        let sectionBody;
        if (loc.mode === 'cascade') {
            sectionBody = renderCascadePicker(idAttr, loc, isNew);
        }
        else if (loc.mode === 'pincode-results') {
            sectionBody = renderPincodeResults(idAttr, loc, isNew);
        }
        else {
            sectionBody = renderPincodeCheck(idAttr, loc, isNew);
        }

        return `${intro}${sectionBody}`;
    }

    function renderPincodeCheck(idAttr, loc, isNew) {
        let status = '';
        if (loc.pincodeChecking) {
            status = `<p class="modal-hint">Checking…</p>`;
        }
        else if (loc.confirmed && loc.serviceable) {
            status = `<p class="modal-hint">Good news — we're live in ${escapeHtmlP(loc.locality || 'your area')}${loc.city ? ', ' + escapeHtmlP(loc.city) : ''}.</p>`;
        }
        else if (loc.pincodeChecked && loc.pincodeMatches.length === 0) {
            status = `<p class="modal-error">We don't recognize that pincode yet. Try again, or pick your state, city and locality manually.</p>`;
        }
        else if (loc.serviceable === false && loc.neighbourhoodId) {
            status = `<p class="modal-error">Hearth hasn't launched in ${escapeHtmlP(loc.locality || 'this area')} yet. Please try another pincode, or check back soon.</p>`;
        }

        return `
      <div class="profile-fields-grid">
        <div class="profile-field">
          <label class="profile-field-label" for="loc-pincode-${idAttr}">Pincode</label>
          <input id="loc-pincode-${idAttr}" name="locationPincode" type="text" inputmode="numeric" maxlength="6"
                 placeholder="e.g. 560034" value="${escapeAttrP(loc.pincodeInput)}">
        </div>
        ${loc.locality ? `
        <div class="profile-field">
          <label class="profile-field-label" for="loc-locality-preview-${idAttr}">Neighbourhood</label>
          <input id="loc-locality-preview-${idAttr}" type="text" value="${escapeAttrP(loc.locality)}" disabled>
        </div>` : ''}
      </div>
      ${status ? `<div style="margin-top: var(--space-sm);">${status}</div>` : ''}
      <div class="profile-card-actions" style="margin: var(--space-xs) 0 var(--space-sm);">
        <button type="button" class="btn btn-primary btn-sm" data-run-pincode-check="${idAttr}" ${loc.pincodeChecking ? 'disabled' : ''}>${loc.pincodeChecking ? 'Checking…' : 'Check availability'}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-browse-cascade="${idAttr}">Pick manually instead</button>
        ${!isNew ? `<button type="button" class="btn btn-ghost btn-sm" data-cancel-change-location="${idAttr}">Keep current location</button>` : ''}
      </div>
    `;
    }

    function renderPincodeResults(idAttr, loc, isNew) {
        const rows = loc.pincodeMatches.map(m => `
        <div class="address-entry" style="padding: var(--space-xs) var(--space-sm);">
          <div class="address-entry-header" style="margin-bottom: 0;">
            <span>${escapeHtmlP(m.pincode)}${m.cityName ? ', ' + escapeHtmlP(m.cityName) : ''}${m.locality ? ', ' + escapeHtmlP(m.locality) : ''}</span>
            <button type="button" class="btn btn-ghost btn-sm" data-pick-pincode-match="${idAttr}" data-match-id="${m.neighbourhoodId}">Select</button>
          </div>
        </div>
      `).join('');

        return `
      <p class="modal-hint">That pincode covers more than one locality — pick yours:</p>
      <div class="address-list" style="margin-bottom: var(--space-sm);">${rows}</div>
      <div class="profile-card-actions" style="margin-bottom: var(--space-sm);">
        <button type="button" class="btn btn-ghost btn-sm" data-browse-pincode="${idAttr}">Check a different pincode</button>
        <button type="button" class="btn btn-ghost btn-sm" data-browse-cascade="${idAttr}">Pick manually instead</button>
        ${!isNew ? `<button type="button" class="btn btn-ghost btn-sm" data-cancel-change-location="${idAttr}">Keep current location</button>` : ''}
      </div>
    `;
    }

    function renderCascadePicker(idAttr, loc, isNew) {
        let statusMsg = '';
        if (loc.serviceable === false) {
            statusMsg = `<p class="modal-error">Hearth hasn't launched in ${escapeHtmlP(loc.locality || 'this locality')} yet. Please pick another locality, or check back soon.</p>`;
        }
        else if (loc.cityId && !loc.loadingNeighbourhoods && loc.neighbourhoods.length === 0 && !loc.neighbourhoodId) {
            statusMsg = `<p class="modal-hint">No localities found for the selected city yet.</p>`;
        }

        return `
      <div class="profile-fields-grid">
        ${renderProvinceSelect(idAttr, loc)}
        ${renderCitySelect(idAttr, loc)}
        ${renderLocalitySelect(idAttr, loc)}
        ${loc.locality ? `
        <div class="profile-field">
          <label class="profile-field-label" for="loc-locality-preview-${idAttr}">Neighbourhood</label>
          <input id="loc-locality-preview-${idAttr}" type="text" value="${escapeAttrP(loc.locality)}" disabled>
        </div>` : ''}
      </div>
      ${statusMsg ? `<div style="margin-top: var(--space-sm);">${statusMsg}</div>` : ''}
      <div class="profile-card-actions" style="margin-bottom: var(--space-sm);">
        <button type="button" class="btn btn-ghost btn-sm" data-browse-pincode="${idAttr}">Check by pincode instead</button>
        ${!isNew ? `<button type="button" class="btn btn-ghost btn-sm" data-cancel-change-location="${idAttr}">Keep current location</button>` : ''}
      </div>
    `;
    }

    function renderProvinceSelect(idAttr, loc) {
        const options = provinces.map(p =>
            `<option value="${p.provinceId}" ${String(p.provinceId) === String(loc.provinceId) ? 'selected' : ''}>${escapeHtmlP(p.provinceName)}</option>`
        ).join('');
        return `
      <div class="profile-field">
        <label class="profile-field-label" for="loc-province-${idAttr}">State</label>
        <select id="loc-province-${idAttr}" data-role="province" data-address-id="${idAttr}">
          <option value="">Select a state…</option>
          ${options}
        </select>
      </div>
    `;
    }

    function renderCitySelect(idAttr, loc) {
        const disabled = !loc.provinceId || loc.loadingCities;
        const placeholder = loc.loadingCities ? 'Loading cities…' : (loc.provinceId ? 'Select a city…' : 'Select a state first…');
        const options = loc.cities.length
                ? loc.cities.map(c => `<option value="${c.cityId}" ${String(c.cityId) === String(loc.cityId) ? 'selected' : ''}>${escapeHtmlP(c.cityName)}</option>`).join('')
                : (loc.cityId ? `<option value="${loc.cityId}" selected>${escapeHtmlP(loc.city)}</option>` : '');
        return `
      <div class="profile-field">
        <label class="profile-field-label" for="loc-city-${idAttr}">City</label>
        <select id="loc-city-${idAttr}" data-role="city" data-address-id="${idAttr}" ${disabled ? 'disabled' : ''}>
          <option value="">${placeholder}</option>
          ${options}
        </select>
      </div>
    `;
    }

    function renderLocalitySelect(idAttr, loc) {
        const disabled = !loc.cityId || loc.loadingNeighbourhoods;
        const placeholder = loc.loadingNeighbourhoods ? 'Loading localities…' : (loc.cityId ? 'Select a locality…' : 'Select a city first…');
        const options = loc.neighbourhoods.length
                ? loc.neighbourhoods.map(n => `<option value="${n.neighbourhoodId}" ${String(n.neighbourhoodId) === String(loc.neighbourhoodId) ? 'selected' : ''}>${escapeHtmlP(n.locality)}${n.pincode ? ' — ' + escapeHtmlP(n.pincode) : ''}</option>`).join('')
                : (loc.neighbourhoodId ? `<option value="${loc.neighbourhoodId}" selected>${escapeHtmlP(loc.locality)}</option>` : '');
        return `
      <div class="profile-field">
        <label class="profile-field-label" for="loc-locality-${idAttr}">Locality</label>
        <select id="loc-locality-${idAttr}" data-role="locality" data-address-id="${idAttr}" ${disabled ? 'disabled' : ''}>
          <option value="">${placeholder}</option>
          ${options}
        </select>
      </div>
    `;
    }

    function wireAddressEntries(addresses) {
        body.querySelectorAll('[data-edit-address]').forEach(btn => {
            btn.addEventListener('click', () => {
                editingId = btn.dataset.editAddress;
                render();
            });
        });
        body.querySelectorAll('[data-cancel-address]').forEach(btn => {
            btn.addEventListener('click', () => {
                delete locationState[btn.dataset.cancelAddress];
                editingId = null;
                render();
            });
        });
        body.querySelectorAll('[data-delete-address]').forEach(btn => {
            btn.addEventListener('click', () => onDelete(btn.dataset.deleteAddress, addresses));
        });
        body.querySelectorAll('[data-save-address]').forEach(btn => {
            btn.addEventListener('click', () => onSave(btn.dataset.saveAddress, addresses));
        });
        body.querySelectorAll('[data-change-location]').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = locationState[btn.dataset.changeLocation];
                loc.changingLocation = true;
                loc.confirmed = false;
                // Always restart at the quick pincode check, even if the
                // address was last edited via the manual picker.
                loc.mode = 'pincode';
                loc.pincodeInput = '';
                loc.pincodeChecking = false;
                loc.pincodeChecked = false;
                loc.pincodeMatches = [];
                render();
            });
        });
        body.querySelectorAll('[data-cancel-change-location]').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = locationState[btn.dataset.cancelChangeLocation];
                // Discard whatever the customer had started picking and
                // restore the address's originally saved state/city/locality.
                Object.assign(loc, loc.original);
                loc.cities = [];
                loc.neighbourhoods = [];
                loc.loadingCities = false;
                loc.loadingNeighbourhoods = false;
                loc.changingLocation = false;
                loc.confirmed = true;
                loc.serviceable = true;
                loc.mode = 'pincode';
                loc.pincodeInput = '';
                loc.pincodeChecking = false;
                loc.pincodeChecked = false;
                loc.pincodeMatches = [];
                render();
            });
        });
        body.querySelectorAll('[data-browse-cascade]').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = locationState[btn.dataset.browseCascade];
                loc.mode = 'cascade';
                // A pincode check may have already resolved a locality/pincode;
                // discard those so the manual picker doesn't show a stale
                // Locality/Postal code left over from the pincode flow. State
                // and city are kept as a helpful starting point.
                loc.neighbourhoodId = '';
                loc.locality = '';
                loc.pincode = '';
                loc.confirmed = false;
                loc.serviceable = null;
                render();
                // Load the full city/locality lists for whatever state/city
                // is already known (from the saved address, or a pincode
                // match) so the dropdowns offer real alternatives instead of
                // just a single pre-selected value.
                primeLocationLists(loc);
            });
        });
        body.querySelectorAll('[data-browse-pincode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = locationState[btn.dataset.browsePincode];
                loc.mode = 'pincode';
                // Symmetric reset: don't carry a locality/pincode picked via
                // the manual selects into the quick-check view either.
                loc.neighbourhoodId = '';
                loc.locality = '';
                loc.pincode = '';
                loc.confirmed = false;
                loc.serviceable = null;
                loc.pincodeInput = '';
                loc.pincodeChecked = false;
                loc.pincodeMatches = [];
                render();
            });
        });
        body.querySelectorAll('[data-pick-pincode-match]').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = locationState[btn.dataset.pickPincodeMatch];
                const match = loc.pincodeMatches.find(m => String(m.neighbourhoodId) === btn.dataset.matchId);
                if (match) {
                    applyPincodeMatch(loc, match);
                    loc.mode = 'pincode';
                }
                render();
            });
        });
        body.querySelectorAll('[data-run-pincode-check]').forEach(btn => {
            btn.addEventListener('click', () => runPincodeCheck(btn.dataset.runPincodeCheck));
        });
        if (editingId !== null) {
            wireLocationPicker(editingId);
            const pincodeInput = body.querySelector(`#loc-pincode-${editingId}`);
            if (pincodeInput) {
                pincodeInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        runPincodeCheck(editingId);
                    }
                });
            }
        }
    }

    function applyPincodeMatch(loc, match) {
        loc.provinceId = match.provinceId || loc.provinceId;
        loc.province = match.provinceName || loc.province;
        loc.cityId = match.cityId || loc.cityId;
        loc.city = match.cityName || loc.city;
        loc.neighbourhoodId = match.neighbourhoodId;
        loc.locality = match.locality;
        loc.pincode = match.pincode || loc.pincodeInput;
        loc.serviceable = match.serviceable !== false;
        loc.confirmed = loc.serviceable;
    }

    async function runPincodeCheck(idAttr) {
        const loc = locationState[idAttr];
        if (!loc)
            return;
        const input = body.querySelector(`#loc-pincode-${idAttr}`);
        const pincode = (input ? input.value : '').trim();

        if (!/^[0-9]{6}$/.test(pincode)) {
            showError(errorEl, 'Please enter a valid 6-digit pincode.');
            return;
        }
        hideError(errorEl);

        loc.pincodeInput = pincode;
        loc.pincodeChecking = true;
        loc.pincodeChecked = false;
        loc.pincodeMatches = [];
        loc.confirmed = false;
        loc.serviceable = null;
        // Clear out whatever locality/city/state a previous check (or the
        // address's original saved location) had resolved, so the Locality
        // preview box doesn't keep showing stale data for the new pincode.
        loc.neighbourhoodId = '';
        loc.locality = '';
        loc.cityId = '';
        loc.city = '';
        loc.provinceId = '';
        loc.province = '';
        render();

        const res = await HearthAPI.checkPincode(pincode);
        loc.pincodeChecking = false;
        loc.pincodeChecked = true;

        if (!res.success) {
            showError(errorEl, res.message || 'Could not check that pincode. Please try again.');
            render();
            return;
        }

        const matches = res.result.items || res.result || [];
        loc.pincodeMatches = matches;
        
        if (matches.length === 1) {
            applyPincodeMatch(loc, matches[0]);
        }
        else if (matches.length > 1) {
            loc.mode = 'pincode-results';
        }
        render();
    }

    async function primeLocationLists(loc) {
        if (loc.provinceId && loc.cities.length === 0) {
            loc.loadingCities = true;
            render();
            const citiesRes = await HearthAPI.viewCities('provinceId', loc.provinceId);
            loc.loadingCities = false;
            if (citiesRes.success) {
                loc.cities = citiesRes.result.items || citiesRes.result || [];
            }
            else {
                showError(errorEl, citiesRes.message || 'Could not load cities for the selected state.');
            }
            render();
        }
        if (loc.cityId && loc.neighbourhoods.length === 0) {
            loc.loadingNeighbourhoods = true;
            render();
            const neighbourhoodsRes = await HearthAPI.viewNeighbourhoods(loc.cityId);
            loc.loadingNeighbourhoods = false;
            if (neighbourhoodsRes.success) {
                loc.neighbourhoods = neighbourhoodsRes.result.items || neighbourhoodsRes.result || [];
            }
            else {
                showError(errorEl, neighbourhoodsRes.message || 'Could not load localities for the selected city.');
            }
            render();
        }
    }

    function wireLocationPicker(idAttr) {
        const loc = locationState[idAttr];
        if (!loc)
            return;
        const provinceSel = body.querySelector(`#loc-province-${idAttr}`);
        const citySel = body.querySelector(`#loc-city-${idAttr}`);
        const localitySel = body.querySelector(`#loc-locality-${idAttr}`);
        if (!provinceSel || !citySel || !localitySel)
            return; // this card isn't showing the picker right now

        provinceSel.addEventListener('change', async () => {
            loc.provinceId = provinceSel.value;
            loc.province = provinceSel.selectedOptions[0] ? provinceSel.selectedOptions[0].textContent : '';
            loc.cityId = '';
            loc.city = '';
            loc.neighbourhoodId = '';
            loc.locality = '';
            loc.cities = [];
            loc.neighbourhoods = [];
            loc.confirmed = false;
            loc.serviceable = null;
            loc.loadingCities = !!loc.provinceId;
            render();

            if (!loc.provinceId)
                return;
            const citiesRes = await HearthAPI.viewCities('provinceId', loc.provinceId);
            loc.loadingCities = false;
            if (citiesRes.success) {
                loc.cities = citiesRes.result.items || citiesRes.result || [];
            }
            else {
                loc.cities = [];
                showError(errorEl, citiesRes.message || 'Could not load cities for the selected state.');
            }
            render();
        });

        citySel.addEventListener('change', async () => {
            loc.cityId = citySel.value;
            loc.city = citySel.selectedOptions[0] ? citySel.selectedOptions[0].textContent : '';
            loc.neighbourhoodId = '';
            loc.locality = '';
            loc.neighbourhoods = [];
            loc.confirmed = false;
            loc.serviceable = null;
            loc.loadingNeighbourhoods = !!loc.cityId;
            render();

            if (!loc.cityId)
                return;
            const neighbourhoodsRes = await HearthAPI.viewNeighbourhoods(loc.cityId);
            loc.loadingNeighbourhoods = false;
            if (neighbourhoodsRes.success) {
                loc.neighbourhoods = neighbourhoodsRes.result.items || neighbourhoodsRes.result || [];
            }
            else {
                loc.neighbourhoods = [];
                showError(errorEl, neighbourhoodsRes.message || 'Could not load localities for the selected city.');
            }
            render();
        });

        localitySel.addEventListener('change', () => {
            loc.neighbourhoodId = localitySel.value;
            const chosen = loc.neighbourhoods.find(n => String(n.neighbourhoodId) === String(loc.neighbourhoodId));
            loc.locality = chosen ? chosen.locality : (localitySel.selectedOptions[0] ? localitySel.selectedOptions[0].textContent : '');
            if (chosen && chosen.pincode)
                loc.pincode = chosen.pincode;
            loc.serviceable = loc.neighbourhoodId ? (chosen ? chosen.serviceable !== false : true) : null;
            loc.confirmed = !!loc.neighbourhoodId && loc.serviceable !== false;
            render();
        });
    }

    async function onDelete(idAttr) {
        const result = await HearthAPI.deleteAddress(idAttr);

        if (!result.success) {
            showError(errorEl, result.message || 'Could not delete the address. Please try again.');
            return;
        }
        const idx = addresses.findIndex(a => a.addressId === Number(idAttr));
        if (idx !== -1) {
            addresses.splice(idx, 1);
        }
        delete locationState[idAttr];

        // deleteAddressById(btn.dataset.deleteAddress);
        render();
    }

    async function onSave(idAttr) {
        const entry = body.querySelector(`[data-address-id="${idAttr}"]`);
        const loc = locationState[idAttr];

        if (!loc || !loc.confirmed)
            return showError(errorEl, 'Please select a serviceable state, city and locality first.');

        const label = entry.querySelector('[name="label"]').value;
        const addressLine1 = entry.querySelector('[name="addressLine1"]').value.trim();
        const addressLine2 = entry.querySelector('[name="addressLine2"]').value.trim();
        const pincodeField = entry.querySelector('[name="pincode"]');
        const pincode = (pincodeField ? pincodeField.value : loc.pincode || '').trim();
        const latitude = entry.querySelector('[name="latitude"]').value.trim();
        const longitude = entry.querySelector('[name="longitude"]').value.trim();

        if (!addressLine1)
            return showError(errorEl, 'Please enter the primary address line.');
        if (!/^[0-9A-Za-z\- ]{3,10}$/.test(pincode))
            return showError(errorEl, 'Please enter a valid postal code.');
        if (latitude && (Number(latitude) < -90 || Number(latitude) > 90))
            return showError(errorEl, 'Latitude must be between -90 and 90.');
        if (longitude && (Number(longitude) < -180 || Number(longitude) > 180))
            return showError(errorEl, 'Longitude must be between -180 and 180.');

        const isNew = idAttr === 'new';
        const saveBtn = body.querySelector(`[data-save-address="${idAttr}"]`);
        saveBtn.disabled = true;
        saveBtn.textContent = isNew ? 'Submitting…' : 'Saving…';

        const existing = isNew ? {} : (addresses.find(a => a.addressId === Number(idAttr)) || {});
        const payload = {
            ...existing,
            // userId: (getCurrentUser() || {}).id,
            label,
            addressLine1,
            addressLine2,
            // cityId: loc.cityId || undefined,
            neighbourhoodId: loc.neighbourhoodId || undefined,
            // state: loc.province,
            // provinceId: loc.provinceId || undefined,
            // city: loc.city,
            // locality: loc.locality,
            // pincode,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null
        };

        const result = isNew
                ? await HearthAPI.createAddress(payload)
                : await HearthAPI.updateAddress(idAttr, payload);

        saveBtn.disabled = false;

        if (!result.success) {
            saveBtn.textContent = isNew ? 'Submit' : 'Save';
            showError(errorEl, result.message || 'Could not save the address. Please try again.');
            return;
        }
        if (! isNew) {
            const idx = addresses.findIndex(a => a.addressId === Number(idAttr));
            addresses[idx] = result.result;
        }
        else {
            if (! addresses) {
                addresses = [];
            }
            addresses.push(result.result);
        }

        delete locationState[idAttr];
        editingId = null;
        render();
    }

    render();
}

/* ---- shared field renderers ---------------------------------------------- */
function readField(label, value) {
    return `
    <div class="profile-field">
      <span class="profile-field-label">${escapeHtmlP(label)}</span>
      <span class="profile-field-value">${escapeHtmlP(value !== undefined && value !== null && value !== '' ? value : '—')}</span>
    </div>
  `;
}

function inputField(label, name, value, opts = {}) {
    return `
    <div class="profile-field">
      <label class="profile-field-label" for="field-${name}">${escapeHtmlP(label)}</label>
      <input id="field-${name}" name="${name}" type="${opts.type || 'text'}"
             value="${escapeAttrP(value !== undefined && value !== null ? value : '')}"
             ${opts.step ? `step="${opts.step}"` : ''}
             ${opts.disabled ? 'disabled' : ''} ${opts.required ? 'required' : ''}>
    </div>
  `;
}

function selectField(label, name, value, options) {
    return `
    <div class="profile-field">
      <label class="profile-field-label" for="field-${name}">${escapeHtmlP(label)}</label>
      <select id="field-${name}" name="${name}">
        ${options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>
  `;
}

function formatDate(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'});
    } catch (err) {
        return iso;
    }
}

function showError(el, msg) {
    if (!el)
        return;
    el.textContent = msg;
    el.hidden = false;
}
function hideError(el) {
    if (!el)
        return;
    el.hidden = true;
    el.textContent = '';
}

function escapeHtmlP(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
function escapeAttrP(str) {
    return escapeHtmlP(str).replace(/"/g, '&quot;');
}
