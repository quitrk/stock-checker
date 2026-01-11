export interface FundamentalData {
  symbol: string;
  insiderOwnership: number | null;
  institutionalOwnership: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  freeCashFlow: number | null;
  cashRunwayMonths: number | null;
}

export interface MarketData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  avgVolume10Day: number;
  avgVolume90Day: number;
  high52Week: number;
  low52Week: number;
  companyName: string;
  industry: string;
  marketCap: number;
}

export interface StockData {
  marketData: MarketData;
  fundamentalData: FundamentalData;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
