/* =========================================================================
   FOLKS — scheduling.js
   A small mobile-screen-sized picker for choosing a service date + time
   slot, opened whenever a service is added to the cart (or its slot is
   changed later). Self-contained: injects its own modal markup once,
   exposes openSchedulePicker(), no dependency on which page it's used from.
   ========================================================================= */

const SCHEDULE_DAYS_AHEAD = 7;

const SCHEDULE_SLOT_TEMPLATE = [
  { id: 'slot-08-10', label: '8:00 – 10:00 AM', startHour: 8 },
  { id: 'slot-10-12', label: '10:00 AM – 12:00 PM', startHour: 10 },
  { id: 'slot-12-14', label: '12:00 – 2:00 PM', startHour: 12 },
  { id: 'slot-14-16', label: '2:00 – 4:00 PM', startHour: 14 },
  { id: 'slot-16-18', label: '4:00 – 6:00 PM', startHour: 16 },
  { id: 'slot-18-20', label: '6:00 – 8:00 PM', startHour: 18 },
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
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
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
    return { ...slot, disabled, reason };
  });
}

let _scheduleConfirmCallback = null;

function injectSchedulePickerMarkup() {
  if (document.getElementById('scheduleOverlay')) return;

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
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', markup);

  const overlay = document.getElementById('scheduleOverlay');
  const closeBtn = document.getElementById('scheduleCloseBtn');
  const dateRow = document.getElementById('scheduleDateRow');
  const slotGrid = document.getElementById('scheduleSlotGrid');
  const confirmBtn = document.getElementById('scheduleConfirmBtn');
  const errorEl = document.getElementById('scheduleError');

  const state = { selectedDate: null, selectedSlot: null };

  function closeModal() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    _scheduleConfirmCallback = null;
  }
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

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
    if (!state.selectedDate) { slotGrid.innerHTML = ''; return; }
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
    const slots = getSlotsForDate(state.selectedDate);
    const chosen = slots.find(s => s.id === state.selectedSlot);
    const result = { date: state.selectedDate, timeSlotId: chosen.id, timeSlotLabel: chosen.label };

    if (_scheduleConfirmCallback) _scheduleConfirmCallback(result);
    closeModal();
  });

  // Expose an internal opener the public function below can call.
  window.__openSchedulePickerInternal = function (serviceName, presetDate, presetSlotId, onConfirm) {
    state.selectedDate = presetDate || null;
    state.selectedSlot = presetSlotId || null;
    _scheduleConfirmCallback = onConfirm;

    document.getElementById('scheduleServiceName').textContent = serviceName
      ? `For "${serviceName}" — choose a date and time slot.`
      : 'Choose a date and time slot.';

    renderDates();
    renderSlots();
    updateConfirmState();

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
}

/**
 * Opens the schedule picker for a given service.
 * @param {string} serviceName - shown in the modal subtitle
 * @param {{date?: string, timeSlotId?: string}} preset - pre-selected values (for "change slot")
 * @param {(result: {date: string, timeSlotId: string, timeSlotLabel: string}) => void} onConfirm
 */
function openSchedulePicker(serviceName, preset, onConfirm) {
  injectSchedulePickerMarkup();
  initRipple();
  window.__openSchedulePickerInternal(serviceName, preset && preset.date, preset && preset.timeSlotId, onConfirm);
}
