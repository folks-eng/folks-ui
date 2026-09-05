/* =========================================================================
 FOLKS — vouchers.js
 Renders the voucher list and wires up "Copy code" buttons. No backend
 endpoint was specified for vouchers, so this is a small curated set
 shown to every signed-in customer, in the same spirit as a real
 promotions service would eventually back this page with.
 ========================================================================= */

const VOUCHERS = [
    {
        code: 'WELCOME50',
        title: 'Welcome offer',
        description: 'Flat ₹50 off your first booking on Folks.',
        terms: 'Valid on orders above ₹299. One-time use per account.',
        expiry: 'No expiry',
    },
    {
        code: 'FOLKS100',
        title: '₹100 off',
        description: '₹100 off any booking above ₹999.',
        terms: 'Valid on all categories. Cannot be combined with other offers.',
        expiry: 'Valid till 31 Aug 2026',
    },
    {
        code: 'SALON20',
        title: '20% off Salon & Makeup',
        description: '20% off on any Salon & Makeup service, up to ₹200.',
        terms: 'Applicable on Women\u2019s Salon, Men\u2019s Salon and Bridal & Party Makeup.',
        expiry: 'Valid till 15 Aug 2026',
    },
    {
        code: 'REFER200',
        title: 'Refer & earn',
        description: '₹200 Folks credit for every friend who completes their first booking.',
        terms: 'Credit is added to your account within 24 hours of their booking.',
        expiry: 'No expiry',
    },
];

document.addEventListener('DOMContentLoaded', () => {
    if (typeof getCurrentUser === 'undefined')
        return; // guard: only runs on vouchers.html
    initVouchersPage();
});

function initVouchersPage() {
    const gate = document.getElementById('vouchersGate');
    const content = document.getElementById('vouchersContent');
    if (!gate || !content)
        return;

    if (!isLoggedIn() || !getCurrentUser()) {
        gate.hidden = false;
        content.hidden = true;
        document.getElementById('vouchersGateSignupBtn')?.addEventListener('click', () => {
            document.getElementById('signupBtn')?.click();
        });
        return;
    }

    gate.hidden = true;
    content.hidden = false;
    renderVouchers();
}

async function renderVouchers() {
    const grid = document.getElementById('vouchersGrid');
    if (!grid)
        return;

    const res = await FolksAPI.viewVouchers();
    if (! res.success) {
        alert('Unable to fetch vouchers. Msg: ' + res.message);
        return;
    }
    const vouchers = res.result.items;

    grid.innerHTML = vouchers.map(v => `
    <div class="voucher-card">
      <div class="voucher-card-main">
        <p class="voucher-title">${escapeHtmlV(v.title)}</p>
        <p class="voucher-description">${escapeHtmlV(v.description)}</p>
        <p class="voucher-terms">${escapeHtmlV(v.terms)}</p>
        <p class="voucher-expiry">${v.expiryDate ? escapeHtmlV(formatFullDate(v.expiryDate)) : 'Never'}</p>
      </div>
      <div class="voucher-card-code">
        <span class="voucher-code">${escapeHtmlV(v.code)}</span>
        <button type="button" class="btn btn-ghost btn-sm voucher-copy-btn" data-copy-code="${escapeHtmlV(v.code)}">Copy code</button>
      </div>
    </div>
  `).join('');

    grid.querySelectorAll('[data-copy-code]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const code = btn.dataset.copyCode;
            try {
                await navigator.clipboard.writeText(code);
            } catch (err) {
                // Clipboard API can be blocked in some contexts — fail silently,
                // the code is already clearly visible for manual copying.
            }
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = original;
            }, 1600);
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

function escapeHtmlV(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
