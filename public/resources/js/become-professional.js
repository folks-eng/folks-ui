/* =========================================================================
 HEARTH — become-professional.js
 Drives the professional application page: identity fields, an
 expertise multi-select sourced from CATEGORY_DATA, and submission via
 HearthAPI.applyAsProfessional() (api.js). No network calls happen
 directly in this file.
 ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCurrentUser === 'undefined')
        return; // guard: only runs on this page
    initBecomeProfessionalPage();
});

/* ---- state -> city -> locality picker (Current Address) ------------------
 Single-select cascade, same confirmed backend field names as profile.js's
 address picker (provinceId/provinceName, cityId/cityName,
 neighbourhoodId/locality — never generic id/name). Once a city is picked,
 `proLoc.neighbourhoods` also feeds the "Localities you serve" multi-select
 below, so both use one fetch per city instead of two. */
let proLoc = {
    provinceId: '', province: '',
    cityId: '', city: '',
    neighbourhoodId: '', locality: '', pincode: '',
    provinces: [], cities: [], neighbourhoods: [],
    loadingCities: false, loadingNeighbourhoods: false,
    servingNeighbourhoodIds: []
};

// Sentinel id for the "All Localities" option in the "Localities you serve"
// checkbox list — sent to the backend as neighbourhoodIds: [ALL_LOCALITIES_ID]
// instead of every individual neighbourhoodId in the city.
const ALL_LOCALITIES_ID = '-1';

/* "Indiranagar - 560038" so localities that share a name across different
 pincodes within the same city are still distinguishable in the dropdown. */
function localityOptionLabel(n) {
    return n.pincode ? `${n.locality} - ${n.pincode}` : n.locality;
}

/* Locality dropdown is sorted by that same "locality - pincode" label, so
 same-named localities with different pincodes still sort together and then
 by pincode. See sortByLocalityName() below for the separate sort used by
 the "Localities you serve" checkbox list. */
function sortByLocalityOptionLabel(neighbourhoods) {
    return neighbourhoods.slice().sort((a, b) =>
        localityOptionLabel(a).localeCompare(localityOptionLabel(b), undefined, {numeric: true, sensitivity: 'base'})
    );
}

/* Same idea for the "Localities you serve" checkboxes, but keyed on the
 plain locality name — that list keeps its plain-name label (not the
 "locality - pincode" one used in the dropdown), so it sorts by what's
 actually shown. */
function sortByLocalityName(neighbourhoods) {
    return neighbourhoods.slice().sort((a, b) =>
        (a.locality || '').localeCompare(b.locality || '', undefined, {numeric: true, sensitivity: 'base'})
    );
}

async function initLocationPicker() {
    const stateSel = document.getElementById('proState');
    const citySel = document.getElementById('proCity');
    const localitySel = document.getElementById('proLocality');
    if (!stateSel || !citySel || !localitySel)
        return;

    const res = await HearthAPI.viewProvinces();
    if (res.success) {
        proLoc.provinces = res.result.items || res.result || [];
        stateSel.innerHTML = '<option value="">Select a state…</option>' +
                proLoc.provinces.map(p => `<option value="${p.provinceId}">${escapeHtmlPro(p.provinceName)}</option>`).join('');
    }
    else {
        showErrorPro('proAddressError', res.message || 'Could not load states. Please try again.');
    }

    stateSel.addEventListener('change', async () => {
        proLoc.provinceId = stateSel.value;
        proLoc.province = stateSel.selectedOptions[0] ? stateSel.selectedOptions[0].textContent : '';
        resetCityAndBelow();
        renderServingLocalities();

        if (!proLoc.provinceId) {
            citySel.innerHTML = '<option value="">Select a state first…</option>';
            citySel.disabled = true;
            return;
        }
        citySel.disabled = true;
        citySel.innerHTML = '<option value="">Loading cities…</option>';
        const citiesRes = await HearthAPI.viewCities('provinceId', Loc.provinceId);
        if (citiesRes.success) {
            proLoc.cities = citiesRes.result.items || citiesRes.result || [];
            citySel.innerHTML = '<option value="">Select a city…</option>' +
                    proLoc.cities.map(c => `<option value="${c.cityId}">${escapeHtmlPro(c.cityName)}</option>`).join('');
            citySel.disabled = false;
        }
        else {
            citySel.innerHTML = '<option value="">Could not load cities</option>';
            showErrorPro('proAddressError', citiesRes.message || 'Could not load cities for the selected state.');
        }
    });

    citySel.addEventListener('change', async () => {
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
        const neighbourhoodsRes = await HearthAPI.viewNeighbourhoods(proLoc.cityId);
        proLoc.loadingNeighbourhoods = false;
        if (neighbourhoodsRes.success) {
            // proLoc.neighbourhoods keeps the API's original order — it also
            // backs the "Localities you serve" checkboxes, which stay
            // unsorted on purpose. Only the dropdown's own option list is
            // built from a sorted copy.
            proLoc.neighbourhoods = neighbourhoodsRes.result.items || neighbourhoodsRes.result || [];
            localitySel.innerHTML = '<option value="">Select a locality…</option>' +
                    sortByLocalityOptionLabel(proLoc.neighbourhoods).map(n => `<option value="${n.neighbourhoodId}">${escapeHtmlPro(localityOptionLabel(n))}</option>`).join('');
            localitySel.disabled = false;
        }
        else {
            localitySel.innerHTML = '<option value="">Could not load localities</option>';
            showErrorPro('proAddressError', neighbourhoodsRes.message || 'Could not load localities for the selected city.');
        }
        renderServingLocalities();
    });

    localitySel.addEventListener('change', () => {
        const match = proLoc.neighbourhoods.find(n => String(n.neighbourhoodId) === String(localitySel.value));
        proLoc.neighbourhoodId = localitySel.value;
        proLoc.locality = match ? match.locality : '';
        proLoc.pincode = match ? (match.pincode || '') : '';
        document.getElementById('proPincode').value = proLoc.pincode;
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
    const pincodeInput = document.getElementById('proPincode');
    if (pincodeInput)
        pincodeInput.value = '';
}

/* ---- "localities you serve" multi-select, sourced from the same
 proLoc.neighbourhoods list fetched for the Locality dropdown above --------- */
function renderServingLocalities() {
    const container = document.getElementById('proServingLocalities');
    const hint = document.getElementById('proServingLocalitiesHint');
    if (!container)
        return;

    if (!proLoc.cityId) {
        container.innerHTML = '';
        if (hint) {
            hint.hidden = false;
            hint.textContent = 'Select your state and city above to see localities you can serve.';
        }
        return;
    }
    if (proLoc.loadingNeighbourhoods) {
        container.innerHTML = '';
        if (hint) {
            hint.hidden = false;
            hint.textContent = 'Loading localities…';
        }
        return;
    }
    if (proLoc.neighbourhoods.length === 0) {
        container.innerHTML = '';
        if (hint) {
            hint.hidden = false;
            hint.textContent = 'No localities found for this city yet.';
        }
        return;
    }
    if (hint)
        hint.hidden = true;

    // "All Localities" is mutually exclusive with picking individual ones:
    // checking it clears/disables the rest (the payload becomes just [-1]
    // instead of every neighbourhoodId in the city); unchecking it re-enables
    // them, starting from no selection.
    const allSelected = proLoc.servingNeighbourhoodIds.includes(ALL_LOCALITIES_ID);

    const allChip = `
      <label class="pro-expertise-chip pro-expertise-chip-all">
        <input type="checkbox" value="${ALL_LOCALITIES_ID}" data-serving-all-checkbox ${allSelected ? 'checked' : ''}>
        <span>★ All Localities</span>
      </label>
    `;
    const localityChips = sortByLocalityName(proLoc.neighbourhoods).map(n => `
      <label class="pro-expertise-chip">
        <input type="checkbox" value="${escapeAttrPro(n.neighbourhoodId)}" data-serving-checkbox ${allSelected ? 'disabled' : ''} ${!allSelected && proLoc.servingNeighbourhoodIds.includes(String(n.neighbourhoodId)) ? 'checked' : ''}>
        <span>${escapeHtmlPro(n.locality)}</span>
      </label>
    `).join('');
    container.innerHTML = allChip + localityChips;

    const allCb = container.querySelector('[data-serving-all-checkbox]');
    if (allCb) {
        allCb.addEventListener('change', () => {
            proLoc.servingNeighbourhoodIds = allCb.checked ? [ALL_LOCALITIES_ID] : [];
            renderServingLocalities();
        });
    }

    container.querySelectorAll('[data-serving-checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = cb.value;
            if (cb.checked) {
                if (!proLoc.servingNeighbourhoodIds.includes(id))
                    proLoc.servingNeighbourhoodIds.push(id);
            }
            else {
                proLoc.servingNeighbourhoodIds = proLoc.servingNeighbourhoodIds.filter(x => x !== id);
            }
        });
    });
}

function getSelectedServingNeighbourhoods() {
    return proLoc.servingNeighbourhoodIds.slice();
}

/* Best-effort pre-fill of the cascade from a saved address, used by the
 "Use my saved address" shortcut. Falls back gracefully (leaving the
 selects untouched) when the saved address predates the location picker
 and has no provinceId/cityId/neighbourhoodId on file. */
async function primeLocationFromSavedAddress(savedAddress) {
    const stateSel = document.getElementById('proState');
    const citySel = document.getElementById('proCity');
    const localitySel = document.getElementById('proLocality');
    if (!savedAddress.provinceId || !stateSel)
        return;

    stateSel.value = String(savedAddress.provinceId);
    if (stateSel.value !== String(savedAddress.provinceId))
        return; // state list hasn't loaded this option — leave the picker as-is
    // Set state directly rather than dispatching a 'change' event: the real
    // change handler above does its own async city fetch, which would race
    // with the city/locality prefill this function does next.
    proLoc.provinceId = savedAddress.provinceId;
    proLoc.province = savedAddress.province || proLoc.province;

    if (!savedAddress.cityId)
        return;
    citySel.disabled = true;
    citySel.innerHTML = '<option value="">Loading cities…</option>';
    const citiesRes = await HearthAPI.viewCities('provinceId', savedAddress.provinceId);
    if (!citiesRes.success)
        return;
    proLoc.cities = citiesRes.result.items || citiesRes.result || [];
    citySel.innerHTML = '<option value="">Select a city…</option>' +
            proLoc.cities.map(c => `<option value="${c.cityId}">${escapeHtmlPro(c.cityName)}</option>`).join('');
    citySel.disabled = false;
    citySel.value = String(savedAddress.cityId);
    proLoc.cityId = savedAddress.cityId;
    proLoc.city = savedAddress.city || proLoc.city;

    if (!savedAddress.neighbourhoodId)
        return;
    localitySel.disabled = true;
    localitySel.innerHTML = '<option value="">Loading localities…</option>';
    const neighbourhoodsRes = await HearthAPI.viewNeighbourhoods(savedAddress.cityId);
    if (!neighbourhoodsRes.success)
        return;
    proLoc.neighbourhoods = neighbourhoodsRes.result.items || neighbourhoodsRes.result || [];
    localitySel.innerHTML = '<option value="">Select a locality…</option>' +
            sortByLocalityOptionLabel(proLoc.neighbourhoods).map(n => `<option value="${n.neighbourhoodId}">${escapeHtmlPro(localityOptionLabel(n))}</option>`).join('');
    localitySel.disabled = false;
    localitySel.value = String(savedAddress.neighbourhoodId);
    proLoc.neighbourhoodId = savedAddress.neighbourhoodId;
    const match = proLoc.neighbourhoods.find(n => String(n.neighbourhoodId) === String(savedAddress.neighbourhoodId));
    proLoc.locality = match ? match.locality : (savedAddress.locality || '');
    proLoc.pincode = match ? (match.pincode || '') : (savedAddress.pincode || '');
    document.getElementById('proPincode').value = proLoc.pincode;
    renderServingLocalities();
}

function initBecomeProfessionalPage() {
    const gate = document.getElementById('proGate');
    const alreadyApplied = document.getElementById('proAlreadyApplied');
    const formContent = document.getElementById('proFormContent');
    const success = document.getElementById('proSuccess');
    if (!gate || !formContent)
        return;

    const showEl = (el) => {
        if (el)
            el.hidden = false;
    };
    const hideEl = (el) => {
        if (el)
            el.hidden = true;
    };

    if (!isLoggedIn() || !getCurrentUser()) {
        showEl(gate);
        hideEl(alreadyApplied);
        hideEl(formContent);
        hideEl(success);
        document.getElementById('proGateSignupBtn')?.addEventListener('click', () => {
            document.getElementById('signupBtn')?.click();
        });
        return;
    }

    const user = getCurrentUser();

    // Already applied (role already flipped to Professional by a prior
    // submission) — don't let them submit a second application.
    if (user.role === 'Professional' && user.professionalStatus) {
        hideEl(gate);
        hideEl(formContent);
        hideEl(success);
        showEl(alreadyApplied);
        document.getElementById('proAlreadyAppliedMessage').textContent =
                `Your application is currently: ${user.professionalStatus}.`;
        return;
    }

    hideEl(gate);
    hideEl(alreadyApplied);
    hideEl(success);
    showEl(formContent);

    prefillFromExistingData(user);
    renderExpertiseGroups();
    initLocationPicker();
    wireSubmit(user);
}

/* ---- prefill convenience -------------------------------------------------
 Deliberately NOT auto-filling the current-address fields from the saved
 profile address: someone applying may be working out of a different
 city than the one on file (e.g. moved for work), so defaulting to the
 old address risks it being submitted unnoticed. Instead, a "Use my
 saved address" button appears as an opt-in shortcut when one exists. */
function prefillFromExistingData(user) {
    const nameInput = document.getElementById('proNameOnId');
    if (nameInput && !nameInput.value && user.name)
        nameInput.value = user.name;

    // Auto-format the Aadhaar number into groups of 4 as the person types.
    const aadhaarInput = document.getElementById('proAadhaar');
    aadhaarInput.addEventListener('input', () => {
        const digits = aadhaarInput.value.replace(/\D/g, '').slice(0, 12);
        aadhaarInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    });

    const panInput = document.getElementById('proPan');
    panInput.addEventListener('input', () => {
        panInput.value = panInput.value.toUpperCase().slice(0, 10);
    });

    const pincodeInput = document.getElementById('proPincode');
    pincodeInput.addEventListener('input', () => {
        pincodeInput.value = pincodeInput.value.replace(/\D/g, '').slice(0, 6);
    });

    Promise.resolve(typeof getStoredAddress === 'function' ? getStoredAddress() : null).then((savedAddress) => {
        const useSavedBtn = document.getElementById('proUseSavedAddressBtn');
        if (!savedAddress || !savedAddress.addressLine1 || !useSavedBtn)
            return;
        useSavedBtn.hidden = false;
        useSavedBtn.addEventListener('click', () => {
            document.getElementById('proAddressLine').value = savedAddress.addressLine1 || '';
            primeLocationFromSavedAddress(savedAddress);
        });
    });
}

/* ---- expertise multi-select, grouped by category, from CATEGORY_DATA --- */
async function renderExpertiseGroups() {
    const container = document.getElementById('proExpertiseGroups');
    if (!container) // || typeof CATEGORY_DATA === 'undefined')
        return;

    let res = await HearthAPI.viewCategories();

    if (!res.success) {
        alert('Failed');
        showError('categoryError', res.message || 'Could fetch categories. Please try again.');
        return;
    }
    categories_hierarchy = res.result.items;

    container.innerHTML = categories_hierarchy.map(cat => `
    <div class="pro-expertise-group">
      <p class="pro-expertise-group-label">${escapeHtmlPro(cat.name)}</p>
      <div class="pro-expertise-chips">
        ${cat.subCategories.map(sub => `
          <label class="pro-expertise-chip">
            <input type="checkbox" value="${escapeAttrPro(sub.categoryId)}" data-expertise-checkbox>
            <span>${escapeHtmlPro(sub.name)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function getSelectedExpertise() {
    return Array.from(document.querySelectorAll('[data-expertise-checkbox]:checked')).map(cb => cb.value);
}

/* ---- validation + submit ------------------------------------------------- */
function wireSubmit(user) {
    const submitBtn = document.getElementById('proSubmitBtn');
    submitBtn.addEventListener('click', async () => {
        hideErrorPro('proIdentityError');
        hideErrorPro('proAddressError');
        hideErrorPro('proExpertiseError');
        hideErrorPro('proServingLocalitiesError');
        hideErrorPro('proDeclarationError');

        const aadhaar = document.getElementById('proAadhaar').value.replace(/\s/g, '');
        const nameOnId = document.getElementById('proNameOnId').value.trim();
        const pan = document.getElementById('proPan').value.trim();
        const addressLine = document.getElementById('proAddressLine').value.trim();
        const experience = document.getElementById('proExperience').value;
        const servingCities = document.getElementById('proServingCities').value;
        const expertise = getSelectedExpertise();
        const servingNeighbourhoodIds = getSelectedServingNeighbourhoods();
        const declared = document.getElementById('proDeclaration').checked;

        let hasError = false;

        if (!/^\d{12}$/.test(aadhaar)) {
            showErrorPro('proIdentityError', 'Enter a valid 12-digit Aadhaar number.');
            hasError = true;
        } else if (nameOnId.length < 2) {
            showErrorPro('proIdentityError', 'Enter your full name as printed on your Aadhaar card.');
            hasError = true;
        } else if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
            showErrorPro('proIdentityError', 'PAN should look like ABCDE1234F, or leave it blank.');
            hasError = true;
        }

        if (!addressLine) {
            showErrorPro('proAddressError', 'Enter your current address line.');
            hasError = true;
        } else if (!proLoc.provinceId) {
            showErrorPro('proAddressError', 'Select your current state.');
            hasError = true;
        } else if (!proLoc.cityId) {
            showErrorPro('proAddressError', 'Select your current city.');
            hasError = true;
        } else if (!proLoc.neighbourhoodId) {
            showErrorPro('proAddressError', 'Select your current locality.');
            hasError = true;
        }

        if (expertise.length === 0) {
            showErrorPro('proExpertiseError', 'Select at least one area of expertise.');
            hasError = true;
        }

        if (servingNeighbourhoodIds.length === 0) {
            showErrorPro('proServingLocalitiesError', 'Select at least one locality you want to serve.');
            hasError = true;
        }

        if (!declared) {
            showErrorPro('proDeclarationError', 'Please confirm the declaration to continue.');
            hasError = true;
        }
        if (hasError) {
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting your application…';

        const payload = {
            bio: '',
            documents: [ {
                nameOnDocument: nameOnId,
                documentType: 'AADHAAR',
                documentNumber: aadhaar
            } ],
            // panNumber: pan || null,
            address: {
                addressLine1: addressLine,
                neighbourhoodId: proLoc.neighbourhoodId
                // province: proLoc.province,
                // city: proLoc.city,
                // locality: proLoc.locality,
                // pincode: proLoc.pincode
            },
            cityId: proLoc.cityId,
            experienceYears: experience ? Number(experience) : 0,
            servingCities: servingCities,
            expertise: expertise,
            // Localities (neighbourhoodIds) the professional is willing to take
            // bookings in, picked from the multi-select under "Professional
            // Details" — sent as an array of the same neighbourhoodId used
            // elsewhere in the app (see location-serviceability-picker.md).
            neighbourhoodIds: servingNeighbourhoodIds
        };
        // alert(JSON.stringify(payload));
        // const result = {success:false};
        const result = await HearthAPI.applyAsProfessional(payload);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';

        if (!result.success) {
            showErrorPro('proDeclarationError', result.message || 'Could not submit your application. Please try again.');
            return;
        }

        // Reflect the application everywhere the profile shows up, without
        // persisting the full Aadhaar number client-side — only the last 4
        // digits, the way a real product would mask it back to the user.
        // const updatedUser = {
        //     ...user,
        //     role: 'Professional',
        //     professionalStatus: result.application.status,
        //     aadhaarLast4: aadhaar.slice(-4),
        //     expertiseAreas: expertise,
        //     // Kept separate from the account's main saved address (hearth_address)
        //     // on purpose — this is where they currently work from, which may
        //     // differ from their permanent/home address.
        //     professionalCurrentAddress: {addressLine, locality, city, pincode},
        // };
        // saveCurrentUser(updatedUser);
        let user = result.result;
        renderUserChip(user);

        document.getElementById('proFormContent').hidden = true;
        document.getElementById('proApplicationId').textContent = user.applicationId;
        document.getElementById('proSuccess').hidden = false;
        document.getElementById('proSuccess').scrollIntoView({behavior: 'smooth', block: 'start'});
    });
}

function showErrorPro(id, msg) {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.textContent = msg;
    el.hidden = false;
}
function hideErrorPro(id) {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.hidden = true;
    el.textContent = '';
}
function escapeHtmlPro(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
function escapeAttrPro(str) {
    return escapeHtmlPro(str).replace(/"/g, '&quot;');
}
