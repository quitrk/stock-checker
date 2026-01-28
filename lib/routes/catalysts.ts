import { Hono } from 'hono';
import { CATALYST_INFO, CATALYST_CATEGORIES, DRUG_DEVELOPMENT_TIMELINE } from '../constants/catalysts.js';

const catalysts = new Hono();

// GET /api/catalysts/info - Returns catalyst type metadata for educational UI
catalysts.get('/info', (c) => {
  return c.json({
    types: CATALYST_INFO,
    categories: CATALYST_CATEGORIES,
    timeline: DRUG_DEVELOPMENT_TIMELINE,
  });
});

export default catalysts;
