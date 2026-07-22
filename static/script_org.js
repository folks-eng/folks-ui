/* =========================================================================
   FOLKS — script.js
   Vanilla JS only. Progressive enhancement — page works without it.
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initStickyHeader();
  initMobileNav();
  initAccordion();
  initRipple();
  initScrollReveal();
  initCounters();
  initBackToTop();
  initSearchForm();
  initAuthState();
  initSignupFlow();
});

/* -------------------------------------------------------------------------
   Sticky header shadow on scroll
   ------------------------------------------------------------------------- */
function initStickyHeader() {
  const header = document.getElementById('siteHeader');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* -------------------------------------------------------------------------
   Mobile navigation toggle
   ------------------------------------------------------------------------- */
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  const actions = document.querySelector('.nav-actions');
  if (!toggle || !links) return;

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    links.classList.remove('is-open');
    if (actions) actions.classList.remove('is-open');
  };

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    links.classList.toggle('is-open', !isOpen);
    if (actions) actions.classList.toggle('is-open', !isOpen);
  });

  // Close menu when a link is clicked (mobile)
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Close when resizing up to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) closeMenu();
  });
}

/* -------------------------------------------------------------------------
   FAQ accordion — single-open, accessible
   ------------------------------------------------------------------------- */
function initAccordion() {
  const accordion = document.getElementById('accordion');
  if (!accordion) return;
  const triggers = accordion.querySelectorAll('.accordion-trigger');

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));

      // Close all others
      triggers.forEach(t => {
        if (t !== trigger) {
          t.setAttribute('aria-expanded', 'false');
          const p = document.getElementById(t.getAttribute('aria-controls'));
          if (p) p.hidden = true;
        }
      });

      // Toggle current
      trigger.setAttribute('aria-expanded', String(!expanded));
      if (panel) panel.hidden = expanded;
    });
  });
}

/* -------------------------------------------------------------------------
   Button ripple effect (CSS-driven, JS sets origin point)
   ------------------------------------------------------------------------- */
function initRipple() {
  document.querySelectorAll('.btn-ripple').forEach(btn => {
    if (btn.dataset.rippleBound) return; // avoid double-binding on re-init
    btn.dataset.rippleBound = 'true';
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--rx', `${x}%`);
      btn.style.setProperty('--ry', `${y}%`);
      btn.classList.remove('is-rippling');
      // Force reflow so the animation can restart
      void btn.offsetWidth;
      btn.classList.add('is-rippling');
      setTimeout(() => btn.classList.remove('is-rippling'), 600);
    });
  });
}

/* -------------------------------------------------------------------------
   Scroll-reveal using IntersectionObserver, with a light stagger
   ------------------------------------------------------------------------- */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }

  // Stagger items that share a parent grid/container
  const groups = new Map();
  items.forEach(el => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach(group => {
    group.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 80, 400)}ms`;
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => observer.observe(el));
}

/* -------------------------------------------------------------------------
   Animated statistic counters
   ------------------------------------------------------------------------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-count'), 10) || 0;
    const duration = 1400;
    const start = performance.now();
    const easeOutQuad = t => t * (2 - t);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOutQuad(progress);
      const value = Math.floor(eased * target);
      el.textContent = value.toLocaleString('en-IN');
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toLocaleString('en-IN');
      }
    }
    requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window)) {
    counters.forEach(animateCounter);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

/* -------------------------------------------------------------------------
   Back-to-top button
   ------------------------------------------------------------------------- */
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('is-visible', window.scrollY > 600);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* -------------------------------------------------------------------------
   Search form — lightweight client-side validation stub
   ------------------------------------------------------------------------- */
function initSearchForm() {
  const form = document.querySelector('.search-card');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const service = document.getElementById('serviceInput');
    const location = document.getElementById('locationInput');

    if (!service.value.trim()) {
      service.focus();
      return;
    }
    if (!location.value.trim()) {
      location.focus();
      return;
    }

    // In production this would route to a results page.
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
}


/* =========================================================================
   SIGNUP / REGISTRATION FLOW
   A mobile-screen-sized popup that behaves like real app navigation: each
   step is its own "page" that slides in/out, with a dedicated waiting page
   shown while a network call is in flight. All network calls themselves
   live in api.js (see the FolksAPI namespace) — this file only handles
   screen navigation and UI state.

   Screen sequence:
     mobile -> waiting -> otp -> waiting -> profile -> waiting -> success
   with backward navigation on error (waiting -> mobile / otp / profile).
   ========================================================================= */

function initSignupFlow() {
  injectSignupModalMarkup();
  initRipple(); // re-run so the newly-injected modal buttons get the ripple effect

  const overlay = document.getElementById('signupOverlay');
  const modal = document.getElementById('signupModal');
  const closeBtn = document.getElementById('signupCloseBtn');
  const screens = {
    mobile: modal.querySelector('[data-screen="mobile"]'),
    waiting: modal.querySelector('[data-screen="waiting"]'),
    otp: modal.querySelector('[data-screen="otp"]'),
    profile: modal.querySelector('[data-screen="profile"]'),
    success: modal.querySelector('[data-screen="success"]'),
  };
  const waitingLabel = document.getElementById('waitingLabel');

  const state = {
    mobile: '',
    activeScreen: screens.mobile,
    resendTimer: null,
    resendSecondsLeft: 30,
  };

  // ---- screen navigation (slide transitions) ---------------------------
  /**
   * Navigate from the current screen to `targetScreen`.
   * direction 'forward' slides the new screen in from the right (and the
   * old one out to the left) — like moving deeper into a flow.
   * direction 'back' does the reverse — like returning to a previous step.
   */
  function goTo(targetScreen, direction) {
    const outgoing = state.activeScreen;
    if (outgoing === targetScreen) return;

    targetScreen.classList.remove('screen-off-left', 'screen-off-right');
    targetScreen.classList.add(direction === 'forward' ? 'screen-off-right' : 'screen-off-left');
    targetScreen.inert = false;
    targetScreen.removeAttribute('aria-hidden');

    // Force reflow so the starting position is committed before animating.
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

  function setStepDots(stepNumber) {
    const indicator = modal.querySelector('.modal-steps-indicator');
    if (indicator) indicator.hidden = stepNumber === 0;
    modal.querySelectorAll('.step-dot').forEach(dot => {
      const dotStep = Number(dot.dataset.step);
      dot.classList.toggle('is-complete', dotStep < stepNumber);
      dot.classList.toggle('is-active', dotStep <= stepNumber);
    });
  }

  // ---- open / close ------------------------------------------------------
  function resetModal() {
    Object.values(screens).forEach(screen => {
      screen.classList.remove('screen-current', 'screen-off-left', 'screen-off-right');
      screen.classList.add('screen-off-right');
      screen.inert = true;
      screen.setAttribute('aria-hidden', 'true');
    });
    screens.mobile.classList.remove('screen-off-right');
    screens.mobile.classList.add('screen-current');
    screens.mobile.inert = false;
    screens.mobile.removeAttribute('aria-hidden');
    state.activeScreen = screens.mobile;
    setStepDots(1);

    document.getElementById('signupMobile').value = '';
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    modal.querySelectorAll('.otp-box').forEach(b => { b.value = ''; b.classList.remove('is-filled'); });
    hideError('mobileError');
    hideError('otpError');
    hideError('profileError');
    clearInterval(state.resendTimer);
  }

  function openModal() {
    resetModal();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('signupMobile')?.focus(), 300);
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearInterval(state.resendTimer);
  }

  // Event delegation, not a direct element binding: the header's #signupBtn
  // can be destroyed and recreated later (e.g. after logout rebuilds
  // nav-actions), so we listen on document and check the click target at
  // click-time rather than binding to one specific node up front.
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#signupBtn');
    if (trigger) {
      e.preventDefault();
      openModal();
    }
  });

  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  function showError(fieldId, message) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function hideError(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  // ---- SCREEN 1: mobile number -> waiting -> otp -------------------------
  const mobileInput = document.getElementById('signupMobile');
  const sendOtpBtn = document.getElementById('sendOtpBtn');

  mobileInput.addEventListener('input', () => {
    mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
  });

  sendOtpBtn.addEventListener('click', async () => {
    hideError('mobileError');
    const mobile = mobileInput.value.trim();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      showError('mobileError', 'Enter a valid 10-digit mobile number.');
      mobileInput.focus();
      return;
    }

    state.mobile = mobile;
    goToWaiting('Sending your OTP…', 'forward');

    const result = await FolksAPI.requestOtp(mobile);

    if (!result.success) {
      goTo(screens.mobile, 'back');
      showError('mobileError', result.message || 'Could not send OTP. Please try again.');
      return;
    }

    document.getElementById('otpMobileDisplay').textContent = `+91 ${mobile}`;
    const hint = document.getElementById('otpDemoHint');
    if (hint) {
      if (result.demoOtp) {
        hint.hidden = false;
        hint.textContent = `Demo mode — no SMS gateway connected. Your OTP is ${result.demoOtp}.`;
      } else {
        hint.hidden = true;
      }
    }

    setStepDots(2);
    goTo(screens.otp, 'forward');
    startResendCountdown();
    setTimeout(() => modal.querySelector('.otp-box[data-otp-index="0"]')?.focus(), 300);
  });

  // ---- SCREEN 2: OTP entry -> waiting -> profile -------------------------
  const otpBoxes = Array.from(modal.querySelectorAll('.otp-box'));
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const changeMobileBtn = document.getElementById('changeMobileBtn');
  const resendOtpBtn = document.getElementById('resendOtpBtn');
  const resendTimerLabel = document.getElementById('resendTimer');

  otpBoxes.forEach((box, index) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      box.classList.toggle('is-filled', box.value !== '');
      if (box.value && index < otpBoxes.length - 1) {
        otpBoxes[index + 1].focus();
      }
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        otpBoxes[index - 1].focus();
      }
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

  changeMobileBtn.addEventListener('click', () => {
    clearInterval(state.resendTimer);
    setStepDots(1);
    goTo(screens.mobile, 'back');
    setTimeout(() => mobileInput.focus(), 300);
  });

  function startResendCountdown() {
    state.resendSecondsLeft = 30;
    resendOtpBtn.disabled = true;
    resendTimerLabel.textContent = state.resendSecondsLeft;
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
    const result = await FolksAPI.requestOtp(state.mobile);
    const hint = document.getElementById('otpDemoHint');
    if (hint && result.demoOtp) {
      hint.hidden = false;
      hint.textContent = `Demo mode — no SMS gateway connected. Your new OTP is ${result.demoOtp}.`;
    }
    resendOtpBtn.textContent = 'Resend in ';
    resendOtpBtn.appendChild(resendTimerLabel);
    startResendCountdown();
  });

  verifyOtpBtn.addEventListener('click', async () => {
    hideError('otpError');
    const otp = otpBoxes.map(b => b.value).join('');

    if (otp.length !== 6) {
      showError('otpError', 'Enter the full 6-digit OTP.');
      return;
    }

    clearInterval(state.resendTimer);
    goToWaiting('Verifying your code…', 'forward');

    const result = await FolksAPI.verifyOtp(state.mobile, otp);

    if (!result.success) {
      goTo(screens.otp, 'back');
      showError('otpError', result.message || 'Incorrect OTP. Please try again.');
      otpBoxes.forEach(b => { b.value = ''; b.classList.remove('is-filled'); });
      otpBoxes[0].focus();
      startResendCountdown();
      return;
    }

    setStepDots(3);
    goTo(screens.profile, 'forward');
    setTimeout(() => document.getElementById('signupName')?.focus(), 300);
  });

  // ---- SCREEN 3: profile -> waiting -> success ---------------------------
  const nameInput = document.getElementById('signupName');
  const emailInput = document.getElementById('signupEmail');
  const completeRegBtn = document.getElementById('completeRegBtn');

  completeRegBtn.addEventListener('click', async () => {
    hideError('profileError');
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (name.length < 2) {
      showError('profileError', 'Please enter your full name.');
      nameInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('profileError', 'Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    goToWaiting('Setting up your profile…', 'forward');

    const result = await FolksAPI.createUser({ mobile: state.mobile, name, email });

    if (!result.success) {
      goTo(screens.profile, 'back');
      showError('profileError', result.message || 'Could not complete registration. Please try again.');
      return;
    }

    document.getElementById('successMessage').textContent =
      `You're all set to browse services, ${result.user.name.split(' ')[0]}.`;
    setStepDots(0);
    goTo(screens.success, 'forward');
    completeLogin(result.user);
    setTimeout(closeModal, 1800);
  });
}

/* =========================================================================
   SESSION / AUTH STATE
   A lightweight, localStorage-backed stand-in for a real session. There's
   no login endpoint in this build (only signup), so "logging out" clears
   the active session flag but keeps the underlying user/address records —
   signing up again simulates creating a (new) account, same as it would
   against a real backend without a login flow wired up yet.
   ========================================================================= */

const FOLKS_STORAGE_KEYS = {
  user: 'folks_user',
  address: 'folks_address',
  session: 'folks_logged_in',
  cart: 'folks_cart',
  postSignupRedirect: 'folks_post_signup_redirect',
};

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null; // storage unavailable (private mode, sandboxed preview, etc.)
  }
}
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn('[Folks] Could not persist to localStorage (safe to ignore):', err);
  }
}
function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) { /* no-op */ }
}

function isLoggedIn() {
  return safeStorageGet(FOLKS_STORAGE_KEYS.session) === 'true';
}
function getCurrentUser() {
  const raw = safeStorageGet(FOLKS_STORAGE_KEYS.user);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}
function saveCurrentUser(user) {
  safeStorageSet(FOLKS_STORAGE_KEYS.user, JSON.stringify(user));
}
function setLoggedIn(flag) {
  if (flag) safeStorageSet(FOLKS_STORAGE_KEYS.session, 'true');
  else safeStorageRemove(FOLKS_STORAGE_KEYS.session);
}
function getStoredAddress() {
  const raw = safeStorageGet(FOLKS_STORAGE_KEYS.address);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}
function saveStoredAddress(address) {
  safeStorageSet(FOLKS_STORAGE_KEYS.address, JSON.stringify(address));
}

/* ---- cart persistence (shared between categories.html and checkout.html) --
   Stored as a flat array of line items, each self-contained (denormalized)
   so checkout.html doesn't need to re-cross-reference CATEGORY_DATA:
   { skuId, name, price, currency, categoryName, subCategoryName, duration,
     qty, date, timeSlotId, timeSlotLabel }
   ------------------------------------------------------------------------ */
function getCart() {
  const raw = safeStorageGet(FOLKS_STORAGE_KEYS.cart);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}
function saveCart(cartItems) {
  safeStorageSet(FOLKS_STORAGE_KEYS.cart, JSON.stringify(cartItems));
}
function clearCart() {
  safeStorageRemove(FOLKS_STORAGE_KEYS.cart);
}
function getCartTotal(cartItems) {
  return cartItems.reduce((sum, item) => sum + item.qty * item.price, 0);
}
function getCartCount(cartItems) {
  return cartItems.reduce((sum, item) => sum + item.qty, 0);
}

/** Called once at signup success: persists the session and swaps the header. */
function completeLogin(user) {
  saveCurrentUser(user);
  setLoggedIn(true);
  renderUserChip(user);

  // If the sign-up flow was triggered mid-checkout ("Continue" on the cart
  // bar), resume that journey now instead of leaving the user on whatever
  // page they signed up from.
  const redirectTo = safeStorageGet(FOLKS_STORAGE_KEYS.postSignupRedirect);
  if (redirectTo) {
    safeStorageRemove(FOLKS_STORAGE_KEYS.postSignupRedirect);
    setTimeout(() => { window.location.href = redirectTo; }, 1900);
  }
}

/** Called on every page load to restore the header if a session exists. */
function initAuthState() {
  if (!isLoggedIn()) return;
  const user = getCurrentUser();
  if (!user) return;
  renderUserChip(user);
}

/* ---- header state: swap Log In / Sign Up for a chip + dropdown menu ---- */
function renderUserChip(user) {
  document.querySelectorAll('#navActions').forEach(navActions => {
    const fullName = (user.name || 'Friend').trim();
    const firstInitial = fullName.charAt(0).toUpperCase() || 'F';
    const firstName = fullName.split(' ')[0];

    navActions.innerHTML = `
      <div class="user-menu">
        <button type="button" class="user-chip" id="userChipBtn" aria-haspopup="true" aria-expanded="false">
          <span class="user-chip-avatar" aria-hidden="true">${firstInitial}</span>
          <span class="user-chip-name">${escapeHtmlGlobal(firstName)}</span>
          <svg class="user-chip-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="user-dropdown" id="userDropdown" role="menu" aria-label="Account menu" hidden>
          <a href="profile.html" role="menuitem" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            View Profile
          </a>
          <button type="button" role="menuitem" class="user-dropdown-item user-dropdown-item-danger" id="logoutBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Log out
          </button>
        </div>
      </div>
    `;

    const chipBtn = navActions.querySelector('#userChipBtn');
    const dropdown = navActions.querySelector('#userDropdown');
    const logoutBtn = navActions.querySelector('#logoutBtn');

    const closeDropdown = () => {
      dropdown.hidden = true;
      chipBtn.setAttribute('aria-expanded', 'false');
    };
    const openDropdown = () => {
      dropdown.hidden = false;
      chipBtn.setAttribute('aria-expanded', 'true');
    };

    chipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.hidden) openDropdown(); else closeDropdown();
    });
    document.addEventListener('click', (e) => {
      if (!navActions.contains(e.target)) closeDropdown();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown();
    });

    logoutBtn.addEventListener('click', () => {
      setLoggedIn(false);
      closeDropdown();
      restoreLoggedOutHeader(navActions);
    });
  });
}

/** Rebuilds the default Log In / Sign Up buttons after logout. */
function restoreLoggedOutHeader(navActions) {
  navActions.innerHTML = `
    <a href="#login" class="btn btn-ghost" id="loginBtn">Log In</a>
    <a href="#signup" class="btn btn-primary btn-ripple" id="signupBtn">Sign Up</a>
  `;
  initRipple();
}

function escapeHtmlGlobal(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---- inject modal markup once per page --------------------------------- */
function injectSignupModalMarkup() {
  if (document.getElementById('signupOverlay')) return;

  const markup = `
<div class="modal-overlay" id="signupOverlay" aria-hidden="true">
  <div class="modal-phone" id="signupModal" role="dialog" aria-modal="true" aria-labelledby="signupModalTitle">
    <button type="button" class="modal-close" id="signupCloseBtn" aria-label="Close sign up">&times;</button>

    <div class="modal-steps-indicator">
      <span class="step-dot is-active" data-step="1"></span>
      <span class="step-dot" data-step="2"></span>
      <span class="step-dot" data-step="3"></span>
    </div>

    <div class="modal-screens">

      <div class="modal-screen screen-current" data-screen="mobile">
        <h2 id="signupModalTitle" class="modal-title">Let's get you started</h2>
        <p class="modal-sub">Enter your mobile number and we'll send a one-time password to verify it's you.</p>
        <div class="otp-mobile-field">
          <span class="otp-country-code">+91</span>
          <input type="tel" inputmode="numeric" maxlength="10" id="signupMobile" placeholder="98765 43210" autocomplete="tel">
        </div>
        <p class="modal-error" id="mobileError" hidden></p>
        <button type="button" class="btn btn-primary btn-ripple modal-submit" id="sendOtpBtn">Send OTP</button>
      </div>

      <div class="modal-screen screen-off-right" data-screen="waiting" inert aria-hidden="true">
        <div class="modal-waiting">
          <span class="modal-spinner" aria-hidden="true"></span>
          <p class="modal-waiting-label" id="waitingLabel">Just a moment…</p>
        </div>
      </div>

      <div class="modal-screen screen-off-right" data-screen="otp" inert aria-hidden="true">
        <h2 class="modal-title">Verify your number</h2>
        <p class="modal-sub">Enter the 6-digit code sent to <strong id="otpMobileDisplay"></strong> ·
          <button type="button" class="link-btn" id="changeMobileBtn">Change</button>
        </p>
        <p class="modal-hint" id="otpDemoHint" hidden></p>
        <div class="otp-boxes" id="otpBoxes">
          <input type="text" inputmode="numeric" maxlength="1" class="otp-box" data-otp-index="0">
          <input type="text" inputmode="numeric" maxlength="1" class="otp-box" data-otp-index="1">
          <input type="text" inputmode="numeric" maxlength="1" class="otp-box" data-otp-index="2">
          <input type="text" inputmode="numeric" maxlength="1" class="otp-box" data-otp-index="3">
          <input type="text" inputmode="numeric" maxlength="1" class="otp-box" data-otp-index="4">
          <input type="text" inputmode="numeric" maxlength="1" class="otp-box" data-otp-index="5">
        </div>
        <p class="modal-error" id="otpError" hidden></p>
        <button type="button" class="btn btn-primary btn-ripple modal-submit" id="verifyOtpBtn">Verify OTP</button>
        <p class="modal-resend">Didn't get it? <button type="button" class="link-btn" id="resendOtpBtn" disabled>Resend in <span id="resendTimer">30</span>s</button></p>
      </div>

      <div class="modal-screen screen-off-right" data-screen="profile" inert aria-hidden="true">
        <h2 class="modal-title">Complete your profile</h2>
        <p class="modal-sub">Just a couple of details and you're in.</p>
        <div class="form-field">
          <label for="signupName">Full name</label>
          <input type="text" id="signupName" placeholder="Your name" autocomplete="name">
        </div>
        <div class="form-field">
          <label for="signupEmail">Email address</label>
          <input type="email" id="signupEmail" placeholder="you@email.com" autocomplete="email">
        </div>
        <p class="modal-error" id="profileError" hidden></p>
        <button type="button" class="btn btn-primary btn-ripple modal-submit" id="completeRegBtn">Complete Registration</button>
      </div>

      <div class="modal-screen screen-off-right" data-screen="success" inert aria-hidden="true">
        <div class="modal-success-icon" aria-hidden="true">&check;</div>
        <h2 class="modal-title">Welcome to Folks!</h2>
        <p class="modal-sub" id="successMessage">You're all set to browse services.</p>
      </div>

    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', markup);
}
