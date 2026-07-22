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
  if (typeof getCurrentUser === 'undefined') return; // guard: only runs on profile.html
  initProfilePage();
});

function initProfilePage() {
  const gate = document.getElementById('profileGate');
  const content = document.getElementById('profileContent');
  if (!gate || !content) return;

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
function initProfileDetailsSection() {
  const grid = document.getElementById('profileFieldsGrid');
  const actions = document.getElementById('profileCardActions');
  const errorEl = document.getElementById('profileFormError');
  if (!grid) return;

  let user = getCurrentUser();
  let editing = false;

  function render() {
    hideError(errorEl);

    if (!editing) {
      grid.innerHTML = [
        readField('User ID', user.id),
        readField('Full name', user.name),
        readField('Email address', user.email),
        readField('Primary phone', user.mobile),
        readField('Secondary phone', user.secondaryPhone),
        readField('User role', user.role || 'Customer'),
        readField('Account status', user.status || 'Active'),
        readField('Created On', formatDate(user.createdOn)),
      ].join('');

      actions.innerHTML = `<button type="button" class="btn btn-ghost btn-sm" id="profileEditBtn">Edit</button>`;
      document.getElementById('profileEditBtn').addEventListener('click', () => {
        editing = true;
        render();
      });
      return;
    }

    grid.innerHTML = [
      inputField('User ID', 'id', user.id, { disabled: true }),
      inputField('Full name', 'name', user.name, { required: true }),
      inputField('Email address', 'email', user.email, { type: 'email', required: true }),
      inputField('Primary phone', 'mobile', user.mobile, { type: 'tel', required: true }),
      inputField('Secondary phone', 'secondaryPhone', user.secondaryPhone, { type: 'tel' }),
      selectField('User role', 'role', user.role || 'Customer', ['Customer', 'Professional', 'Admin']),
      selectField('Account status', 'status', user.status || 'Active', ['Active', 'Inactive', 'Blocked']),
      inputField('Created On', 'createdOn', formatDate(user.createdOn), { disabled: true }),
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
    const name = grid.querySelector('[name="name"]').value.trim();
    const email = grid.querySelector('[name="email"]').value.trim();
    const mobile = grid.querySelector('[name="mobile"]').value.trim();
    const secondaryPhone = grid.querySelector('[name="secondaryPhone"]').value.trim();
    const role = grid.querySelector('[name="role"]').value;
    const status = grid.querySelector('[name="status"]').value;

    if (name.length < 2) return showError(errorEl, 'Please enter a valid full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError(errorEl, 'Please enter a valid email address.');
    if (mobile.replace(/\D/g, '').length < 7) return showError(errorEl, 'Please enter a valid primary phone number.');

    const saveBtn = document.getElementById('profileSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const payload = { ...user, name, email, mobile, secondaryPhone, role, status };
    const result = await FolksAPI.updateUser(payload);

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';

    if (!result.success) {
      showError(errorEl, result.message || 'Could not save changes. Please try again.');
      return;
    }

    user = result.user;
    saveCurrentUser(user);
    renderUserChip(user); // keep the header chip's name in sync immediately
    editing = false;
    render();
  }

  render();
}

/* ---- SECTION 2: Address -------------------------------------------------- */
function initAddressSection() {
  const actions = document.getElementById('addressCardActions');
  const body = document.getElementById('addressCardBody');
  const errorEl = document.getElementById('addressFormError');
  if (!body) return;

  let address = getStoredAddress();
  let editing = false;
  let isNew = !address;

  function render() {
    hideError(errorEl);
    actions.innerHTML = '';

    // ---- no address on file: empty state ----
    if (!address && !editing) {
      body.innerHTML = `
        <div class="address-empty-state">
          <span class="address-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="2"/></svg>
          </span>
          <p>You haven't added an address yet. Add one so professionals know exactly where to show up.</p>
          <button type="button" class="btn btn-primary btn-ripple" id="addAddressBtn">Add an Address</button>
        </div>
      `;
      initRipple();
      document.getElementById('addAddressBtn').addEventListener('click', () => {
        isNew = true;
        editing = true;
        render();
      });
      return;
    }

    // ---- read-only view of an existing address ----
    if (!editing) {
      body.innerHTML = `<div class="profile-fields-grid">${[
        readField('Primary address line', address.line1),
        readField('Secondary address line', address.line2),
        readField('City', address.city),
        readField('State', address.state),
        readField('Postal code', address.postalCode),
        readField('Latitude', address.latitude),
        readField('Longitude', address.longitude),
      ].join('')}</div>`;

      actions.innerHTML = `<button type="button" class="btn btn-ghost btn-sm" id="addressEditBtn">Edit</button>`;
      document.getElementById('addressEditBtn').addEventListener('click', () => {
        isNew = false;
        editing = true;
        render();
      });
      return;
    }

    // ---- edit form (either adding new or editing existing) ----
    const a = address || {};
    body.innerHTML = `<div class="profile-fields-grid">${[
      inputField('Primary address line', 'line1', a.line1, { required: true }),
      inputField('Secondary address line', 'line2', a.line2),
      inputField('City', 'city', a.city, { required: true }),
      inputField('State', 'state', a.state, { required: true }),
      inputField('Postal code', 'postalCode', a.postalCode, { required: true }),
      inputField('Latitude', 'latitude', a.latitude, { type: 'number', step: 'any' }),
      inputField('Longitude', 'longitude', a.longitude, { type: 'number', step: 'any' }),
    ].join('')}</div>`;

    actions.innerHTML = `
      ${address ? '<button type="button" class="btn btn-ghost btn-sm" id="addressCancelBtn">Cancel</button>' : ''}
      <button type="button" class="btn btn-primary btn-sm btn-ripple" id="addressSaveBtn">${isNew ? 'Submit' : 'Save'}</button>
    `;
    initRipple();

    if (address) {
      document.getElementById('addressCancelBtn').addEventListener('click', () => {
        editing = false;
        render();
      });
    }
    document.getElementById('addressSaveBtn').addEventListener('click', onSave);
  }

  async function onSave() {
    const line1 = body.querySelector('[name="line1"]').value.trim();
    const line2 = body.querySelector('[name="line2"]').value.trim();
    const city = body.querySelector('[name="city"]').value.trim();
    const state = body.querySelector('[name="state"]').value.trim();
    const postalCode = body.querySelector('[name="postalCode"]').value.trim();
    const latitude = body.querySelector('[name="latitude"]').value.trim();
    const longitude = body.querySelector('[name="longitude"]').value.trim();

    if (!line1) return showError(errorEl, 'Please enter the primary address line.');
    if (!city) return showError(errorEl, 'Please enter a city.');
    if (!state) return showError(errorEl, 'Please enter a state.');
    if (!/^[0-9A-Za-z\- ]{3,10}$/.test(postalCode)) return showError(errorEl, 'Please enter a valid postal code.');
    if (latitude && (Number(latitude) < -90 || Number(latitude) > 90)) return showError(errorEl, 'Latitude must be between -90 and 90.');
    if (longitude && (Number(longitude) < -180 || Number(longitude) > 180)) return showError(errorEl, 'Longitude must be between -180 and 180.');

    const saveBtn = document.getElementById('addressSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = isNew ? 'Submitting…' : 'Saving…';

    const payload = {
      ...(address || {}),
      userId: (getCurrentUser() || {}).id,
      line1, line2, city, state, postalCode,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
    };

    const result = isNew
      ? await FolksAPI.createAddress(payload)
      : await FolksAPI.updateAddress(payload);

    saveBtn.disabled = false;

    if (!result.success) {
      saveBtn.textContent = isNew ? 'Submit' : 'Save';
      showError(errorEl, result.message || 'Could not save the address. Please try again.');
      return;
    }

    address = result.address;
    saveStoredAddress(address);
    editing = false;
    isNew = false;
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
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (err) {
    return iso;
  }
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}
function hideError(el) {
  if (!el) return;
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
