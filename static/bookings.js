/* =========================================================================
   FOLKS — bookings.js
   Drives the My Bookings page: fetches booking history via
   FolksAPI.getBookings() (GET /api/v1/bookings) and splits it into
   Upcoming vs Past based on each booking's latest scheduled service date.
   ========================================================================= */

let _allBookings = [];
let _activeBookingTab = 'upcoming';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof getCurrentUser === 'undefined') return; // guard: only runs on bookings.html
  initBookingsPage();
});

function initBookingsPage() {
  const gate = document.getElementById('bookingsGate');
  const content = document.getElementById('bookingsContent');
  if (!gate || !content) return;

  if (!isLoggedIn() || !getCurrentUser()) {
    gate.hidden = false;
    content.hidden = true;
    document.getElementById('bookingsGateSignupBtn')?.addEventListener('click', () => {
      document.getElementById('signupBtn')?.click();
    });
    return;
  }

  gate.hidden = true;
  content.hidden = false;
  wireBookingTabs();
  loadBookings();
}

function wireBookingTabs() {
  document.querySelectorAll('[data-booking-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeBookingTab = btn.dataset.bookingTab;
      document.querySelectorAll('[data-booking-tab]').forEach(b => b.classList.toggle('is-active', b === btn));
      renderBookings();
    });
  });
}

async function loadBookings() {
  const loading = document.getElementById('bookingsLoading');
  const list = document.getElementById('bookingsList');
  const empty = document.getElementById('bookingsEmpty');
  const errorEl = document.getElementById('bookingsError');

  loading.hidden = false;
  list.innerHTML = '';
  empty.hidden = true;
  errorEl.hidden = true;

  const user = getCurrentUser();
  const result = await FolksAPI.getBookings(user.id);

  loading.hidden = true;

  if (!result.success) {
    errorEl.textContent = result.message || 'Could not load your bookings. Please try again.';
    errorEl.hidden = false;
    return;
  }

  _allBookings = (result.bookings || []).map(b => ({ ...b, _tab: classifyBooking(b) }));
  updateTabCounts();
  renderBookings();
}

/** A booking is "upcoming" if any of its services are scheduled today or
 *  later; otherwise every visit has already happened, so it's "past". */
function classifyBooking(booking) {
  const dates = (booking.services || []).map(s => s.date).filter(Boolean);
  if (dates.length === 0) return 'past';
  const latest = dates.slice().sort().slice(-1)[0];
  const today = new Date().toISOString().slice(0, 10);
  return latest >= today ? 'upcoming' : 'past';
}

function updateTabCounts() {
  const upcomingCount = _allBookings.filter(b => b._tab === 'upcoming').length;
  const pastCount = _allBookings.filter(b => b._tab === 'past').length;
  const upcomingEl = document.querySelector('[data-booking-tab="upcoming"] [data-tab-count]');
  const pastEl = document.querySelector('[data-booking-tab="past"] [data-tab-count]');
  if (upcomingEl) upcomingEl.textContent = `(${upcomingCount})`;
  if (pastEl) pastEl.textContent = `(${pastCount})`;
}

function renderBookings() {
  const list = document.getElementById('bookingsList');
  const empty = document.getElementById('bookingsEmpty');
  const emptyText = document.getElementById('bookingsEmptyText');
  const filtered = _allBookings.filter(b => b._tab === _activeBookingTab);

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    emptyText.textContent = _activeBookingTab === 'upcoming'
      ? "You don't have any upcoming bookings right now."
      : "You don't have any past bookings yet.";
    return;
  }

  empty.hidden = true;
  list.innerHTML = filtered.map(renderBookingCard).join('');
}

function renderBookingCard(booking) {
  const isUpcoming = booking._tab === 'upcoming';
  const bookedOn = formatFullDate(booking.createdOn);

  return `
    <article class="booking-card">
      <div class="booking-card-header">
        <p class="order-line-breadcrumb">Booking ${escapeBk(booking.id)} · Booked on ${bookedOn}</p>
        <span class="booking-status-badge ${isUpcoming ? 'booking-status-upcoming' : 'booking-status-past'}">
          ${isUpcoming ? 'Confirmed' : 'Completed'}
        </span>
      </div>

      <div class="booking-services">
        ${(booking.services || []).map(s => `
          <div class="booking-service-row">
            <div>
              <h4>${escapeBk(s.name)}</h4>
              <p class="order-line-schedule">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                ${formatServiceDate(s.date)} · ${escapeBk(s.timeSlot || '')}
              </p>
            </div>
            <span class="booking-service-price">${s.quantity} &times; &#8377;${Number(s.price).toLocaleString('en-IN')}</span>
          </div>
        `).join('')}
      </div>

      <div class="booking-card-footer">
        <span>Paid via ${formatPaymentMethodLabel(booking.paymentMethod)}</span>
        <span class="sku-price">&#8377;${Number(booking.amount).toLocaleString('en-IN')}</span>
      </div>
    </article>
  `;
}

function formatFullDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (err) {
    return iso;
  }
}
function formatServiceDate(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch (err) {
    return dateStr;
  }
}
function formatPaymentMethodLabel(id) {
  const labels = { cash: 'Cash on Service', upi: 'UPI', card: 'Card' };
  return labels[id] || id || '—';
}
function escapeBk(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
