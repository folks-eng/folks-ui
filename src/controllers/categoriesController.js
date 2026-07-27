/* =========================================================================
   categoriesController.js
   A bonus, read-only endpoint: GET /api/v1/categories. Not currently
   called by the frontend (categories.html loads categories-data.js
   directly as a script for simplicity), but the same category/service
   data is exposed here too since it fits the "JSON file per resource"
   pattern this backend otherwise follows. Backed by
   src/data/categories/categories.json (mirrors categories-data.js).
   ========================================================================= */

const path = require('path');
const { readJSON } = require('../utils/jsonStore');

const CATEGORIES_FILE = path.join(__dirname, '..', 'data', 'categories', 'categories.json');

async function getCategories() {
  const categories = await readJSON(CATEGORIES_FILE, []);
  return { success: true, categories };
}

module.exports = { getCategories };
