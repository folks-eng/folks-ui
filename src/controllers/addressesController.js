/* =========================================================================
   addressesController.js
   Handles POST /api/v1/addresses (add a new address) and PUT
   /api/v1/addresses (edit an existing one). Backed by
   src/data/addresses/addresses.json. A person can have several saved
   addresses, so this is a flat array, not a single record.
   ========================================================================= */

const path = require('path');
const { readJSON, writeJSON } = require('../utils/jsonStore');

const ADDRESSES_FILE = path.join(__dirname, '..', 'data', 'addresses', 'addresses.json');

async function createAddress(body) {
  const payload = body || {};
  const addresses = await readJSON(ADDRESSES_FILE, []);

  const address = {
    id: `addr-${Date.now()}`,
    label: payload.label || 'Home',
    ...payload,
  };

  addresses.push(address);
  await writeJSON(ADDRESSES_FILE, addresses);

  return { success: true, address };
}

async function updateAddress(body) {
  const payload = body || {};
  const addresses = await readJSON(ADDRESSES_FILE, []);
  const idx = addresses.findIndex(a => a.id === payload.id);

  if (idx === -1) {
    return { success: false, message: 'Address not found.' };
  }

  addresses[idx] = { ...addresses[idx], ...payload };
  await writeJSON(ADDRESSES_FILE, addresses);

  return { success: true, address: addresses[idx] };
}

module.exports = { createAddress, updateAddress };
