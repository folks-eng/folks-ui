/* =========================================================================
   professionalsController.js
   Handles POST /api/v1/professionals — a professional's application to
   join Folks. Backed by src/data/professionals/applications.json.
   ========================================================================= */

const path = require('path');
const { readJSON, writeJSON } = require('../utils/jsonStore');

const APPLICATIONS_FILE = path.join(__dirname, '..', 'data', 'professionals', 'applications.json');

async function applyAsProfessional(body) {
  const payload = body || {};
  const applications = await readJSON(APPLICATIONS_FILE, []);

  const application = {
    id: `pro-app-${Date.now()}`,
    status: 'Pending Review',
    submittedOn: new Date().toISOString(),
    ...payload,
  };

  applications.push(application);
  await writeJSON(APPLICATIONS_FILE, applications);

  return { success: true, application };
}

module.exports = { applyAsProfessional };
