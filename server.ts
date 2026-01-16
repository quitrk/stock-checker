import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ChecklistService } from './lib/services/ChecklistService.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const checklistService = new ChecklistService();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Checklist endpoint
app.get('/api/checklist/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const skipCache = req.query.refresh === 'true';

  try {
    const result = await checklistService.generateChecklist(symbol.toUpperCase(), skipCache);
    res.json(result);
  } catch (error) {
    console.error(`[API] Error generating checklist for ${symbol}:`, error);
    res.status(500).json({
      error: 'Failed to generate checklist',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
  console.log(`Cache: ${process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis enabled' : 'disabled (no credentials)'}`);
});
