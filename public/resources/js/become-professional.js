/* =========================================================================
 FOLKS — become-professional.js
 Drives the professional application page: identity fields, an
 expertise multi-select sourced from CATEGORY_DATA, and submission via
 FolksAPI.applyAsProfessional() (api.js). No network calls happen
 directly in this file.
 ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCurrentUser === 'undefined')
        return; // guard: only runs on this page
    initBecomeProfessionalPage();
});

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

    const savedAddress = typeof getStoredAddress === 'function' ? getStoredAddress() : null;
    const useSavedBtn = document.getElementById('proUseSavedAddressBtn');
    if (savedAddress && savedAddress.line1 && useSavedBtn) {
        useSavedBtn.hidden = false;
        useSavedBtn.addEventListener('click', () => {
            document.getElementById('proAddressLine').value = savedAddress.line1 || '';
            document.getElementById('proLocality').value = savedAddress.line2 || '';
            document.getElementById('proCity').value = savedAddress.city || '';
            document.getElementById('proPincode').value = savedAddress.postalCode || '';
        });
    }
}

/* ---- expertise multi-select, grouped by category, from CATEGORY_DATA --- */
async function renderExpertiseGroups() {
    const container = document.getElementById('proExpertiseGroups');
    if (!container) // || typeof CATEGORY_DATA === 'undefined')
        return;

    let res = await FolksAPI.viewCategories();

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
            <input type="checkbox" value="${escapeAttrPro(sub.name)}" data-expertise-checkbox>
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
        hideErrorPro('proDeclarationError');

        const aadhaar = document.getElementById('proAadhaar').value.replace(/\s/g, '');
        const nameOnId = document.getElementById('proNameOnId').value.trim();
        const pan = document.getElementById('proPan').value.trim();
        const experience = document.getElementById('proExperience').value;
        const addressLine = document.getElementById('proAddressLine').value.trim();
        const locality = document.getElementById('proLocality').value.trim();
        const city = document.getElementById('proCity').value.trim();
        const pincode = document.getElementById('proPincode').value.trim();
        const expertise = getSelectedExpertise();
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
        } else if (!locality) {
            showErrorPro('proAddressError', 'Enter your current locality or area.');
            hasError = true;
        } else if (!city) {
            showErrorPro('proAddressError', 'Enter your current city.');
            hasError = true;
        } else if (!/^\d{6}$/.test(pincode)) {
            showErrorPro('proAddressError', 'Enter a valid 6-digit pincode.');
            hasError = true;
        }

        if (expertise.length === 0) {
            showErrorPro('proExpertiseError', 'Select at least one area of expertise.');
            hasError = true;
        }

        if (!declared) {
            showErrorPro('proDeclarationError', 'Please confirm the declaration to continue.');
            hasError = true;
        }

        if (hasError)
            return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting your application…';

        const payload = {
            userId: user.id,
            aadhaarNumber: aadhaar,
            nameOnId,
            panNumber: pan || null,
            yearsOfExperience: experience ? Number(experience) : 0,
            expertiseAreas: expertise,
            currentAddress: {addressLine, locality, city, pincode},
        };

        const result = await FolksAPI.applyAsProfessional(payload);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';

        if (!result.success) {
            showErrorPro('proDeclarationError', result.message || 'Could not submit your application. Please try again.');
            return;
        }

        // Reflect the application everywhere the profile shows up, without
        // persisting the full Aadhaar number client-side — only the last 4
        // digits, the way a real product would mask it back to the user.
        const updatedUser = {
            ...user,
            role: 'Professional',
            professionalStatus: result.application.status,
            aadhaarLast4: aadhaar.slice(-4),
            expertiseAreas: expertise,
            // Kept separate from the account's main saved address (folks_address)
            // on purpose — this is where they currently work from, which may
            // differ from their permanent/home address.
            professionalCurrentAddress: {addressLine, locality, city, pincode},
        };
        saveCurrentUser(updatedUser);
        renderUserChip(updatedUser);

        document.getElementById('proFormContent').hidden = true;
        document.getElementById('proApplicationId').textContent = result.application.id;
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
