/* =========================================================================
   bookingsController.js
   Handles:
     POST /api/v1/bookings          - create a booking
     GET  /api/v1/bookings          - list the authenticated customer's bookings
     PUT  /api/v1/bookings/:id      - cancel a booking ({ status: 'cancelled' })
   Backed by src/data/bookings/bookings.json.

   The customer on a booking is no longer taken from the request body —
   the UI sends only the service/payment details. Every function here
   receives `authUser` (the verified JWT payload, see src/auth/session.js)
   and uses that as the sole source of truth for whose booking this is.
   ========================================================================= */

const path = require('path');
const { readJSON, writeJSON } = require('../utils/jsonStore');

const BOOKINGS_FILE = path.join(__dirname, '..', 'data', 'bookings', 'bookings.json');

async function createBooking(body, authUser) {
  if (!authUser || !authUser.userId) {
    return { success: false, message: 'You must be logged in to book a service.' };
  }

  const payload = body || {};
  const bookings = await readJSON(BOOKINGS_FILE, []);

  const booking = {
    id: `bkg-${Date.now()}`,
    status: 'confirmed',
    createdOn: new Date().toISOString(),
    // Identity comes entirely from the verified JWT, never from the
    // request body — this is the whole point of the change.
    customer: {
      id: authUser.userId,
      name: authUser.name || '',
      mobile: authUser.mobile || '',
    },
    services: payload.services || [],
    paymentMethod: payload.paymentMethod,
    amount: payload.amount,
  };

  bookings.push(booking);
  await writeJSON(BOOKINGS_FILE, bookings);

  return { success: true, booking };
}

async function getBookings(authUser) {
  if (!authUser || !authUser.userId) {
    return { success: false, message: 'You must be logged in to view your bookings.' };
  }

  const bookings = await readJSON(BOOKINGS_FILE, []);
  const filtered = bookings.filter(b => b.customer && b.customer.id === authUser.userId);
  filtered.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

  return { success: true, bookings: filtered };
}

async function cancelBooking(bookingId, authUser) {
  if (!authUser || !authUser.userId) {
    return { success: false, message: 'You must be logged in to cancel a booking.' };
  }

  const bookings = await readJSON(BOOKINGS_FILE, []);
  const idx = bookings.findIndex(b => b.id === bookingId);

  if (idx === -1) {
    return { success: false, message: 'Booking not found.' };
  }
  if (!bookings[idx].customer || bookings[idx].customer.id !== authUser.userId) {
    return { success: false, message: 'You are not authorized to cancel this booking.' };
  }

  bookings[idx].status = 'cancelled';
  bookings[idx].cancelledOn = new Date().toISOString();
  await writeJSON(BOOKINGS_FILE, bookings);

  return { success: true, booking: bookings[idx] };
}

module.exports = { createBooking, getBookings, cancelBooking };
