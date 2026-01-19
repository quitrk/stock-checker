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

export interface CalendarEvents {
  earningsDate: string | null;
  earningsDateEnd: string | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  summary?: string;
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
  calendarEvents: CalendarEvents | null;
  analystData: AnalystData | null;
  shortInterestData: ShortInterestData | null;
}
