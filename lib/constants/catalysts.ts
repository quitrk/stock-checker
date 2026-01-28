import type { CatalystEventType } from '../types/index.js';

export interface CatalystInfo {
  label: string;
  icon: string;
  description: string;
  whyItMatters: string;
  category: 'fda' | 'clinical' | 'financial' | 'corporate';
}

// Drug development timeline - shows the typical order of events
export interface TimelineStep {
  eventType: CatalystEventType;
  stage: string;
  description?: string; // Override default description from CATALYST_INFO
  successRate?: string;
  duration?: string;
}

export const DRUG_DEVELOPMENT_TIMELINE: TimelineStep[] = [
  { eventType: 'clinical_trial', stage: 'Phase 1', description: 'First human trials testing safety (20-100 patients)', successRate: '~65%', duration: '1-2 years' },
  { eventType: 'clinical_trial', stage: 'Phase 2', description: 'Tests effectiveness and optimal dosing (100-300 patients)', successRate: '~30%', duration: '2-3 years' },
  { eventType: 'clinical_trial', stage: 'Phase 3', description: 'Large-scale trials proving efficacy (300-3000 patients)', successRate: '~58%', duration: '3-4 years' },
  { eventType: 'clinical_readout', stage: 'Data Readout' },
  { eventType: 'nda_bla_submission', stage: 'NDA/BLA Filing' },
  { eventType: 'fda_designation', stage: 'FDA Designation', duration: '(optional)' },
  { eventType: 'adcom', stage: 'AdCom Meeting', duration: '(if required)' },
  { eventType: 'pdufa_date', stage: 'PDUFA Date', successRate: '~90%', duration: '10-12 months' },
  { eventType: 'fda_approval', stage: 'FDA Approval' },
];

export const CATALYST_INFO: Record<CatalystEventType, CatalystInfo> = {
  // FDA/Regulatory Events
  pdufa_date: {
    label: 'PDUFA Date',
    icon: '🗓️',
    description: "FDA's deadline to decide on a drug application",
    whyItMatters:
      'PDUFA (Prescription Drug User Fee Act) dates are FDA-mandated deadlines. Approval can send stock up 50-200%, while rejection (CRL) can cause 50-80% drops. This is often the most significant binary event for biotech stocks.',
    category: 'fda',
  },
  adcom: {
    label: 'AdCom Meeting',
    icon: '👥',
    description: 'FDA Advisory Committee reviews and votes on drug approval',
    whyItMatters:
      'Advisory committees are panels of outside experts who vote on whether to recommend FDA approval. A favorable vote (>50% yes) typically signals upcoming approval, while a negative vote often precedes rejection.',
    category: 'fda',
  },
  fda_approval: {
    label: 'FDA Approval',
    icon: '✅',
    description: 'FDA grants permission to sell a drug in the US',
    whyItMatters:
      'Major positive catalyst that validates years of R&D investment. Allows the company to commercialize and generate revenue from the drug.',
    category: 'fda',
  },
  fda_rejection: {
    label: 'FDA Rejection (CRL)',
    icon: '❌',
    description: 'FDA issues Complete Response Letter requiring more data',
    whyItMatters:
      "A CRL (Complete Response Letter) means the FDA won't approve the drug in its current form. Often causes 50-80% drops. May require additional trials, taking years and significant investment to address.",
    category: 'fda',
  },
  fda_designation: {
    label: 'FDA Designation',
    icon: '⭐',
    description: 'Special FDA status like Breakthrough Therapy or Fast Track',
    whyItMatters:
      'Designations (Breakthrough Therapy, Fast Track, Priority Review, Orphan Drug) speed up the review timeline and signal the FDA sees promise in the drug. Often viewed as de-risking the approval path.',
    category: 'fda',
  },
  nda_bla_submission: {
    label: 'NDA/BLA Filing',
    icon: '📝',
    description: 'Company submits drug application to FDA for review',
    whyItMatters:
      'NDA (New Drug Application) or BLA (Biologics License Application) submission starts the official FDA review clock. Sets the PDUFA date and shows the drug candidate is ready for regulatory review.',
    category: 'fda',
  },

  // Clinical Trial Events
  clinical_trial: {
    label: 'Clinical Trial',
    icon: '🧬',
    description: 'Human trial testing drug safety and effectiveness',
    whyItMatters:
      'Clinical trials are required to prove a drug works. Phase 1 tests safety (~65% success), Phase 2 tests efficacy (~30% success), Phase 3 confirms results in large populations. Later phases are more significant.',
    category: 'clinical',
  },
  clinical_readout: {
    label: 'Data Readout',
    icon: '📊',
    description: 'Trial results are announced publicly',
    whyItMatters:
      'Data readouts reveal whether a drug worked in trials. Positive data can cause 50-100%+ gains, while failed trials often result in 50-80% drops. "Topline" data is the first look at key results.',
    category: 'clinical',
  },
  clinical_milestone: {
    label: 'Trial Milestone',
    icon: '🎯',
    description: 'Key trial event like enrollment completion or first patient dosed',
    whyItMatters:
      'Milestones show a trial is progressing on schedule. "First patient dosed" starts the trial, "enrollment complete" means all patients are in, both signal the company is executing its plan.',
    category: 'clinical',
  },

  // Financial Events
  earnings: {
    label: 'Earnings Report',
    icon: '📊',
    description: 'Quarterly financial results announcement',
    whyItMatters:
      'Reveals company financial health through revenue, profit, and guidance. Beating or missing Wall Street estimates often causes significant price moves. Also watch for pipeline updates during earnings calls.',
    category: 'financial',
  },
  earnings_call: {
    label: 'Earnings Call',
    icon: '📞',
    description: 'Conference call where management discusses results',
    whyItMatters:
      'Management provides context on results and future outlook. Forward guidance and Q&A often move stocks more than the actual numbers.',
    category: 'financial',
  },
  ex_dividend: {
    label: 'Ex-Dividend Date',
    icon: '💰',
    description: 'Last day to buy stock and receive the dividend',
    whyItMatters:
      "If you own shares before this date, you'll receive the dividend. Stock price typically drops by the dividend amount on this date as new buyers won't receive the payment.",
    category: 'financial',
  },
  dividend_payment: {
    label: 'Dividend Payment',
    icon: '💵',
    description: 'Date when dividend is paid to shareholders',
    whyItMatters: 'The actual date cash hits your brokerage account. Usually 2-4 weeks after the ex-dividend date.',
    category: 'financial',
  },
  stock_split: {
    label: 'Stock Split',
    icon: '➗',
    description: 'Company divides shares (e.g., 4-for-1)',
    whyItMatters:
      "Splits reduce share price without changing company value. Often bullish as it makes shares more accessible to retail investors. A 4-for-1 split means you'll have 4x shares at 1/4 the price.",
    category: 'financial',
  },
  reverse_split: {
    label: 'Reverse Split',
    icon: '⚠️',
    description: 'Company combines shares (e.g., 1-for-10)',
    whyItMatters:
      "Often a warning sign - companies do this to meet minimum price requirements ($1 for Nasdaq). A 1-for-10 split means you'll have 1/10 the shares at 10x the price. Watch for continued decline after.",
    category: 'financial',
  },

  // Corporate Events
  analyst_rating: {
    label: 'Analyst Rating',
    icon: '📈',
    description: 'Wall Street analyst upgrades or downgrades the stock',
    whyItMatters:
      'Analyst ratings influence institutional buying/selling. Upgrades to "Buy" can drive demand, while downgrades can trigger selling. Price target changes show where analysts think the stock should trade.',
    category: 'corporate',
  },
  insider_transaction: {
    label: 'Insider Trade',
    icon: '👤',
    description: 'Executives or directors buying or selling company stock',
    whyItMatters:
      'Insider buying often signals confidence - they\'re risking their own money. Large insider selling can raise concerns, though it\'s often for personal reasons (diversification, taxes). Look for clusters of buys.',
    category: 'corporate',
  },
  executive_change: {
    label: 'Executive Change',
    icon: '👔',
    description: 'New CEO, CFO, or other key executive appointment',
    whyItMatters:
      'Leadership changes can signal new strategic direction. CEO departures can cause uncertainty, while bringing in experienced executives may boost confidence.',
    category: 'corporate',
  },
  acquisition: {
    label: 'Acquisition',
    icon: '🏢',
    description: 'Company being acquired or acquiring another company',
    whyItMatters:
      'Being acquired usually means a premium price for shareholders. Acquiring another company can be positive (growth) or negative (overpaying). Watch deal terms and financing.',
    category: 'corporate',
  },
  partnership: {
    label: 'Partnership',
    icon: '🤝',
    description: 'Strategic alliance or licensing deal with another company',
    whyItMatters:
      'Partnerships can provide funding (upfront payments, milestones), validation from larger companies, or market access. Look at deal size and partner reputation.',
    category: 'corporate',
  },
  sec_filing: {
    label: 'SEC Filing',
    icon: '📄',
    description: 'Required regulatory filing with the SEC',
    whyItMatters:
      'SEC filings contain important disclosures. 8-K filings report material events, 10-K/10-Q contain financials, S-3 filings often precede stock offerings (dilution).',
    category: 'corporate',
  },
};

// Category metadata for the learn section
export interface CategoryInfo {
  id: 'fda' | 'clinical' | 'financial' | 'corporate';
  name: string;
  description: string;
}

export const CATALYST_CATEGORIES: CategoryInfo[] = [
  {
    id: 'fda',
    name: 'FDA & Regulatory',
    description:
      'FDA events are the most impactful catalysts for biotech stocks. These binary events can cause massive price swings based on approval or rejection decisions.',
  },
  {
    id: 'clinical',
    name: 'Clinical Trials',
    description:
      'Clinical trials test whether drugs are safe and effective. Data readouts from trials are major catalysts that can validate or invalidate years of research.',
  },
  {
    id: 'financial',
    name: 'Financial Events',
    description:
      'Quarterly earnings, dividends, and stock structure changes that affect company valuation and shareholder returns.',
  },
  {
    id: 'corporate',
    name: 'Corporate Events',
    description:
      'Business developments including partnerships, leadership changes, and analyst coverage that can influence stock price.',
  },
];

// Helper to get catalysts by category
export function getCatalystsByCategory(category: CategoryInfo['id']): Array<[CatalystEventType, CatalystInfo]> {
  return (Object.entries(CATALYST_INFO) as Array<[CatalystEventType, CatalystInfo]>).filter(
    ([, info]) => info.category === category
  );
}
