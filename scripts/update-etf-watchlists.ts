import 'dotenv/config';
import * as XLSX from 'xlsx';
import { YahooFinanceProvider } from '../lib/services/providers/YahooFinanceProvider.js';
import { WatchlistService } from '../lib/services/WatchlistService.js';
import { ChecklistService } from '../lib/services/ChecklistService.js';
import { SYSTEM_WATCHLIST_IDS } from '../lib/constants/system.js';

interface Holding {
  symbol: string;
  name: string;
  weight: number; // 0-1
}

interface ETFConfig {
  id: string;
  name: string;
  fetchHoldings: () => Promise<Holding[]>;
}

function getLogoUrl(symbol: string): string | null {
  const logoKitToken = process.env.LOGOKIT_TOKEN;
  return logoKitToken ? `/api/logo/${symbol.toUpperCase()}` : null;
}

// Fetch iShares IBB holdings from CSV
async function fetchIBBHoldings(): Promise<Holding[]> {
  const url = 'https://www.ishares.com/us/products/239699/ishares-biotechnology-etf/1467271812596.ajax?fileType=csv&fileName=IBB_holdings&dataType=fund';

  console.log('  Fetching IBB holdings from iShares...');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch IBB holdings: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split('\n');

  // Find the header row (contains "Ticker")
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Ticker') && lines[i].includes('Weight')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Could not find header row in IBB CSV');
  }

  // Parse header
  const header = parseCSVLine(lines[headerIndex]);
  const tickerIdx = header.findIndex(h => h === 'Ticker');
  const nameIdx = header.findIndex(h => h === 'Name');
  const weightIdx = header.findIndex(h => h.includes('Weight'));

  if (tickerIdx === -1 || weightIdx === -1) {
    throw new Error('Missing required columns in IBB CSV');
  }

  const holdings: Holding[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const ticker = cols[tickerIdx]?.trim();
    const name = cols[nameIdx]?.trim() || ticker;
    const weightStr = cols[weightIdx]?.trim();

    // Skip non-equity rows (cash, futures, etc.)
    if (!ticker || ticker === '-' || !weightStr) continue;

    const weight = parseFloat(weightStr.replace('%', '')) / 100;
    if (isNaN(weight) || weight <= 0) continue;

    // Skip non-US symbols (those with dots)
    if (ticker.includes('.')) continue;

    holdings.push({ symbol: ticker, name, weight });
  }

  return holdings;
}

// Fetch SPDR XBI holdings from Excel
async function fetchXBIHoldings(): Promise<Holding[]> {
  const url = 'https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-xbi.xlsx';

  console.log('  Fetching XBI holdings from SSGA...');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch XBI holdings: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Get holdings sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays to handle header row offset
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  // Find header row (contains "Ticker" and "Weight")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (Array.isArray(row) && row.includes('Ticker') && row.includes('Weight')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Could not find header row in XBI Excel');
  }

  const header = rows[headerIndex] as string[];
  const tickerIdx = header.indexOf('Ticker');
  const nameIdx = header.indexOf('Name');
  const weightIdx = header.indexOf('Weight');

  const holdings: Holding[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] as any[];
    if (!row || row.length === 0) continue;

    const ticker = row[tickerIdx];
    const name = row[nameIdx] || ticker;
    const weightRaw = row[weightIdx];

    if (!ticker || typeof ticker !== 'string' || ticker === '-') continue;

    // Parse weight (SSGA uses percentage values like 2.037207 for 2.04%)
    let weight: number;
    if (typeof weightRaw === 'number') {
      weight = weightRaw / 100;
    } else if (typeof weightRaw === 'string') {
      weight = parseFloat(weightRaw.replace('%', '')) / 100;
    } else {
      continue;
    }

    if (isNaN(weight) || weight <= 0) continue;

    // Skip non-US symbols
    if (ticker.includes('.')) continue;

    holdings.push({ symbol: ticker.trim(), name: name?.trim() || ticker, weight });
  }

  return holdings;
}

// Simple CSV line parser (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

const ETF_CONFIGS: ETFConfig[] = [
  {
    id: SYSTEM_WATCHLIST_IDS.XBI,
    name: 'XBI (S&P Biotech)',
    fetchHoldings: fetchXBIHoldings,
  },
  {
    id: SYSTEM_WATCHLIST_IDS.IBB,
    name: 'IBB (Nasdaq Biotech)',
    fetchHoldings: fetchIBBHoldings,
  },
];

async function updateETFWatchlists() {
  console.log('Starting ETF watchlist update...\n');

  const financeProvider = new YahooFinanceProvider();
  const watchlistService = new WatchlistService();
  const allSymbols = new Set<string>();

  // Phase 1: Fetch holdings and update watchlists
  console.log('=== Phase 1: Updating watchlists ===\n');

  for (const config of ETF_CONFIGS) {
    try {
      console.log(`Processing ${config.name}...`);

      // Fetch holdings from provider
      const holdings = await config.fetchHoldings();

      if (holdings.length === 0) {
        console.warn(`  No holdings found for ${config.name}, skipping...`);
        continue;
      }

      // Sort by weight descending
      holdings.sort((a, b) => b.weight - a.weight);

      const symbols = holdings.map(h => h.symbol);
      console.log(`  Found ${symbols.length} holdings`);

      // Collect unique symbols across all ETFs
      symbols.forEach(s => allSymbols.add(s.toUpperCase()));

      // Create a weight map for quick lookup
      const weightMap = new Map(holdings.map(h => [h.symbol.toUpperCase(), h.weight]));

      // Upsert the system watchlist
      await watchlistService.upsertSystemWatchlist(config.id, config.name, symbols);

      // Fetch price data for all symbols
      console.log(`  Fetching price data...`);
      const quotes = await financeProvider.getMultipleQuotes(symbols);

      // Build stock data array with weights
      const stocks = symbols.map(symbol => {
        const data = quotes.get(symbol.toUpperCase());
        const weight = weightMap.get(symbol.toUpperCase()) || 0;
        return {
          symbol: data?.symbol || symbol,
          companyName: data?.companyName || symbol,
          price: data?.price || 0,
          priceChange: data?.priceChange || 0,
          priceChangePercent: data?.priceChangePercent || 0,
          logoUrl: getLogoUrl(symbol),
          weight,
        };
      });

      // Cache the stock data
      await watchlistService.setSystemWatchlistStocks(config.id, stocks);

      console.log(`  Successfully updated ${config.name} with ${stocks.length} stocks\n`);

      // Small delay between ETFs
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  Error updating ${config.name}:`, error);
    }
  }

  // Phase 2: Fetch checklists for unique symbols
  const uniqueSymbols = Array.from(allSymbols);
  console.log(`\n=== Phase 2: Fetching checklists for ${uniqueSymbols.length} unique symbols ===\n`);

  const checklistService = new ChecklistService();
  const CONCURRENCY = 2;
  let completed = 0;
  let errors = 0;

  for (let i = 0; i < uniqueSymbols.length; i += CONCURRENCY) {
    const batch = uniqueSymbols.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(symbol => checklistService.generateChecklist(symbol, { ttl: 0 }))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        completed++;
      } else {
        errors++;
      }
    }

    // Progress update every 10 symbols
    if ((completed + errors) % 10 === 0 || i + CONCURRENCY >= uniqueSymbols.length) {
      console.log(`  Progress: ${completed}/${uniqueSymbols.length} (${errors} errors)`);
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nCached ${completed} checklists (${errors} errors)`);
  console.log('\nETF watchlist update complete!');
}

updateETFWatchlists().catch(console.error);
