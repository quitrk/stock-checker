export type ChecklistStatus = 'safe' | 'warning' | 'danger' | 'unavailable';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  value: string | number | boolean | null;
  displayValue: string;
  status: ChecklistStatus;
  thresholds?: {
    safe: string;
    warning: string;
    danger: string;
  };
}

export interface ChecklistCategory {
  id: string;
  name: string;
  description: string;
  items: ChecklistItem[];
  status: ChecklistStatus;
  summaryItemId?: string;
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
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
  summary?: string;
}

export interface ShortInterestData {
  shortPercentOfFloat: number | null;
  sharesShort: number | null;
  shortRatio: number | null;
  sharesShortPriorMonth: number | null;
  dateShortInterest: string | null;
}

export interface EarningsHistoryItem {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
  priceMovement: number | null;
}

export interface EarningsPerformance {
  history: EarningsHistoryItem[];
  beatCount: number;
  totalCount: number;
  avgPriceMove: number | null;
  lastPriceMove: number | null;
}

// Catalyst Event Types
export type CatalystEventType =
  | 'earnings'
  | 'earnings_call'
  | 'ex_dividend'
  | 'dividend_payment'
  | 'stock_split'
  | 'reverse_split'
  | 'analyst_rating'
  | 'clinical_trial'
  | 'fda_approval'
  | 'pdufa_date'
  | 'sec_filing'
  | 'insider_transaction'
  | 'executive_change'
  | 'acquisition'
  | 'partnership';

export type CatalystSource = 'yahoo' | 'sec' | 'clinicaltrials' | 'finnhub';

export interface EarningsHistoryEntry {
  date: string;
  beat: boolean | null;
  priceMove: number | null;
}

export interface CatalystEvent {
  id: string;
  symbol: string;
  eventType: CatalystEventType;
  date: string;
  dateEnd?: string;
  isEstimate: boolean;
  title: string;
  description?: string;
  source: CatalystSource;
  sourceUrl?: string;
  // Earnings
  earningsHistory?: EarningsHistoryEntry[];
  epsEstimate?: number;
  revenueEstimate?: number;
  // Insider transactions
  insiderName?: string;
  insiderRelation?: string;
  insiderShares?: number;
  insiderValue?: number;
  // SEC filings
  secForm?: string;
  secItemCode?: string;
  // Clinical trials
  trialPhases?: string[];
}

export interface ChecklistResult {
  symbol: string;
  companyName: string;
  industry: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  marketCap: number;
  logoUrl: string | null;
  categories: ChecklistCategory[];
  overallStatus: ChecklistStatus;
  timestamp: string;
  errors: string[];
  news: NewsItem[];
  newsSummary?: string;
  catalystEvents: CatalystEvent[];
  analystData: AnalystData | null;
  shortInterestData: ShortInterestData | null;
  earningsPerformance: EarningsPerformance | null;
}
