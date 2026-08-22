/* =========================================================================
 FOLKS — scheduling.js
 A small mobile-screen-sized picker for choosing a service date + time
 slot, followed by choosing (or adding) a delivery address, opened
 whenever a service is added to the cart (or its slot/address is changed
 later). Self-contained: injects its own modal markup once, exposes
 openSchedulePicker(), no dependency on which page it's used from.
 
 Flow: date/time slot -> choose a saved address (or, if none exist, go
 straight to an inline "add address" form) -> done.
 ========================================================================= */

const SCHEDULE_DAYS_AHEAD = 7;

const SCHEDULE_SLOT_TEMPLATE = [
    {id: 'slot-08-10', label: '8:00 – 10:00 AM', startHour: 8},
    {id: 'slot-10-12', label: '10:00 AM – 12:00 PM', startHour: 10},
    {id: 'slot-12-14', label: '12:00 – 2:00 PM', startHour: 12},
    {id: 'slot-14-16', label: '2:00 – 4:00 PM', startHour: 14},
    {id: 'slot-16-18', label: '4:00 – 6:00 PM', startHour: 16},
    {id: 'slot-18-20', label: '6:00 – 8:00 PM', startHour: 18},
];

/** Returns YYYY-MM-DD for a Date, in local time (not UTC). */
function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** A small deterministic hash so the same date+slot is always "booked" or
 *  not across renders/reloads, without needing a real backend to track it. */
function pseudoRandomBooked(dateKey, slotId) {
    const str = dateKey + slotId;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash % 5 === 0; // ~20% of slots pre-marked unavailable
}

function getScheduleDays() {
    const days = [];
    const today = new Date();
    for (let i = 0; i < SCHEDULE_DAYS_AHEAD; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push({
            key: formatDateKey(d),
            weekday: d.toLocaleDateString('en-IN', {weekday: 'short'}),
            dayNum: d.getDate(),
            month: d.toLocaleDateString('en-IN', {month: 'short'}),
            isToday: i === 0,
        });
    }
    return days;
}

function getSlotsForDate(dateKey) {
    const now = new Date();
    const isToday = dateKey === formatDateKey(now);

    return SCHEDULE_SLOT_TEMPLATE.map(slot => {
        let disabled = false;
        let reason = '';
        if (isToday && slot.startHour <= now.getHours() + 1) {
            disabled = true;
            reason = 'Past';
        } else if (pseudoRandomBooked(dateKey, slot.id)) {
            disabled = true;
            reason = 'Booked';
        }
        return {...slot, disabled, reason};
    });
}

let _scheduleConfirmCallback = null;

function injectSchedulePickerMarkup() {
    if (document.getElementById('scheduleOverlay'))
        return;

    const markup = `
<div class="modal-overlay" id="scheduleOverlay" aria-hidden="true">
  <div class="modal-phone" id="scheduleModal" role="dialog" aria-modal="true" aria-labelledby="scheduleModalTitle">
    <button type="button" class="modal-close" id="scheduleCloseBtn" aria-label="Close scheduling">&times;</button>
    <div class="modal-screens">

      <div class="modal-screen screen-current" data-screen="schedule-pick">
        <h2 id="scheduleModalTitle" class="modal-title">Schedule your service</h2>
        <p class="modal-sub" id="scheduleServiceName">Choose a date and time slot.</p>

        <p class="schedule-label">Date</p>
        <div class="schedule-date-row" id="scheduleDateRow"></div>

        <p class="schedule-label" style="margin-top: var(--space-sm);">Available time slots</p>
        <div class="schedule-slot-grid" id="scheduleSlotGrid"></div>

        <p class="modal-error" id="scheduleError" hidden></p>
        <button type="button" class="btn btn-primary btn-ripple modal-submit" id="scheduleConfirmBtn" disabled>Confirm slot</button>
      </div>

      <div class="modal-screen screen-off-right" data-screen="schedule-address" inert aria-hidden="true">
        <button type="button" class="link-btn" id="scheduleAddressBackBtn" style="margin-bottom: 0.6rem;">&larr; Back</button>
        <h2 class="modal-title">Where should we send the pro?</h2>
        <p class="modal-sub">Choose a saved address for this visit.</p>

        <div class="address-choice-list" id="scheduleAddressList"></div>

        <button type="button" class="link-btn" id="scheduleAddNewAddressBtn" style="margin: var(--space-sm) 0;">+ Add a new address</button>

        <p class="modal-error" id="scheduleAddressError" hidden></p>
        <button type="button" class="btn btn-primary btn-ripple modal-submit" id="scheduleAddressConfirmBtn" disabled>Confirm address</button>
      </div>

      <div class="modal-screen screen-off-right" data-screen="schedule-address-form" inert aria-hidden="true">
        <button type="button" class="link-btn" id="scheduleAddressFormBackBtn" style="margin-bottom: 0.6rem;">&larr; Back</button>
        <h2 class="modal-title">Add an address</h2>
        <p class="modal-sub">This will be saved to your account for next time too.</p>

        <div class="profile-field" style="margin-bottom: var(--space-sm);">
          <label class="profile-field-label" for="scheduleAddrLabel">Label</label>
          <select id="scheduleAddrLabel">
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </div>
        <div class="profile-field" style="margin-bottom: var(--space-sm);">
          <label class="profile-field-label" for="scheduleAddrLine1">Primary address line</label>
          <input type="text" id="scheduleAddrLine1" placeholder="House / flat no., street">
        </div>
        <div class="profile-field" style="margin-bottom: var(--space-sm);">
          <label class="profile-field-label" for="scheduleAddrLine2">Secondary address line <span style="text-transform:none;letter-spacing:0;">(optional)</span></label>
          <input type="text" id="scheduleAddrLine2" placeholder="Landmark, area">
        </div>
        <div class="profile-fields-grid" style="margin-bottom: var(--space-sm);">
          <div class="profile-field">
            <label class="profile-field-label" for="scheduleAddrCity">City</label>
            <input type="text" id="scheduleAddrCity">
          </div>
          <div class="profile-field">
            <label class="profile-field-label" for="scheduleAddrState">State</label>
            <input type="text" id="scheduleAddrState">
          </div>
        </div>
        <div class="profile-field" style="margin-bottom: var(--space-sm);">
          <label class="profile-field-label" for="scheduleAddrPostal">Postal code</label>
          <input type="text" id="scheduleAddrPostal" inputmode="numeric" maxlength="6">
        </div>

        <p class="modal-error" id="scheduleAddressFormError" hidden></p>
        <button type="button" class="btn btn-primary btn-ripple modal-submit" id="scheduleAddressFormSaveBtn">Save &amp; Continue</button>
      </div>

    </div>
  </div>
</div>`;

    document.body.insertAdjacentHTML('beforeend', markup);

    const overlay = document.getElementById('scheduleOverlay');
    const modal = document.getElementById('scheduleModal');
    const closeBtn = document.getElementById('scheduleCloseBtn');
    const dateRow = document.getElementById('scheduleDateRow');
    const slotGrid = document.getElementById('scheduleSlotGrid');
    const confirmBtn = document.getElementById('scheduleConfirmBtn');
    const errorEl = document.getElementById('scheduleError');
    const addressList = document.getElementById('scheduleAddressList');
    const addressConfirmBtn = document.getElementById('scheduleAddressConfirmBtn');
    const addressErrorEl = document.getElementById('scheduleAddressError');
    const addressFormErrorEl = document.getElementById('scheduleAddressFormError');

    const screens = {
        pick: modal.querySelector('[data-screen="schedule-pick"]'),
        address: modal.querySelector('[data-screen="schedule-address"]'),
        addressForm: modal.querySelector('[data-screen="schedule-address-form"]'),
    };

    const state = {
        selectedDate: null,
        selectedSlot: null,
        selectedAddressId: null,
        activeScreen: screens.pick
    };

    function goTo(target, direction) {
        const outgoing = state.activeScreen;
        if (outgoing === target)
            return;

        target.classList.remove('screen-off-left', 'screen-off-right');
        target.classList.add(direction === 'forward' ? 'screen-off-right' : 'screen-off-left');
        target.inert = false;
        target.removeAttribute('aria-hidden');
        void target.offsetWidth;

        requestAnimationFrame(() => {
            outgoing.classList.remove('screen-current');
            outgoing.classList.add(direction === 'forward' ? 'screen-off-left' : 'screen-off-right');
            outgoing.inert = true;
            outgoing.setAttribute('aria-hidden', 'true');

            target.classList.remove('screen-off-left', 'screen-off-right');
            target.classList.add('screen-current');
        });

        state.activeScreen = target;
    }

    function closeModal() {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        _scheduleConfirmCallback = null;
    }
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay)
            closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('is-open'))
            closeModal();
    });

    /* ---- screen 1: date + time slot ---- */
    function renderDates() {
        const days = getScheduleDays();
        dateRow.innerHTML = days.map(d => `
      <button type="button" class="schedule-date-chip${d.key === state.selectedDate ? ' is-active' : ''}" data-date-key="${d.key}">
        <span class="schedule-date-weekday">${d.isToday ? 'Today' : d.weekday}</span>
        <span class="schedule-date-num">${d.dayNum}</span>
        <span class="schedule-date-month">${d.month}</span>
      </button>
    `).join('');

        dateRow.querySelectorAll('.schedule-date-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                state.selectedDate = chip.dataset.dateKey;
                state.selectedSlot = null;
                renderDates();
                renderSlots();
                updateConfirmState();
            });
        });
    }

    function renderSlots() {
        if (!state.selectedDate) {
            slotGrid.innerHTML = '';
            return;
        }
        const slots = getSlotsForDate(state.selectedDate);
        slotGrid.innerHTML = slots.map(slot => `
      <button type="button"
              class="schedule-slot${slot.id === state.selectedSlot ? ' is-active' : ''}${slot.disabled ? ' is-disabled' : ''}"
              data-slot-id="${slot.id}" data-slot-label="${slot.label}"
              ${slot.disabled ? 'disabled' : ''}>
        <span>${slot.label}</span>
        ${slot.disabled ? `<small>${slot.reason}</small>` : ''}
      </button>
    `).join('');

        slotGrid.querySelectorAll('.schedule-slot:not(.is-disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedSlot = btn.dataset.slotId;
                renderSlots();
                updateConfirmState();
            });
        });
    }

    function updateConfirmState() {
        confirmBtn.disabled = !(state.selectedDate && state.selectedSlot);
        errorEl.hidden = true;
    }

    confirmBtn.addEventListener('click', () => {
        if (!state.selectedDate || !state.selectedSlot) {
            errorEl.textContent = 'Pick a date and an available time slot to continue.';
            errorEl.hidden = false;
            return;
        }
        goToAddressStep('forward');
    });

    /* ---- screen 2: choose a saved address (or jump to the add form) ---- */
    async function goToAddressStep(direction) {
        const addresses = await getAddresses();
        if (addresses.length === 0) {
            goTo(screens.addressForm, direction);
            return;
        }
        if (!addresses.some(a => a.addressId === state.selectedAddressId)) {
            state.selectedAddressId = addresses[0].addressId;
        }
        renderAddressChoices();
        goTo(screens.address, direction);
    }

    async function renderAddressChoices() {
        const addresses = await getAddresses();
        addressList.innerHTML = addresses.map(a => `
      <button type="button" class="address-choice${a.addressId === state.selectedAddressId ? ' is-active' : ''}" data-address-choice="${a.addressId}">
        <span class="address-choice-label">${escapeHtmlSched(a.label || 'Address')}</span>
        <span class="address-choice-summary">${escapeHtmlSched([a.addressLine1, a.addressLine2, a.city].filter(Boolean).join(', '))}</span>
      </button>
    `).join('');

        addressList.querySelectorAll('[data-address-choice]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedAddressId = Number(btn.dataset.addressChoice);
                renderAddressChoices();
                updateAddressConfirmState();
            });
        });
        updateAddressConfirmState();
    }

    function updateAddressConfirmState() {
        addressConfirmBtn.disabled = !state.selectedAddressId;
        addressErrorEl.hidden = true;
    }

    document.getElementById('scheduleAddressBackBtn').addEventListener('click', () => {
        goTo(screens.pick, 'back');
    });

    document.getElementById('scheduleAddNewAddressBtn').addEventListener('click', () => {
        goTo(screens.addressForm, 'forward');
    });

    addressConfirmBtn.addEventListener('click', async () => {
        const address = await getAddressById(state.selectedAddressId);
        if (!address) {
            addressErrorEl.textContent = 'Choose an address to continue.';
            addressErrorEl.hidden = false;
            return;
        }
        finishScheduling(address);
    });

    /* ---- screen 3: add a new address inline ---- */
    document.getElementById('scheduleAddressFormBackBtn').addEventListener('click', () => {
        const hasAddresses = getAddresses().length > 0;
        goTo(hasAddresses ? screens.address : screens.pick, 'back');
    });

    document.getElementById('scheduleAddressFormSaveBtn').addEventListener('click', () => {
        const label = document.getElementById('scheduleAddrLabel').value;
        const line1 = document.getElementById('scheduleAddrLine1').value.trim();
        const line2 = document.getElementById('scheduleAddrLine2').value.trim();
        const city = document.getElementById('scheduleAddrCity').value.trim();
        const stateVal = document.getElementById('scheduleAddrState').value.trim();
        const postalCode = document.getElementById('scheduleAddrPostal').value.trim();

        if (!line1)
            return showAddressFormError('Please enter the primary address line.');
        if (!city)
            return showAddressFormError('Please enter a city.');
        if (!stateVal)
            return showAddressFormError('Please enter a state.');
        if (!/^[0-9A-Za-z\- ]{3,10}$/.test(postalCode))
            return showAddressFormError('Please enter a valid postal code.');

        addressFormErrorEl.hidden = true;
        const saved = addAddress({label, line1, line2, city, state: stateVal, postalCode});
        state.selectedAddressId = saved.id;
        finishScheduling(saved);
    });

    function showAddressFormError(msg) {
        addressFormErrorEl.textContent = msg;
        addressFormErrorEl.hidden = false;
    }

    function finishScheduling(address) {
        const slots = getSlotsForDate(state.selectedDate);
        const chosenSlot = slots.find(s => s.id === state.selectedSlot);
        const result = {
            date: state.selectedDate,
            timeSlotId: chosenSlot.id,
            timeSlotLabel: chosenSlot.label,
            addressId: address.addressId,
            addressSummary: formatAddressSummary(address)
        };
        if (_scheduleConfirmCallback) {
            alert('Here');
            _scheduleConfirmCallback(result);
        }
        closeModal();
    }

    // Expose an internal opener the public function below can call.
    window.__openSchedulePickerInternal = function (serviceName, preset, onConfirm) {
        state.selectedDate = (preset && preset.date) || null;
        state.selectedSlot = (preset && preset.timeSlotId) || null;
        state.selectedAddressId = (preset && preset.addressId) || null;
        _scheduleConfirmCallback = onConfirm;

        document.getElementById('scheduleServiceName').textContent = serviceName
                ? `For "${serviceName}" — choose a date and time slot.`
                : 'Choose a date and time slot.';

        // Always reopen on the date/time screen first, even when re-editing.
        [screens.address, screens.addressForm].forEach(s => {
            s.classList.remove('screen-current');
            s.classList.add('screen-off-right');
            s.inert = true;
            s.setAttribute('aria-hidden', 'true');
        });
        screens.pick.classList.remove('screen-off-left', 'screen-off-right');
        screens.pick.classList.add('screen-current');
        screens.pick.inert = false;
        screens.pick.removeAttribute('aria-hidden');
        state.activeScreen = screens.pick;

        renderDates();
        renderSlots();
        updateConfirmState();

        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };
}

function escapeHtmlSched(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Opens the schedule + address picker for a given service.
 * @param {string} serviceName - shown in the modal subtitle
 * @param {{date?: string, timeSlotId?: string, addressId?: string}} preset - pre-selected values (for "change slot")
 * @param {(result: {date: string, timeSlotId: string, timeSlotLabel: string, addressId: string, addressSummary: string}) => void} onConfirm
 */
function openSchedulePicker(serviceName, preset, onConfirm) {
    injectSchedulePickerMarkup();
    initRipple();
    window.__openSchedulePickerInternal(serviceName, preset, onConfirm);
}
