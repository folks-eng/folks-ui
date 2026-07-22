/* =========================================================================
   FOLKS — api.js
   All network / AJAX calls live in this file, kept separate from script.js
   which only handles UI behaviour. Exposed as the FolksAPI namespace so
   script.js (loaded after this file) can call FolksAPI.requestOtp(), etc.

   Backend contract:
     1. POST /api/v1/otp            { mobile }              -> { success, message }
     2. POST /api/v1/otp/verify     { mobile, otp }          -> { success, message, token? }
     3. POST /api/v1/users          { mobile, name, email }  -> { success, user }

   DEMO_MODE: this bundle ships with no live backend. If a real endpoint at
   the paths above isn't reachable, each request transparently falls back to
   a simulated response (after a short delay) so the flow can be clicked
   through end-to-end. Set FolksAPI.DEMO_MODE to false once real endpoints
   exist — the fetch calls are already wired with the correct method/payload
   shape and just need a server to answer them.
   ========================================================================= */

const FolksAPI = (function () {
  const DEMO_MODE = true;

  /**
   * POST /api/v1/otp
   * Payload: { mobile: string }
   * Triggers OTP generation + delivery to the customer's mobile device.
   * @returns {Promise<{success: boolean, message?: string, demoOtp?: string}>}
   */
  async function requestOtp(mobile) {
    const payload = { mobile };

    if (DEMO_MODE) {
      return simulateOtpRequest(payload);
    }

    try {
      const res = await fetch('/api/v1/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`OTP request failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] /api/v1/otp unreachable, falling back to demo mode.', err);
      return simulateOtpRequest(payload);
    }
  }

  /**
   * POST /api/v1/otp/verify
   * Payload: { mobile: string, otp: string }
   * @returns {Promise<{success: boolean, message?: string, token?: string}>}
   */
  async function verifyOtp(mobile, otp) {
    const payload = { mobile, otp };

    if (DEMO_MODE) {
      return simulateOtpVerify(payload);
    }

    try {
      const res = await fetch('/api/v1/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`OTP verify failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] /api/v1/otp/verify unreachable, falling back to demo mode.', err);
      return simulateOtpVerify(payload);
    }
  }

  /**
   * POST /api/v1/users
   * Payload: { mobile: string, name: string, email: string }
   * @returns {Promise<{success: boolean, message?: string, user?: object}>}
   */
  async function createUser(payload) {
    if (DEMO_MODE) {
      return simulateCreateUser(payload);
    }

    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`User creation failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] /api/v1/users unreachable, falling back to demo mode.', err);
      return simulateCreateUser(payload);
    }
  }

  /**
   * PUT /api/v1/users
   * Payload: full user object, including id, with updated field values.
   * @returns {Promise<{success: boolean, message?: string, user?: object}>}
   */
  async function updateUser(payload) {
    if (DEMO_MODE) {
      return simulateUpdateUser(payload);
    }

    try {
      const res = await fetch('/api/v1/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`User update failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] PUT /api/v1/users unreachable, falling back to demo mode.', err);
      return simulateUpdateUser(payload);
    }
  }

  /**
   * POST /api/v1/addresses
   * Payload: address fields (no id yet — this is the first address for the user).
   * @returns {Promise<{success: boolean, message?: string, address?: object}>}
   */
  async function createAddress(payload) {
    if (DEMO_MODE) {
      return simulateCreateAddress(payload);
    }

    try {
      const res = await fetch('/api/v1/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Address creation failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] /api/v1/addresses unreachable, falling back to demo mode.', err);
      return simulateCreateAddress(payload);
    }
  }

  /**
   * PUT /api/v1/addresses
   * Payload: full address object, including id, with updated field values.
   * @returns {Promise<{success: boolean, message?: string, address?: object}>}
   */
  async function updateAddress(payload) {
    if (DEMO_MODE) {
      return simulateUpdateAddress(payload);
    }

    try {
      const res = await fetch('/api/v1/addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Address update failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] PUT /api/v1/addresses unreachable, falling back to demo mode.', err);
      return simulateUpdateAddress(payload);
    }
  }

  /**
   * POST /api/v1/bookings
   * Payload: { customer, services: [{ name, date, timeSlot, quantity, price }], paymentMethod, amount }
   * @returns {Promise<{success: boolean, message?: string, booking?: object}>}
   */
  async function createBooking(payload) {
    if (DEMO_MODE) {
      return simulateCreateBooking(payload);
    }

    try {
      const res = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Booking creation failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Folks] /api/v1/bookings unreachable, falling back to demo mode.', err);
      return simulateCreateBooking(payload);
    }
  }

  /* ---- demo-mode simulators (safe to delete once real endpoints are live) ---- */
  const _demoOtpByMobile = {};

  function simulateOtpRequest(payload) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    _demoOtpByMobile[payload.mobile] = otp;
    console.info(`[Folks demo] OTP for ${payload.mobile}: ${otp}`);
    return delay({ success: true, message: 'OTP sent', demoOtp: otp }, 900);
  }

  function simulateOtpVerify(payload) {
    const expected = _demoOtpByMobile[payload.mobile];
    const ok = Boolean(expected) && payload.otp === expected;
    return delay(
      ok
        ? { success: true, message: 'OTP verified', token: 'demo-token' }
        : { success: false, message: 'Incorrect OTP. Please try again.' },
      900
    );
  }

  function simulateCreateUser(payload) {
    return delay({
      success: true,
      user: {
        id: `usr-${Date.now()}`,
        name: payload.name,
        email: payload.email,
        mobile: payload.mobile,
        secondaryPhone: '',
        role: 'Customer',
        status: 'Active',
        createdOn: new Date().toISOString(),
      },
    }, 900);
  }

  function simulateUpdateUser(payload) {
    return delay({ success: true, message: 'Profile updated', user: payload }, 700);
  }

  function simulateCreateAddress(payload) {
    return delay({
      success: true,
      address: { id: `addr-${Date.now()}`, ...payload },
    }, 700);
  }

  function simulateUpdateAddress(payload) {
    return delay({ success: true, message: 'Address updated', address: payload }, 700);
  }

  function simulateCreateBooking(payload) {
    return delay({
      success: true,
      booking: {
        id: `bkg-${Date.now()}`,
        status: 'confirmed',
        ...payload,
      },
    }, 1000);
  }

  function delay(value, ms) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms));
  }

  return {
    DEMO_MODE,
    requestOtp,
    verifyOtp,
    createUser,
    updateUser,
    createAddress,
    updateAddress,
    createBooking,
  };
})();
