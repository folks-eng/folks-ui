/* =========================================================================
 FOLKS — professional-onboarding.js
 Drives professional-onboarding.html, the page "Become a Professional"
 now lands on. Three steps:

   1. OTP verification — same UX as the login popup in script.js
      (mobile -> waiting -> otp -> waiting -> success), rendered inline.
   2. Routing once the number is verified:
        - already a registered professional  -> professional-portal.html
        - existing account, no application   -> application form (step 3)
        - no Folks account for this number   -> name/email, one more OTP
          via the signup endpoint, account created with role PROFESSIONAL,
          then the application form (step 3)
   3. Application form — ported from become-professional.js (identity,
      current address cascade, expertise, serving localities, declaration)
      and submitted via FolksAPI.applyAsProfessional().

 Reuses, without modifying:
   - api.js    : FolksAPI.requestOtp / verifyOtp / createUser /
                 viewProfessional / applyAsProfessional / viewProvinces /
                 viewCities / viewNeighbourhoods / viewCategories
   - script.js : isLoggedIn, getCurrentUser, saveCurrentUser, setLoggedIn,
                 renderUserChip, postLogout, getStoredAddress, initRipple

 Everything lives inside this IIFE so none of its helpers can collide with
 the globals defined by script.js / become-professional.js. No network
 calls happen directly in this file.
 ========================================================================= */

(function () {
    'use strict';

    const PORTAL_PAGE = 'professional-portal.html';
    const REDIRECT_DELAY_MS = 1200;
    const RESEND_SECONDS = 30;

    // Sentinel id for "All Localities" (same contract as become-professional.js).
    const ALL_LOCALITIES_ID = '-1';

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof FolksAPI === 'undefined' || typeof getCurrentUser === 'undefined')
            return;
        if (!document.getElementById('poPhone'))
            return; // guard: only runs on this page
        initOtpFlow();
    });

    /* =====================================================================
     STEP 1 — OTP VERIFICATION
     ===================================================================== */
    function initOtpFlow() {
        const phone = document.getElementById('poPhone');
        const screens = {
            mobile: phone.querySelector('[data-screen="po-mobile"]'),
            waiting: phone.querySelector('[data-screen="po-waiting"]'),
            otp: phone.querySelector('[data-screen="po-otp"]'),
            account: phone.querySelector('[data-screen="po-account"]'),
            message: phone.querySelector('[data-screen="po-message"]'),
            success: phone.querySelector('[data-screen="po-success"]')
        };
        const waitingLabel = document.getElementById('poWaitingLabel');

        const state = {
            mobile: '',
            // 'login'  -> OTP for an existing account (POST login/otp/*)
            // 'signup' -> OTP to create a new account (POST signup/otp/*)
            mode: 'login',
            account: {fullName: '', email: ''},
            activeScreen: screens.mobile,
            resendTimer: null,
            resendSecondsLeft: RESEND_SECONDS,
            retry: null
        };

        /* ---- screen navigation (identical behaviour to the login popup) -- */
        function goTo(targetScreen, direction) {
            const outgoing = state.activeScreen;
            if (outgoing === targetScreen)
                return;

            targetScreen.classList.remove('screen-off-left', 'screen-off-right');
            targetScreen.classList.add(direction === 'forward' ? 'screen-off-right' : 'screen-off-left');
            targetScreen.inert = false;
            targetScreen.removeAttribute('aria-hidden');
            void targetScreen.offsetWidth;

            requestAnimationFrame(() => {
                outgoing.classList.remove('screen-current');
                outgoing.classList.add(direction === 'forward' ? 'screen-off-left' : 'screen-off-right');
                outgoing.inert = true;
                outgoing.setAttribute('aria-hidden', 'true');

                targetScreen.classList.remove('screen-off-left', 'screen-off-right');
                targetScreen.classList.add('screen-current');
            });

            state.activeScreen = targetScreen;
        }

        function goToWaiting(label, direction) {
            waitingLabel.textContent = label;
            goTo(screens.waiting, direction);
        }

        function showMessage(title, text, retryLabel, onRetry) {
            document.getElementById('poMessageTitle').textContent = title;
            document.getElementById('poMessageText').textContent = text;
            document.getElementById('poMessageRetryBtn').textContent = retryLabel || 'Try again';
            state.retry = onRetry;
            goTo(screens.message, 'forward');
        }

        function showSuccess(title, text) {
            document.getElementById('poSuccessTitle').textContent = title;
            document.getElementById('poSuccessMessage').textContent = text;
            goTo(screens.success, 'forward');
        }

        function clearOtpBoxes() {
            otpBoxes.forEach(b => {
                b.value = '';
                b.classList.remove('is-filled');
            });
        }

        function backToMobile() {
            clearInterval(state.resendTimer);
            state.mode = 'login';
            clearOtpBoxes();
            hideErr('poOtpError');
            goTo(screens.mobile, 'back');
            setTimeout(() => mobileInput.focus(), 300);
        }

        document.getElementById('poMessageRetryBtn').addEventListener('click', () => {
            const fn = state.retry;
            state.retry = null;
            if (fn)
                fn();
        });

        /* ---- SCREEN: mobile number -> waiting -> otp --------------------- */
        const mobileInput = document.getElementById('poMobile');
        const sendOtpBtn = document.getElementById('poSendOtpBtn');

        mobileInput.addEventListener('input', () => {
            mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
        });
        mobileInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')
                sendOtpBtn.click();
        });

        sendOtpBtn.addEventListener('click', async () => {
            hideErr('poMobileError');
            const mobile = mobileInput.value.trim();

            if (!/^[6-9]\d{9}$/.test(mobile)) {
                showErr('poMobileError', 'Enter a valid 10-digit mobile number.');
                mobileInput.focus();
                return;
            }

            state.mobile = mobile;
            state.mode = 'login';
            goToWaiting('Sending your OTP…', 'forward');

            const result = await FolksAPI.requestOtp('login', mobile);

            if (!result.success) {
                goTo(screens.mobile, 'back');
                showErr('poMobileError', result.message || 'Could not send OTP. Please try again.');
                return;
            }
            openOtpScreen(result);
        });

        function openOtpScreen(result) {
            document.getElementById('poOtpMobileDisplay').textContent = `+91 ${state.mobile}`;
            const hint = document.getElementById('poOtpHint');
            if (result && result.demoOtp) {
                hint.hidden = false;
                hint.textContent = `Demo mode — no SMS gateway connected. Your OTP is ${result.demoOtp}.`;
            } else {
                hint.hidden = true;
            }
            clearOtpBoxes();
            hideErr('poOtpError');
            goTo(screens.otp, 'forward');
            startResendCountdown();
            setTimeout(() => phone.querySelector('.otp-box[data-otp-index="0"]')?.focus(), 300);
        }

        /* ---- SCREEN: OTP entry ------------------------------------------- */
        const otpBoxes = Array.from(phone.querySelectorAll('.otp-box'));
        const verifyOtpBtn = document.getElementById('poVerifyOtpBtn');
        const resendOtpBtn = document.getElementById('poResendOtpBtn');
        const resendTimerLabel = document.getElementById('poResendTimer');

        otpBoxes.forEach((box, index) => {
            box.addEventListener('input', () => {
                box.value = box.value.replace(/\D/g, '').slice(0, 1);
                box.classList.toggle('is-filled', box.value !== '');
                if (box.value && index < otpBoxes.length - 1)
                    otpBoxes[index + 1].focus();
            });
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !box.value && index > 0)
                    otpBoxes[index - 1].focus();
                if (e.key === 'Enter')
                    verifyOtpBtn.click();
            });
            box.addEventListener('paste', (e) => {
                e.preventDefault();
                const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').split('');
                digits.forEach((d, i) => {
                    if (otpBoxes[i]) {
                        otpBoxes[i].value = d;
                        otpBoxes[i].classList.add('is-filled');
                    }
                });
                const nextEmpty = otpBoxes.find(b => !b.value) || otpBoxes[otpBoxes.length - 1];
                nextEmpty.focus();
            });
        });

        document.getElementById('poChangeMobileBtn').addEventListener('click', backToMobile);

        function startResendCountdown() {
            state.resendSecondsLeft = RESEND_SECONDS;
            resendOtpBtn.disabled = true;
            resendOtpBtn.textContent = 'Resend in ';
            resendTimerLabel.textContent = state.resendSecondsLeft;
            resendOtpBtn.appendChild(resendTimerLabel);
            resendOtpBtn.appendChild(document.createTextNode('s'));
            clearInterval(state.resendTimer);
            state.resendTimer = setInterval(() => {
                state.resendSecondsLeft -= 1;
                if (state.resendSecondsLeft <= 0) {
                    clearInterval(state.resendTimer);
                    resendOtpBtn.disabled = false;
                    resendOtpBtn.textContent = 'Resend OTP';
                } else {
                    resendTimerLabel.textContent = state.resendSecondsLeft;
                }
            }, 1000);
        }

        resendOtpBtn.addEventListener('click', async () => {
            resendOtpBtn.disabled = true;
            resendOtpBtn.textContent = 'Resending…';
            hideErr('poOtpError');
            const result = await FolksAPI.requestOtp(state.mode, state.mobile);
            if (!result.success) {
                showErr('poOtpError', result.message || 'Could not resend OTP. Please try again.');
            }
            const hint = document.getElementById('poOtpHint');
            if (result.demoOtp) {
                hint.hidden = false;
                hint.textContent = `Demo mode — no SMS gateway connected. Your new OTP is ${result.demoOtp}.`;
            }
            startResendCountdown();
        });

        verifyOtpBtn.addEventListener('click', async () => {
            hideErr('poOtpError');
            const otp = otpBoxes.map(b => b.value).join('');

            if (otp.length !== 6) {
                showErr('poOtpError', 'Enter the full 6-digit OTP.');
                return;
            }

            clearInterval(state.resendTimer);
            goToWaiting('Verifying your code…', 'forward');

            const result = await FolksAPI.verifyOtp(state.mode, state.mobile, otp);

            if (!result.success) {
                if (state.mode === 'login' && result.code === 404) {
                    // Number verified, but no Folks account behind it.
                    goTo(screens.account, 'forward');
                    setTimeout(() => document.getElementById('poName')?.focus(), 300);
                    return;
                }
                goTo(screens.otp, 'back');
                clearOtpBoxes();
                otpBoxes[0].focus();
                if (result.code === 401) {
                    showErr('poOtpError', 'Your session is expired. Please refresh the browser and try again');
                } else {
                    showErr('poOtpError', result.message || 'Could not verify the OTP. Please try again.');
                    startResendCountdown();
                }
                return;
            }

            if (state.mode === 'signup') {
                await createProfessionalAccount();
                return;
            }

            // Logged in to an existing account.
            const user = result.result;
            startSession(user, result.expiresOn);
            await routeAfterLogin(user);
        });

        /* ---- SCREEN: new account details --------------------------------- */
        const nameInput = document.getElementById('poName');
        const emailInput = document.getElementById('poEmail');

        document.getElementById('poTryAnotherNumberBtn').addEventListener('click', backToMobile);

        document.getElementById('poCreateAccountBtn').addEventListener('click', async () => {
            hideErr('poAccountError');
            const fullName = nameInput.value.trim();
            const email = emailInput.value.trim();

            if (fullName.length < 2) {
                showErr('poAccountError', 'Please enter your full name.');
                nameInput.focus();
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showErr('poAccountError', 'Please enter a valid email address.');
                emailInput.focus();
                return;
            }

            state.account = {fullName, email};
            state.mode = 'signup';
            goToWaiting('Sending your OTP…', 'forward');

            const result = await FolksAPI.requestOtp('signup', state.mobile);
            if (!result.success) {
                state.mode = 'login';
                goTo(screens.account, 'back');
                showErr('poAccountError', result.message || 'Could not send OTP. Please try again.');
                return;
            }
            openOtpScreen(result);
        });

        async function createProfessionalAccount() {
            goToWaiting('Setting up your account…', 'forward');

            const result = await FolksAPI.createUser({
                phone1: state.mobile,
                fullName: state.account.fullName,
                email: state.account.email,
                role: 'PROFESSIONAL'
            });

            if (!result.success) {
                state.mode = 'login';
                goTo(screens.account, 'back');
                const msg = String(result.message || '');
                showErr('poAccountError', msg.startsWith('Your mobile/email is already registered')
                        ? msg + ' Please use a different email, or go back and verify with the number you registered with.'
                        : 'Could not complete registration. Please try again.');
                return;
            }

            const user = result.result;
            startSession(user, result.expiresOn);
            showSuccess('Welcome to Folks!', `Thanks, ${firstName(user)}. Next, tell us about your work.`);
            setTimeout(() => showApplicationForm(user), REDIRECT_DELAY_MS);
        }

        /* ---- after login: registered professional or new application? ---- */
        async function routeAfterLogin(user) {
            goToWaiting('Checking your professional account…', 'forward');

            const res = await FolksAPI.viewProfessional(user.externalId);

            if (res.success && hasProfessionalRecord(res.result)) {
                showSuccess('You\'re logged in!', `Good to see you again, ${firstName(user)}. Taking you to your dashboard…`);
                setTimeout(() => {
                    window.location.href = PORTAL_PAGE;
                }, REDIRECT_DELAY_MS);
                return;
            }

            // 403/404 (or an empty record) -> no professional profile yet.
            if (res.success || res.code === 404 || res.code === 403) {
                showSuccess('You\'re verified!', `Thanks, ${firstName(user)}. Next, tell us about your work.`);
                setTimeout(() => showApplicationForm(user), REDIRECT_DELAY_MS);
                return;
            }

            if (res.code === 401 || res.authExpired) {
                postLogout();
                showMessage('Session expired', 'Your session has expired. Please verify your number again.', 'Start again', backToMobile);
                return;
            }

            showMessage('Something went wrong',
                    res.message || 'We couldn\'t check your professional account right now.',
                    'Try again',
                    () => routeAfterLogin(user));
        }

        /* ---- already logged in when landing here: skip straight to routing */
        (async () => {
            let loggedIn = false;
            try {
                loggedIn = await isLoggedIn();
            } catch (err) {
                loggedIn = false;
            }
            const user = getCurrentUser();
            if (loggedIn && user && user.externalId) {
                await routeAfterLogin(user);
            } else {
                setTimeout(() => mobileInput.focus(), 300);
            }
        })();
    }

    /** Same session bookkeeping completeLogin() does, minus its
     *  postSignupRedirect hop — this page decides where to go next. */
    function startSession(user, expiresOn) {
        saveCurrentUser(user);
        setLoggedIn(expiresOn);
        renderUserChip(user);
    }

    function hasProfessionalRecord(result) {
        if (!result || typeof result !== 'object' || Object.keys(result).length === 0)
            return false;
        return Boolean(result.professionalId || result.applicationId || result.externalId || result.user);
    }

    function firstName(user) {
        return String((user && (user.fullName || user.name)) || 'there').trim().split(' ')[0];
    }

    /* =====================================================================
     STEP 3 — APPLICATION FORM (ported from become-professional.js)
     ===================================================================== */
    let formInitialised = false;

    const proLoc = {
        provinceId: '', province: '',
        cityId: '', city: '',
        neighbourhoodId: '', locality: '', pincode: '',
        provinces: [], cities: [], neighbourhoods: [],
        loadingNeighbourhoods: false,
        servingNeighbourhoodIds: []
    };

    function showApplicationForm(user) {
        document.getElementById('poAuthSection').hidden = true;
        document.getElementById('poApplicationSuccess').hidden = true;
        document.getElementById('poFormContent').hidden = false;
        window.scrollTo({top: 0, behavior: 'smooth'});

        if (formInitialised)
            return;
        formInitialised = true;

        prefillFromExistingData(user);
        renderExpertiseGroups();
        initLocationPicker();
        wireSubmit();
        if (typeof initRipple === 'function')
            initRipple();
    }

    function localityOptionLabel(n) {
        return n.pincode ? `${n.locality} - ${n.pincode}` : n.locality;
    }

    function sortByLocalityOptionLabel(neighbourhoods) {
        return neighbourhoods.slice().sort((a, b) =>
            localityOptionLabel(a).localeCompare(localityOptionLabel(b), undefined, {numeric: true, sensitivity: 'base'})
        );
    }

    function sortByLocalityName(neighbourhoods) {
        return neighbourhoods.slice().sort((a, b) =>
            (a.locality || '').localeCompare(b.locality || '', undefined, {numeric: true, sensitivity: 'base'})
        );
    }

    function listFrom(res) {
        return (res.result && (res.result.items || res.result)) || [];
    }

    function cityOptions(cities) {
        return '<option value="">Select a city…</option>' +
                cities.map(c => `<option value="${escapeAttr(c.cityId)}">${escapeHtml(c.cityName)}</option>`).join('');
    }

    function localityOptions(neighbourhoods) {
        return '<option value="">Select a locality…</option>' +
                sortByLocalityOptionLabel(neighbourhoods).map(n => `<option value="${escapeAttr(n.neighbourhoodId)}">${escapeHtml(localityOptionLabel(n))}</option>`).join('');
    }

    async function initLocationPicker() {
        const stateSel = document.getElementById('poState');
        const citySel = document.getElementById('poCity');
        const localitySel = document.getElementById('poLocality');

        const res = await FolksAPI.viewProvinces();
        if (res.success) {
            proLoc.provinces = listFrom(res);
            stateSel.innerHTML = '<option value="">Select a state…</option>' +
                    proLoc.provinces.map(p => `<option value="${escapeAttr(p.provinceId)}">${escapeHtml(p.provinceName)}</option>`).join('');
        } else {
            showErr('poAddressError', res.message || 'Could not load states. Please try again.');
        }

        stateSel.addEventListener('change', async () => {
            hideErr('poAddressError');
            proLoc.provinceId = stateSel.value;
            proLoc.province = stateSel.selectedOptions[0] ? stateSel.selectedOptions[0].textContent : '';
            resetCityAndBelow();
            localitySel.innerHTML = '<option value="">Select a city first…</option>';
            localitySel.disabled = true;
            renderServingLocalities();

            if (!proLoc.provinceId) {
                citySel.innerHTML = '<option value="">Select a state first…</option>';
                citySel.disabled = true;
                return;
            }
            citySel.disabled = true;
            citySel.innerHTML = '<option value="">Loading cities…</option>';
            const citiesRes = await FolksAPI.viewCities(proLoc.provinceId);
            if (citiesRes.success) {
                proLoc.cities = listFrom(citiesRes);
                citySel.innerHTML = cityOptions(proLoc.cities);
                citySel.disabled = false;
            } else {
                citySel.innerHTML = '<option value="">Could not load cities</option>';
                showErr('poAddressError', citiesRes.message || 'Could not load cities for the selected state.');
            }
        });

        citySel.addEventListener('change', async () => {
            hideErr('poAddressError');
            proLoc.cityId = citySel.value;
            proLoc.city = citySel.selectedOptions[0] ? citySel.selectedOptions[0].textContent : '';
            resetLocalityAndBelow();

            if (!proLoc.cityId) {
                localitySel.innerHTML = '<option value="">Select a city first…</option>';
                localitySel.disabled = true;
                renderServingLocalities();
                return;
            }
            localitySel.disabled = true;
            localitySel.innerHTML = '<option value="">Loading localities…</option>';
            proLoc.loadingNeighbourhoods = true;
            renderServingLocalities();
            const neighbourhoodsRes = await FolksAPI.viewNeighbourhoods(proLoc.cityId);
            proLoc.loadingNeighbourhoods = false;
            if (neighbourhoodsRes.success) {
                proLoc.neighbourhoods = listFrom(neighbourhoodsRes);
                localitySel.innerHTML = localityOptions(proLoc.neighbourhoods);
                localitySel.disabled = false;
            } else {
                localitySel.innerHTML = '<option value="">Could not load localities</option>';
                showErr('poAddressError', neighbourhoodsRes.message || 'Could not load localities for the selected city.');
            }
            renderServingLocalities();
        });

        localitySel.addEventListener('change', () => {
            const match = proLoc.neighbourhoods.find(n => String(n.neighbourhoodId) === String(localitySel.value));
            proLoc.neighbourhoodId = localitySel.value;
            proLoc.locality = match ? match.locality : '';
            proLoc.pincode = match ? (match.pincode || '') : '';
            document.getElementById('poPincode').value = proLoc.pincode;
        });
    }

    function resetCityAndBelow() {
        proLoc.cityId = '';
        proLoc.city = '';
        proLoc.cities = [];
        resetLocalityAndBelow();
    }

    function resetLocalityAndBelow() {
        proLoc.neighbourhoodId = '';
        proLoc.locality = '';
        proLoc.pincode = '';
        proLoc.neighbourhoods = [];
        proLoc.servingNeighbourhoodIds = [];
        const pincodeInput = document.getElementById('poPincode');
        if (pincodeInput)
            pincodeInput.value = '';
    }

    function renderServingLocalities() {
        const container = document.getElementById('poServingLocalities');
        const hint = document.getElementById('poServingLocalitiesHint');

        const setHint = (text) => {
            container.innerHTML = '';
            hint.hidden = false;
            hint.textContent = text;
        };

        if (!proLoc.cityId)
            return setHint('Select your state and city above to see localities you can serve.');
        if (proLoc.loadingNeighbourhoods)
            return setHint('Loading localities…');
        if (proLoc.neighbourhoods.length === 0)
            return setHint('No localities found for this city yet.');
        hint.hidden = true;

        // "All Localities" is mutually exclusive with picking individual ones.
        const allSelected = proLoc.servingNeighbourhoodIds.includes(ALL_LOCALITIES_ID);

        const allChip = `
      <label class="pro-expertise-chip pro-expertise-chip-all">
        <input type="checkbox" value="${ALL_LOCALITIES_ID}" data-po-serving-all ${allSelected ? 'checked' : ''}>
        <span>★ All Localities</span>
      </label>`;
        const localityChips = sortByLocalityName(proLoc.neighbourhoods).map(n => `
      <label class="pro-expertise-chip">
        <input type="checkbox" value="${escapeAttr(n.neighbourhoodId)}" data-po-serving ${allSelected ? 'disabled' : ''} ${!allSelected && proLoc.servingNeighbourhoodIds.includes(String(n.neighbourhoodId)) ? 'checked' : ''}>
        <span>${escapeHtml(n.locality)}</span>
      </label>`).join('');
        container.innerHTML = allChip + localityChips;

        const allCb = container.querySelector('[data-po-serving-all]');
        allCb.addEventListener('change', () => {
            proLoc.servingNeighbourhoodIds = allCb.checked ? [ALL_LOCALITIES_ID] : [];
            renderServingLocalities();
        });

        container.querySelectorAll('[data-po-serving]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.value;
                if (cb.checked) {
                    if (!proLoc.servingNeighbourhoodIds.includes(id))
                        proLoc.servingNeighbourhoodIds.push(id);
                } else {
                    proLoc.servingNeighbourhoodIds = proLoc.servingNeighbourhoodIds.filter(x => x !== id);
                }
            });
        });
    }

    /* Best-effort pre-fill of the cascade from a saved address ("Use my saved
     address"). Leaves the selects untouched when the saved address has no
     provinceId/cityId/neighbourhoodId on file. */
    async function primeLocationFromSavedAddress(savedAddress) {
        const stateSel = document.getElementById('poState');
        const citySel = document.getElementById('poCity');
        const localitySel = document.getElementById('poLocality');
        if (!savedAddress.provinceId)
            return;

        stateSel.value = String(savedAddress.provinceId);
        if (stateSel.value !== String(savedAddress.provinceId))
            return;
        resetCityAndBelow();
        proLoc.provinceId = savedAddress.provinceId;
        proLoc.province = savedAddress.province || (stateSel.selectedOptions[0] ? stateSel.selectedOptions[0].textContent : '');

        if (!savedAddress.cityId)
            return;
        citySel.disabled = true;
        citySel.innerHTML = '<option value="">Loading cities…</option>';
        const citiesRes = await FolksAPI.viewCities(savedAddress.provinceId);
        if (!citiesRes.success)
            return;
        proLoc.cities = listFrom(citiesRes);
        citySel.innerHTML = cityOptions(proLoc.cities);
        citySel.disabled = false;
        citySel.value = String(savedAddress.cityId);
        proLoc.cityId = savedAddress.cityId;
        proLoc.city = savedAddress.city || proLoc.city;

        if (!savedAddress.neighbourhoodId)
            return;
        localitySel.disabled = true;
        localitySel.innerHTML = '<option value="">Loading localities…</option>';
        const neighbourhoodsRes = await FolksAPI.viewNeighbourhoods(savedAddress.cityId);
        if (!neighbourhoodsRes.success)
            return;
        proLoc.neighbourhoods = listFrom(neighbourhoodsRes);
        localitySel.innerHTML = localityOptions(proLoc.neighbourhoods);
        localitySel.disabled = false;
        localitySel.value = String(savedAddress.neighbourhoodId);
        proLoc.neighbourhoodId = savedAddress.neighbourhoodId;
        const match = proLoc.neighbourhoods.find(n => String(n.neighbourhoodId) === String(savedAddress.neighbourhoodId));
        proLoc.locality = match ? match.locality : (savedAddress.locality || '');
        proLoc.pincode = match ? (match.pincode || '') : (savedAddress.pincode || '');
        document.getElementById('poPincode').value = proLoc.pincode;
        renderServingLocalities();
    }

    /* Deliberately NOT auto-filling the current address from the saved
     profile address (same reasoning as become-professional.js): the
     "Use my saved address" button is an opt-in shortcut instead. */
    function prefillFromExistingData(user) {
        const nameInput = document.getElementById('poNameOnId');
        const name = user && (user.fullName || user.name);
        if (nameInput && !nameInput.value && name)
            nameInput.value = name;

        const aadhaarInput = document.getElementById('poAadhaar');
        aadhaarInput.addEventListener('input', () => {
            const digits = aadhaarInput.value.replace(/\D/g, '').slice(0, 12);
            aadhaarInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
        });

        const panInput = document.getElementById('poPan');
        panInput.addEventListener('input', () => {
            panInput.value = panInput.value.toUpperCase().slice(0, 10);
        });

        if (typeof getStoredAddress !== 'function')
            return;
        Promise.resolve()
                .then(() => getStoredAddress())
                .then((savedAddress) => {
                    const useSavedBtn = document.getElementById('poUseSavedAddressBtn');
                    if (!savedAddress || !savedAddress.addressLine1 || !useSavedBtn)
                        return;
                    useSavedBtn.hidden = false;
                    useSavedBtn.addEventListener('click', () => {
                        document.getElementById('poAddressLine').value = savedAddress.addressLine1 || '';
                        primeLocationFromSavedAddress(savedAddress);
                    });
                })
                .catch(() => { /* no saved address available — shortcut stays hidden */ });
    }

    async function renderExpertiseGroups() {
        const container = document.getElementById('poExpertiseGroups');
        container.innerHTML = '<p class="modal-hint">Loading services…</p>';

        const res = await FolksAPI.viewCategories();
        if (!res.success) {
            container.innerHTML = '';
            showErr('poExpertiseError', res.message || 'Could not fetch categories. Please try again.');
            return;
        }
        const categories = (res.result && res.result.items) || [];

        container.innerHTML = categories.map(cat => `
    <div class="pro-expertise-group">
      <p class="pro-expertise-group-label">${escapeHtml(cat.name)}</p>
      <div class="pro-expertise-chips">
        ${(cat.subCategories || []).map(sub => `
          <label class="pro-expertise-chip">
            <input type="checkbox" value="${escapeAttr(sub.categoryId)}" data-po-expertise>
            <span>${escapeHtml(sub.name)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
    }

    function wireSubmit() {
        const submitBtn = document.getElementById('poSubmitBtn');
        submitBtn.addEventListener('click', async () => {
            ['poIdentityError', 'poAddressError', 'poExpertiseError', 'poServingLocalitiesError', 'poDeclarationError'].forEach(hideErr);

            const aadhaar = document.getElementById('poAadhaar').value.replace(/\s/g, '');
            const nameOnId = document.getElementById('poNameOnId').value.trim();
            const pan = document.getElementById('poPan').value.trim();
            const addressLine = document.getElementById('poAddressLine').value.trim();
            const experience = document.getElementById('poExperience').value;
            const servingCities = document.getElementById('poServingCities').value;
            const expertise = Array.from(document.querySelectorAll('[data-po-expertise]:checked')).map(cb => cb.value);
            const servingNeighbourhoodIds = proLoc.servingNeighbourhoodIds.slice();
            const declared = document.getElementById('poDeclaration').checked;

            let firstError = null;
            const fail = (id, msg) => {
                showErr(id, msg);
                firstError = firstError || id;
            };

            if (!/^\d{12}$/.test(aadhaar))
                fail('poIdentityError', 'Enter a valid 12-digit Aadhaar number.');
            else if (nameOnId.length < 2)
                fail('poIdentityError', 'Enter your full name as printed on your Aadhaar card.');
            else if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))
                fail('poIdentityError', 'PAN should look like ABCDE1234F, or leave it blank.');

            if (!addressLine)
                fail('poAddressError', 'Enter your current address line.');
            else if (!proLoc.provinceId)
                fail('poAddressError', 'Select your current state.');
            else if (!proLoc.cityId)
                fail('poAddressError', 'Select your current city.');
            else if (!proLoc.neighbourhoodId)
                fail('poAddressError', 'Select your current locality.');

            if (expertise.length === 0)
                fail('poExpertiseError', 'Select at least one area of expertise.');
            if (servingNeighbourhoodIds.length === 0)
                fail('poServingLocalitiesError', 'Select at least one locality you want to serve.');
            if (!declared)
                fail('poDeclarationError', 'Please confirm the declaration to continue.');

            if (firstError) {
                document.getElementById(firstError).scrollIntoView({behavior: 'smooth', block: 'center'});
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting your application…';

            // Same payload contract as become-professional.js.
            const payload = {
                bio: '',
                documents: [{
                        nameOnDocument: nameOnId,
                        documentType: 'AADHAAR',
                        documentNumber: aadhaar
                    }],
                address: {
                    addressLine1: addressLine,
                    neighbourhoodId: proLoc.neighbourhoodId
                },
                cityId: proLoc.cityId,
                experienceYears: experience ? Number(experience) : 0,
                servingCities: servingCities,
                expertise: expertise,
                neighbourhoodIds: servingNeighbourhoodIds
            };

            const result = await FolksAPI.applyAsProfessional(payload);

            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Application';

            if (!result.success) {
                showErr('poDeclarationError', result.message || 'Could not submit your application. Please try again.');
                return;
            }

            const application = result.result || {};
            document.getElementById('poFormContent').hidden = true;
            document.getElementById('poApplicationId').textContent = application.applicationId || '—';
            const success = document.getElementById('poApplicationSuccess');
            success.hidden = false;
            success.scrollIntoView({behavior: 'smooth', block: 'start'});
        });
    }

    /* ---- small helpers (scoped to this file) ------------------------------ */
    function showErr(id, msg) {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.textContent = msg;
        el.hidden = false;
    }
    function hideErr(id) {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.hidden = true;
        el.textContent = '';
    }
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str === undefined || str === null ? '' : str);
        return div.innerHTML;
    }
    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, '&quot;');
    }
})();
