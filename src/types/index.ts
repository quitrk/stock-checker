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
}

export interface ChecklistResult {
  symbol: string;
  companyName: string;
  industry: string;
  isBiotech: boolean;
  price: number;
  marketCap: number;
  categories: ChecklistCategory[];
  overallStatus: ChecklistStatus;
  timestamp: string;
  errors: string[];
}
