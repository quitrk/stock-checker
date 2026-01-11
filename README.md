# Stock Checker

A web application for evaluating stocks based on volume analysis, fundamentals, price analysis, and SEC filings.

## Features

- **Volume Analysis**: Detect unusual volume spikes and price movements
- **Fundamentals**: Check insider/institutional ownership, cash runway
- **Price Analysis**: Monitor price levels and delisting risk
- **Risk Indicators**: Auto-detect ATM offerings, reverse splits, and Nasdaq deficiency notices from SEC filings

## Development

```bash
# Install dependencies
npm install

# Run development server (with Vercel dev for API routes)
npm run dev

# Build for production
npm run build
```

## Deployment to Vercel

1. Push this repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Deploy - Vercel will automatically detect the configuration

Or deploy via CLI:

```bash
npm i -g vercel
vercel
```

## Project Structure

```
stock-checker/
├── api/                    # Vercel serverless functions
│   └── checklist/
│       └── [symbol].ts     # GET/POST /api/checklist/:symbol
├── lib/                    # Shared backend code
│   ├── services/
│   │   ├── ChecklistService.ts
│   │   ├── SECService.ts
│   │   └── providers/
│   │       └── YahooFinanceProvider.ts
│   └── types/
├── src/                    # Frontend React app
│   ├── components/
│   ├── contexts/
│   ├── api/
│   └── types/
├── vercel.json            # Vercel configuration
└── vite.config.ts         # Vite configuration
```

## API

### GET /api/checklist/:symbol

Fetch checklist for a stock symbol.

### POST /api/checklist/:symbol

Fetch checklist with manual input overrides.

```json
{
  "insiderOwnership": 15.5,
  "institutionalOwnership": 25.0,
  "clinicalStage": "phase2",
  "hasRecentATM": false,
  "hasPendingReverseSplit": false,
  "hasNasdaqDeficiency": false,
  "daysBelow1Dollar": 0
}
```

## Data Sources

- **Yahoo Finance**: Market data, fundamentals, ownership percentages
- **SEC EDGAR**: Filing analysis for ATM offerings (S-3), reverse splits (8-K Item 5.03), Nasdaq deficiency notices (8-K Item 3.01)
