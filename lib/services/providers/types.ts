export interface FundamentalData {
  symbol: string;
  insiderOwnership: number | null;
  institutionalOwnership: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  freeCashFlow: number | null;
  cashRunwayMonths: number | null;
  researchDevelopment: number | null;
  totalRevenue: number | null;
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
  website: string | null;
}

export interface StockData {
  marketData: MarketData;
  fundamentalData: FundamentalData;
  shortInterestData: ShortInterestData;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

export interface CalendarEvents {
  earningsDate: string | null;
  earningsDateEnd: string | null;
  exDividendDate: string | null;
  dividendDate: string | null;
}

export interface AnalystRating {
  firm: string;
  toGrade: string;
  fromGrade: string | null;
  action: string;
  date: string;
}

export interface AnalystData {
  targetPrice: number | null;
  targetPriceLow: number | null;
  targetPriceHigh: number | null;
  targetPriceMean: number | null;
  numberOfAnalysts: number | null;
  recommendationKey: string | null;
  recommendationMean: number | null;
  recentRatings: AnalystRating[];
}

export interface ShortInterestData {
  shortPercentOfFloat: number | null;    // % of float shares that are shorted
  sharesShort: number | null;            // total shares shorted
  shortRatio: number | null;             // days to cover
  sharesShortPriorMonth: number | null;  // previous month for trend
  dateShortInterest: string | null;      // date of the data
}
