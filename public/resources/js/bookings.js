/* =========================================================================
 FOLKS — bookings.js
 Drives the My Bookings page: fetches booking history via
 FolksAPI.getBookings() (GET /api/v1/bookings) and splits it into
 Upcoming vs Past based on each booking's latest scheduled service date.
 ========================================================================= */

let _allBookings = [];
let _activeBookingTab = 'upcoming';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCurrentUser === 'undefined')
        return; // guard: only runs on bookings.html
    initBookingsPage();
});

function initBookingsPage() {
    const gate = document.getElementById('bookingsGate');
    const content = document.getElementById('bookingsContent');
    if (!gate || !content)
        return;

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
    const result = await FolksAPI.getBookings();

    loading.hidden = true;

    if (!result.success) {
        errorEl.textContent = result.message || 'Could not load your bookings. Please try again.';
        errorEl.hidden = false;
        return;
    }
    if (result.result.items.length === 0) {
        empty.hidden = false;
        return;
    }
    _allBookings = (result.result.items || []).map(b => ({...b, _tab: classifyBooking(b)}));
    
    updateTabCounts();
    renderBookings();
}

/** A booking is "cancelled" if it was explicitly cancelled, regardless of
 *  its scheduled date. Otherwise it's "upcoming" if any of its services
 *  are scheduled today or later, or "past" once every visit is behind us. */
function classifyBooking(booking) {
    if (booking.status === 'CANCELLED')
        return 'cancelled';
    if (booking.scheduledAt < Date.now())
        return 'past';
    return 'upcoming';
}

function updateTabCounts() {
    ['upcoming', 'past', 'cancelled'].forEach(tab => {
        const count = _allBookings.filter(b => b._tab === tab).length;
        const el = document.querySelector(`[data-booking-tab="${tab}"] [data-tab-count]`);
        if (el)
            el.textContent = `(${count})`;
    });
}

function renderBookings() {
    const list = document.getElementById('bookingsList');
    const empty = document.getElementById('bookingsEmpty');
    const emptyText = document.getElementById('bookingsEmptyText');
    const filtered = _allBookings.filter(b => b._tab === _activeBookingTab);

    if (filtered.length === 0) {
        list.innerHTML = '';
        empty.hidden = false;
        const emptyTextByTab = {
            upcoming: "You don't have any upcoming bookings right now.",
            past: "You don't have any past bookings yet.",
            cancelled: "You haven't cancelled any bookings."
        };
        emptyText.textContent = emptyTextByTab[_activeBookingTab] || '';
        return;
    }

    empty.hidden = true;
    list.innerHTML = filtered.map(renderBookingCard).join('');
    wireCancelButtons();
}

function renderBookingCard(booking) {
    const bookedOn = formatFullDate(booking.createdAt);
    const statusMeta = {
        upcoming: {label: 'Confirmed', cls: 'booking-status-upcoming'},
        past: {label: 'Completed', cls: 'booking-status-past'},
        cancelled: {label: 'Cancelled', cls: 'booking-status-cancelled'}
    }[booking._tab];
    
    const verb = booking._tab === 'upcoming' ? 'Pay' : 'Paid';

    return `
    <article class="booking-card" data-booking-id="${escapeBk(booking.bookingId)}">
      <div class="booking-card-header">
        <p class="order-line-breadcrumb">Booking ${escapeBk(booking.bookingId)} · Booked on ${bookedOn}</p>
        <span class="booking-status-badge ${statusMeta.cls}">${booking.status}</span>
      </div>

      <div class="booking-services">
          <div class="booking-service-row">
            <div>
              <h4>${escapeBk(booking.serviceName)}</h4>
              <p class="order-line-schedule">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                ${formatFullDate(booking.scheduledAt)} · ${escapeBk(booking.timeSlot || '')}
              </p>
              ${booking.address ? `
                <p class="order-line-schedule">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  ${escapeBk(booking.address)}
                </p>
              ` : ''}
            </div>
            <span class="booking-service-price">1 &times; &#8377;${Number(booking.totalAmount).toLocaleString('en-IN')}</span>
          </div>
      </div>

      <div class="booking-card-footer">
        <span>${verb} via ${formatPaymentMethodLabel(booking.paymentMethod)}</span>
        <span class="sku-price">&#8377;${Number(booking.totalAmount).toLocaleString('en-IN')}</span>
      </div>
    
      ${booking.professionalId !== -1 ? `
        <div class="booking-card-footer">
          <span>Professional - ${escapeBk(booking.professionalName)}. Contact - ${escapeBk(booking.professionalContact)} </span>
        </div>
      ` : `
        <div class="booking-card-footer">
          <span>Professional not assigned </span>
        </div>
        `
      }

      ${booking._tab === 'upcoming' ? `
        <div class="booking-card-actions">
          <button type="button" class="btn btn-ghost btn-sm booking-cancel-btn" data-cancel-booking="${escapeBk(booking.bookingId)}">Cancel Booking</button>
        </div>
      ` : ''}
    </article>
  `;
}

function wireCancelButtons() {
    document.querySelectorAll('[data-cancel-booking]').forEach(btn => {
        btn.addEventListener('click', () => {
            const bookingId = btn.dataset.cancelBooking;
            const booking = _allBookings.find(b => b.bookingId === bookingId);
            if (!booking)
                return;

            showConfirmDialog({
                title: 'Cancel this booking?',
                message: `This will cancel ${booking.serviceName} scheduled for ${formatFullDate(booking.scheduledAt)}. This can't be undone — see our Refund Policy for how any charges are handled.`,
                confirmLabel: 'Yes, cancel booking',
                cancelLabel: 'Keep booking',
                danger: true,
                onConfirm: async () => {
                    btn.disabled = true;
                    btn.textContent = 'Cancelling…';

                    const result = await FolksAPI.cancelBooking(bookingId);

                    if (!result.success) {
                        btn.disabled = false;
                        btn.textContent = 'Cancel Booking';
                        const errorEl = document.getElementById('bookingsError');
                        errorEl.textContent = result.message || 'Could not cancel this booking. Please try again.';
                        errorEl.hidden = false;
                        return;
                    }

                    booking.status = 'CANCELLED';
                    booking._tab = 'cancelled';
                    updateTabCounts();
                    renderBookings();
                },
            });
        });
    });
}

function formatFullDate(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
    } catch (err) {
        return iso;
    }
}
function formatServiceDate(dateStr) {
    if (!dateStr)
        return 'No date';
    try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short'});
    } catch (err) {
        return dateStr;
    }
}
function formatPaymentMethodLabel(id) {
    const labels = {cash: 'Cash on Service', upi: 'UPI', card: 'Card'};
    return labels[id] || id || '—';
}
function escapeBk(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
