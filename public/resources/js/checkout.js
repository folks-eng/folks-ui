/* =========================================================================
 FOLKS — checkout.js
 Drives the Checkout page: order summary (editable), payment method
 selection, and booking completion. Reads the shared cart/session helpers
 from script.js and calls FolksAPI.createBooking() (api.js) — no network
 calls happen directly in this file.
 ========================================================================= */

const PAYMENT_METHODS = [
    {
        id: 'COD',
        label: 'Cash on Service',
        description: 'Pay the professional directly once the job is done.',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>',
    },
    {
        id: 'UPI',
        label: 'UPI',
        description: 'Pay instantly using any UPI app at checkout.',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    },
    {
        id: 'CARD',
        label: 'Credit / Debit Card',
        description: 'Pay securely online with your card.',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M2 10h20" stroke="currentColor" stroke-width="2"/></svg>',
    },
];

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCart === 'undefined')
        return; // guard: only runs on checkout.html
    initCheckoutPage();
});

function initCheckoutPage() {
    const gate = document.getElementById('checkoutGate');
    const empty = document.getElementById('checkoutEmpty');
    const content = document.getElementById('checkoutContent');
    const success = document.getElementById('checkoutSuccess');
    if (!gate || !content)
        return;

    if (!isLoggedIn() || !getCurrentUser()) {
        show(gate);
        hide(empty);
        hide(content);
        hide(success);
        const gateBtn = document.getElementById('checkoutGateSignupBtn');
        if (gateBtn)
            gateBtn.addEventListener('click', () => document.getElementById('signupBtn')?.click());
        return;
    }

    if (getCart().length === 0) {
        hide(gate);
        show(empty);
        hide(content);
        hide(success);
        return;
    }

    hide(gate);
    hide(empty);
    show(content);
    hide(success);
    renderOrderSummary();
    renderPaymentMethods();
    wireCompleteBooking();
}

/* ---- Order summary --------------------------------------------------- */
function renderOrderSummary() {
    const list = document.getElementById('orderSummaryList');
    if (!list)
        return;

    const cart = getCart();
    if (cart.length === 0) {
        // Cart became empty mid-session (e.g. user removed the last item) —
        // re-run the gate logic rather than showing a broken empty summary.
        initCheckoutPage();
        return;
    }

    list.innerHTML = cart.map(item => `
    <div class="order-line" data-order-line="${item.skuId}">
      <div class="order-line-info">
        <p class="order-line-breadcrumb">${escapeHtmlC(item.categoryName)} · ${escapeHtmlC(item.subCategoryName)}</p>
        <h3 class="order-line-name">${escapeHtmlC(item.name)}</h3>
        <p class="order-line-schedule">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          ${formatScheduleLong(item)}
          <button type="button" class="link-btn" data-order-change-slot="${item.skuId}">Change</button>
        </p>
        <p class="order-line-schedule">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          ${escapeHtmlC(item.addressSummary || 'No address selected')}
        </p>
      </div>
      <div class="order-line-controls">
        <div class="sku-stepper is-visible">
          <button type="button" data-order-decrement="${item.skuId}" aria-label="Remove one">&minus;</button>
          <span class="sku-stepper-qty">${item.qty}</span>
          <button type="button" data-order-increment="${item.skuId}" aria-label="Add one more">+</button>
        </div>
        <span class="order-line-price">${item.currency} ${(item.qty * item.price).toLocaleString('en-IN')}</span>
        <button type="button" class="order-line-remove" data-order-remove="${item.skuId}" aria-label="Remove ${escapeHtmlC(item.name)} from cart">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m3 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');

    updateTotals();
    wireOrderLineControls();
}

function wireOrderLineControls() {
    document.querySelectorAll('[data-order-increment]').forEach(btn => {
        btn.addEventListener('click', () => {
            const skuId = btn.dataset.orderIncrement;
            const cart = getCart();
            const item = cart.find(i => i.skuId === skuId);
            if (item) {
                item.qty += 1;
                saveCart(cart);
                renderOrderSummary();
            }
        });
    });
    document.querySelectorAll('[data-order-decrement]').forEach(btn => {
        btn.addEventListener('click', () => {
            const skuId = btn.dataset.orderDecrement;
            let cart = getCart();
            const item = cart.find(i => i.skuId === skuId);
            if (!item)
                return;
            item.qty -= 1;
            if (item.qty <= 0)
                cart = cart.filter(i => i.skuId !== skuId);
            saveCart(cart);
            renderOrderSummary();
        });
    });
    document.querySelectorAll('[data-order-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const skuId = Number(btn.dataset.orderRemove);
            const cart = getCart().filter(i => i.skuId !== skuId);
            saveCart(cart);
            renderOrderSummary();
        });
    });
    document.querySelectorAll('[data-order-change-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
            const skuId = Number(btn.dataset.orderChangeSlot);
            const cart = getCart();
            const item = cart.find(i => i.skuId === skuId);
            if (!item)
                return;
            openSchedulePicker(item.name, item, (schedule) => {
                item.date = schedule.date;
                item.timeSlotId = schedule.timeSlotId;
                item.timeSlotLabel = schedule.timeSlotLabel;
                saveCart(cart);
                renderOrderSummary();
            });
        });
    });
}

function updateTotals() {
    const cart = getCart();
    const total = getCartTotal(cart);
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const totalEl = document.getElementById('checkoutTotal');
    if (subtotalEl)
        subtotalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
    if (totalEl)
        totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
}

/* ---- Payment method ---------------------------------------------------- */
let selectedPaymentMethod = null;

function renderPaymentMethods() {
    const list = document.getElementById('paymentMethodList');
    if (!list)
        return;

    list.innerHTML = PAYMENT_METHODS.map((pm, i) => `
    <label class="payment-method${i === 0 ? ' is-active' : ''}">
      <input type="radio" name="paymentMethod" value="${pm.id}" ${i === 0 ? 'checked' : ''}>
      <span class="payment-method-icon" aria-hidden="true">${pm.icon}</span>
      <span class="payment-method-text">
        <strong>${pm.label}</strong>
        <small>${pm.description}</small>
      </span>
    </label>
  `).join('');

    selectedPaymentMethod = PAYMENT_METHODS[0].id;

    list.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
        input.addEventListener('change', () => {
            selectedPaymentMethod = input.value;
            list.querySelectorAll('.payment-method').forEach(el => el.classList.remove('is-active'));
            input.closest('.payment-method').classList.add('is-active');
        });
    });
}

/* ---- Complete booking ---------------------------------------------------- */
function wireCompleteBooking() {
    const btn = document.getElementById('completeBookingBtn');
    const errorEl = document.getElementById('checkoutError');
    if (!btn)
        return;

    btn.addEventListener('click', async () => {
        errorEl.hidden = true;
        const cart = getCart();
        
        if (cart.length === 0) {
            return;
        }
        if (!selectedPaymentMethod) {
            errorEl.textContent = 'Please select a payment method.';
            errorEl.hidden = false;
            return;
        }

        const amount = getCartTotal(cart);

        // No customer/identity fields here on purpose: the server reads who's
        // booking from the JWT cookie set at login/signup, not from anything
        // the browser sends explicitly.
        
        const payload = cart.map(item => ({
            serviceId: item.skuId,
            addressId: item.addressId,
            scheduledAt: item.date + 'T' + item.timeSlotLabel.split(" - ")[0] + ':00',
            timeSlot: item.timeSlotLabel,
            // quantity: item.qty,
            totalAmount: item.price,
            paymentMethod: selectedPaymentMethod
        }));
        
        // const payload = {
        //     services: cart.map(item => ({
        //             serviceId: item.skuId,
        //             addressId: item.addressId,
        //             scheduledAt: item.date,
        //             timeSlot: item.timeSlotLabel,
        //             quantity: item.qty,
        //             totalAmount: item.price
        //         })),
        //     paymentMethod: selectedPaymentMethod,
        //     amount
        // };
        // alert(JSON.stringify(payload[0]));

        btn.disabled = true;
        btn.textContent = 'Confirming your booking…';

        const result = await FolksAPI.createBooking(payload[0]);
        
        btn.disabled = false;
        btn.textContent = 'Complete Booking';

        if (!result.success) {
            errorEl.textContent = result.message || 'Could not complete your booking. Please try again.';
            errorEl.hidden = false;
            return;
        }

        clearCart();
        showBookingSuccess(result.result, amount);
    });
}

function showBookingSuccess(booking, amount) {
    alert(JSON.stringify(booking));
    hide(document.getElementById('checkoutContent'));
    const success = document.getElementById('checkoutSuccess');
    const msg = document.getElementById('bookingConfirmMessage');
    const idEl = document.getElementById('bookingConfirmId');
    if (msg)
        msg.textContent = `Your booking is confirmed. A total of ₹${amount.toLocaleString('en-IN')} will be collected as agreed.`;
    if (idEl)
        idEl.textContent = booking && booking.bookingId ? booking.bookingId : 'N/A';
    show(success);
    success.scrollIntoView({behavior: 'smooth', block: 'start'});
}

/* ---- helpers ---------------------------------------------------------- */
function formatScheduleLong(item) {
    if (!item.date)
        return 'No slot selected';
    const d = new Date(item.date + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short'});
    return `${dateLabel} · ${item.timeSlotLabel}`;
}
function show(el) {
    if (el)
        el.hidden = false;
}
function hide(el) {
    if (el)
        el.hidden = true;
}
function escapeHtmlC(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
