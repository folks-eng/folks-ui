/* =========================================================================
 FOLKS — profile.js
 Drives the My Profile page: Profile Details + Address sections, each with
 independent Edit/Save/Cancel state. Reads/writes the session helpers
 defined in script.js (getCurrentUser, saveCurrentUser, getStoredAddress,
 saveStoredAddress, isLoggedIn, renderUserChip) and calls FolksAPI
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
    if (!grid)
        return;

    let st_user = getCurrentUser();
    let editing = false;
    
    // Fetch the user details.
    let res = await FolksAPI.viewUser(st_user.externalId);
    if (! res.success) {
        if (res.message === 'Cookie expired') {
            showError(errorEl, 'Your session is expired. Forwarding you to the home screen ...');
            // alert(1);
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
        const res = await FolksAPI.updateUser(id, payload);
        
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
    if (!body)
        return;

    let editingId = null; // id of the address card currently in edit mode, or 'new'
    
    // Fetch the address details.
    let res = await FolksAPI.viewAddresses();
        
    if (! res.success) {
        showError('loginMobileError', res.message || 'Could fetch addresses. Please try again.');
        return;
    }
    let addresses = res.result.items;
    
    function render() {
        hideError(errorEl);
        // const addresses = getAddresses();

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
                readField('City', address.city),
                readField('State', address.state),
                readField('Postal code', address.pincode),
                readField('Latitude', address.latitude),
                readField('Longitude', address.longitude)
            ].join('')}</div>
        </div>
      `;
        }

        const a = address || {};
        return `
      <div class="address-entry" data-address-id="${idAttr}">
        <div class="address-entry-header">
          <span class="address-entry-label">${isNew ? 'New address' : escapeHtmlP(a.label || 'Address')}</span>
        </div>
        <div class="profile-fields-grid">
          ${selectField('Label', 'label', a.label || 'Home', ['Home', 'Work', 'Other'])}
          ${inputField('Primary address line', 'addressLine1', a.addressLine1, {required: true})}
          ${inputField('Secondary address line', 'addressLine2', a.addressLine2)}
          ${inputField('City', 'city', a.city, {required: true})}
          ${inputField('State', 'state', a.state, {required: true})}
          ${inputField('Postal code', 'pincode', a.pincode, {required: true})}
          ${inputField('Latitude', 'latitude', a.latitude, {type: 'number', step: 'any'})}
          ${inputField('Longitude', 'longitude', a.longitude, {type: 'number', step: 'any'})}
        </div>
        <div class="profile-card-actions" style="margin-top: var(--space-sm);">
          <button type="button" class="btn btn-ghost btn-sm" data-cancel-address="${idAttr}">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm btn-ripple" data-save-address="${idAttr}">${isNew ? 'Submit' : 'Save'}</button>
        </div>
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
    }
    
    async function onDelete(idAttr) {
        const result = await FolksAPI.deleteAddress(idAttr);

        if (!result.success) {
            showError(errorEl, result.message || 'Could not delete the address. Please try again.');
            return;
        }
        const idx = addresses.findIndex(a => a.addressId === Number(idAttr));
        if (idx !== -1) {
            addresses.splice(idx, 1);
        }

        // deleteAddressById(btn.dataset.deleteAddress);
        render();
    }

    async function onSave(idAttr) {
        const entry = body.querySelector(`[data-address-id="${idAttr}"]`);
        const label = entry.querySelector('[name="label"]').value;
        const addressLine1 = entry.querySelector('[name="addressLine1"]').value.trim();
        const addressLine2 = entry.querySelector('[name="addressLine2"]').value.trim();
        const city = entry.querySelector('[name="city"]').value.trim();
        const state = entry.querySelector('[name="state"]').value.trim();
        const pincode = entry.querySelector('[name="pincode"]').value.trim();
        const latitude = entry.querySelector('[name="latitude"]').value.trim();
        const longitude = entry.querySelector('[name="longitude"]').value.trim();
        
        if (!addressLine1)
            return showError(errorEl, 'Please enter the primary address line.');
        if (!city)
            return showError(errorEl, 'Please enter a city.');
        if (!state)
            return showError(errorEl, 'Please enter a state.');
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

        const existing = isNew ? {} : getAddressById(idAttr) || {};
        const payload = {
            ...existing,
            // userId: (getCurrentUser() || {}).id,
            label, addressLine1, addressLine2, city, state, pincode,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null
        };
        
        const result = isNew
                ? await FolksAPI.createAddress(payload)
                : await FolksAPI.updateAddress(idAttr, payload);

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

        // if (isNew) {
        //     addAddress(result.address);
        // } else {
        //     updateAddressById(idAttr, result.address);
        // }
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
