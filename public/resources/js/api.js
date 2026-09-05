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
    const DEMO_MODE = false;
    const BASE_URL = '/gateway/v1';

    /**
     * POST /api/v1/signup/otp/dispatch
     * Payload: { mobile: string }
     * Triggers OTP generation + delivery to the customer's mobile device.
     * @returns {Promise<{success: boolean, message?: string, demoOtp?: string}>}
     */
    async function requestOtp(op, mobile) {
        const payload = {
            op: op,
            input: mobile
        };

        if (DEMO_MODE) {
            return simulateOtpRequest(payload);
        }

        try {
            const res = await fetch(
                    BASE_URL + '/' + op + '/otp/request',
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    }
            );
            let json = await res.json();
            if (res.status === 200) {
                return json;
            } else {
                return {success: false, message: json.message};
            }
        } catch (e) {
            console.error(e.message, e);
            return {success: false, message: e.message};

            // return simulateOtpRequest(payload);
        }
    }

    /**
     * POST /api/v1/signup/otp/verify
     * Payload: { mobile: string, otp: string }
     * @returns {Promise<{success: boolean, message?: string, token?: string}>}
     */
    async function verifyOtp(op, mobile, otp) {
        const payload = {
            op: op,
            input: mobile,
            otp: otp
        };

        if (DEMO_MODE) {
            return simulateOtpVerify(payload);
        }

        try {
            const res = await fetch(
                    BASE_URL + '/' + op + '/otp/verify',
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    }
            );
            let json = await res.json();
            if (res.status === 200) {
                if (op === 'signup') {
                    return json;
                } else {
                    // Post successful login, the response object will have the user details. 
                    return {success: true, result: json};
                }
            } else if (res.status === 401) {
                return {success: false, message: 'You are not authorized. Please wait for 5 minutes and start the flow again'};
            } else if (res.status === 404) {
                return {success: false, code: 404, message: json.message};
            } else {
                return {success: false, message: json.message};
            }
        } catch (e) {
            console.error(e.message, e);
            return {success: false, message: e.message};

            // return simulateOtpVerify(payload);
        }
    }

    /**
     * POST /api/v1/logout
     * Payload: { mobile: string, name: string, email: string }
     * @returns {Promise<{success: boolean, message?: string, user?: object}>}
     */
    async function logout() {
        try {
            const res = await fetch(
                    BASE_URL + '/logout',
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        credentials: 'include'
                    }
            );
            if (res.status === 204) {
                return {success: true};
            }
            else if (res.status === 401) {
                // Cookie not found.
                return {success: true};
            }
            else {
                return {success: false, message: res.message};
            }
        } catch (e) {
            console.error(e.message, e);
            return {success: false, message: e.message};
        }
    }

    /**
     * POST /api/v1/registration
     * Payload: { mobile: string, name: string, email: string }
     * @returns {Promise<{success: boolean, message?: string, user?: object}>}
     */
    async function createUser(payload) {
        if (DEMO_MODE) {
            return simulateCreateUser(payload);
        }

        try {
            const res = await fetch(
                    BASE_URL + '/users',
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    }
            );
            let json = await res.json();
            if (res.status === 201) {
                return {success: true, result: json};
            }
            else if (res.status === 409) {
                return {success: false, message: 'Your mobile/email is already registered ' + payload.fullName + '!'};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error(e.message, e);
            return {success: false, message: e.message};
        }
    }

    /**
     * PUT /api/v1/users
     * Payload: full user object, including id, with updated field values.
     * @returns {Promise<{success: boolean, message?: string, user?: object}>}
     */
    async function updateUser(id, payload) {
        if (DEMO_MODE) {
            return simulateUpdateUser(payload);
        }

        try {
            const res = await fetch(
                BASE_URL + '/users/' + id,
                {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};

            // return simulateUpdateUser(payload);
        }
    }

    async function viewUser(id) {
        try {
            const res = await fetch(
                BASE_URL + '/users/' + id,
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch profile:', e);
            return {'success': false, 'message': e.message};
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
            const res = await fetch(
                BASE_URL + '/addresses',
                {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                }
            );
            let json = await res.json();
            if (res.status === 201) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};

            // return simulateCreateAddress(payload);
        }
    }

    /**
     * PUT /api/v1/addresses
     * Payload: full address object, including id, with updated field values.
     * @returns {Promise<{success: boolean, message?: string, address?: object}>}
     */
    async function updateAddress(id, payload) {
        if (DEMO_MODE) {
            return simulateUpdateAddress(payload);
        }

        try {
            const res = await fetch(
                BASE_URL + '/addresses/' + id,
                {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};

            // return simulateUpdateAddress(payload);
        }
    }

    async function viewAddresses() {
        try {
            const res = await fetch(
                BASE_URL + '/addresses',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch all addresses:', e);
            return {'success': false, 'message': e.message};
        }
    }

    async function deleteAddress(id) {
        try {
            const res = await fetch(
                BASE_URL + '/addresses/' + id,
                {
                    method: 'DELETE',
                    credentials: 'include'
                }
            );
            if (res.status === 204) {
                return {success: true};
            }
            else {
                let json = await res.json();
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch all addresses:', e);
            return {'success': false, 'message': e.message};
        }
    }

    async function viewCategories() {
        try {
            const res = await fetch(
                BASE_URL + '/categories/hierarchy',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch all categories:', e);
            return {'success': false, 'message': e.message};
        }
    }

    async function viewSlots(dateKey, serviceId) {
        try {
            const res = await fetch(
                BASE_URL + '/availabilities/slots?date=' + dateKey + '&serviceId=' + serviceId,
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch all categories:', e);
            return {'success': false, 'message': e.message};
        }
    }

    /**
     * POST /api/v1/bookings
     * Payload: { services: [{ name, date, timeSlot, quantity, price, address }], paymentMethod, amount }
     * Note: no `customer` field — the server identifies who's booking from
     * the JWT cookie set at OTP-verify / signup time, not from the request
     * body. This keeps the browser from ever having to (re)send identity
     * details it already proved once.
     * @returns {Promise<{success: boolean, message?: string, booking?: object}>}
     */
    async function createBooking(payload) {
        if (DEMO_MODE) {
            return simulateCreateBooking(payload);
        }

        try {
            let uri = BASE_URL + '/bookings';

            const res = await fetch(uri, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            let json = await res.json();
            if (res.status === 201) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        } catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};

            // The demo simulator has no server-side session to read a customer
            // from, so — only on this client-side-only fallback path — attach
            // whoever script.js currently considers logged in.
            // const demoPayload = {
            //     ...payload,
            //     customer: (typeof getCurrentUser === 'function' && getCurrentUser()) || null,
            // };
            // return simulateCreateBooking(demoPayload);
        }
    }

    /**
     * GET /api/v1/bookings
     * Returns every booking (current and past) belonging to the signed-in
     * customer. The server identifies who that is from the JWT cookie, not
     * from a query parameter — `userId` is only still accepted here to keep
     * the demo-mode fallback (which has no server-side session) working.
     * @returns {Promise<{success: boolean, message?: string, bookings?: object[]}>}
     */
    async function getBookings() {
        // if (DEMO_MODE) {
        //     return simulateGetBookings(userId);
        // }

        try {
            let uri = BASE_URL + '/bookings?fetchDependency=true';

            const res = await fetch(uri, {
                method: 'GET',
                headers: {'Content-Type': 'application/json'}
            });
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        } catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};

            // return simulateGetBookings(userId);
        }
    }

    /**
     * PUT /api/v1/bookings/{id}
     * Cancels an upcoming booking. Payload: { status: 'cancelled' }
     * @returns {Promise<{success: boolean, message?: string, booking?: object}>}
     */
    async function cancelBooking(bookingId) {
        if (DEMO_MODE) {
            return simulateCancelBooking(bookingId);
        }

        try {
            let uri = BASE_URL + '/bookings/' + encodeURIComponent(bookingId);

            const res = await fetch(uri, {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include'
            });
            if (res.status === 204) {
                return {'success': true, 'message': 'Booking cancelled successfully'};
            }
            throw new Error(`Booking cancellation request to url ${uri} has failed. Status: ${res.status}. Error Msg: ${res.message}`);
        } catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};

            // return simulateCancelBooking(bookingId);
        }
    }

    /**
     * POST /api/v1/professionals
     * Payload: { userId, aadhaarNumber, nameOnId, panNumber, yearsOfExperience,
     *            expertiseAreas: string[],
     *            currentAddress: { addressLine, locality, city, pincode } }
     * @returns {Promise<{success: boolean, message?: string, application?: object}>}
     */
    async function applyAsProfessional(payload) {
        if (DEMO_MODE) {
            return simulateApplyAsProfessional(payload);
        }

        try {
            let uri = BASE_URL + '/professionals';

            const res = await fetch(uri, {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            let json = await res.json();
            
            if (res.status === 201) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error(e.message, e);
            return {'success': false, 'message': e.message};
        }
    }

    async function viewProfessional(id) {
        try {
            const res = await fetch(
                BASE_URL + '/professionals/' + id,
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch profile:', e);
            return {'success': false, 'message': e.message};
        }
    }

    async function viewDocuments() {
        try {
            const res = await fetch(
                BASE_URL + '/documents',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch document:', e);
            return {'success': false, 'message': e.message};
        }
    }

    async function viewProfessionalServices() {
        try {
            const res = await fetch(
                BASE_URL + '/professionalServices',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch professional service:', e);
            return {'success': false, 'message': e.message};
        }
    }

    async function viewVouchers() {
        try {
            const res = await fetch(
                BASE_URL + '/coupons',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );
            let json = await res.json();
            if (res.status === 200) {
                return {success: true, result: json};
            }
            else {
                return {success: false, message: json.message};
            }
        }
        catch (e) {
            console.error('[Folks] Failed to fetch voucher:', e);
            return {'success': false, 'message': e.message};
        }
    }

    /* ---- demo-mode simulators (safe to delete once real endpoints are live) ---- */
    const _demoOtpByMobile = {};

    // A minimal stand-in for a real backend's bookings table. Persisted under
    // its own key (distinct from the client-side session/cart keys owned by
    // script.js) since this represents server state, not client state.
    const _DEMO_BOOKINGS_KEY = 'folks_demo_bookings_db';
    function _loadDemoBookings() {
        try {
            const raw = localStorage.getItem(_DEMO_BOOKINGS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }
    const _demoBookingsDb = _loadDemoBookings();
    function _persistDemoBookings() {
        try {
            localStorage.setItem(_DEMO_BOOKINGS_KEY, JSON.stringify(_demoBookingsDb));
        } catch (err) {
            console.warn('[Folks] Could not persist demo bookings (safe to ignore):', err);
        }
    }

    function simulateOtpRequest(payload) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        _demoOtpByMobile[payload.mobile] = otp;
        console.info(`[Folks demo] OTP for ${payload.mobile}: ${otp}`);
        return delay({success: true, message: 'OTP sent', demoOtp: otp}, 900);
    }

    function simulateOtpVerify(payload) {
        const expected = _demoOtpByMobile[payload.mobile];
        const ok = Boolean(expected) && payload.otp === expected;
        return delay(
                ok
                ? {success: true, message: 'OTP verified', token: 'demo-token'}
        : {success: false, message: 'Incorrect OTP. Please try again.'},
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
        return delay({success: true, message: 'Profile updated', user: payload}, 700);
    }

    function simulateCreateAddress(payload) {
        return delay({
            success: true,
            address: {id: `addr-${Date.now()}`, ...payload},
        }, 700);
    }

    function simulateUpdateAddress(payload) {
        return delay({success: true, message: 'Address updated', address: payload}, 700);
    }

    function simulateCreateBooking(payload) {
        const booking = {
            id: `bkg-${Date.now()}`,
            status: 'confirmed',
            createdOn: new Date().toISOString(),
            ...payload,
        };
        _demoBookingsDb.push(booking);
        _persistDemoBookings();
        return delay({success: true, booking}, 1000);
    }

    function simulateGetBookings(userId) {
        const bookings = _demoBookingsDb
                .filter(b => !userId || (b.customer && b.customer.id === userId))
                .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        return delay({success: true, bookings}, 600);
    }

    function simulateCancelBooking(bookingId) {
        const booking = _demoBookingsDb.find(b => b.id === bookingId);
        if (!booking) {
            return delay({success: false, message: 'Booking not found.'}, 400);
        }
        booking.status = 'cancelled';
        booking.cancelledOn = new Date().toISOString();
        _persistDemoBookings();
        return delay({success: true, booking}, 700);
    }

    function simulateApplyAsProfessional(payload) {
        return delay({
            success: true,
            application: {
                id: `pro-app-${Date.now()}`,
                status: 'Pending Review',
                submittedOn: new Date().toISOString(),
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
        logout,
        createUser,
        updateUser,
        viewUser,
        createAddress,
        updateAddress,
        viewAddresses,
        deleteAddress,
        viewCategories,
        viewSlots,
        createBooking,
        getBookings,
        cancelBooking,
        applyAsProfessional,
        viewProfessional,
        viewProfessionalServices,
        viewDocuments,
        viewVouchers
    };
})();
