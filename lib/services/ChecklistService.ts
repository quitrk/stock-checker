import { YahooFinanceProvider, type FundamentalData, type MarketData, type NewsItem, type CalendarEvents, type AnalystData, type HistoricalBar } from './providers/index.js';
import { SECService, SECFilingInfo } from './SECService.js';
import { getCached, setCache, cacheKey } from './CacheService.js';
import type {
  ChecklistResult,
  ChecklistCategory,
  ChecklistItem,
  ChecklistStatus,
  NewsItem as NewsItemType,
  CalendarEvents as CalendarEventsType,
  AnalystData as AnalystDataType,
} from '../types/index.js';

interface VolumeAnalysis {
  medianVolume: number;        // Median daily volume (more robust than avg)
  recentElevatedDays: number;  // Days with volume > 5x median
  maxVolumeRatio: number;      // Highest volume ratio in period
  maxVolumeDate: string | null; // Date of highest volume
}

export class ChecklistService {
  private financeProvider: YahooFinanceProvider;
  private secService: SECService;

  constructor() {
    this.financeProvider = new YahooFinanceProvider();
    this.secService = new SECService();
  }

  async generateChecklist(symbol: string, skipCache = false): Promise<ChecklistResult> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first (unless skipping)
    if (!skipCache) {
      const cached = await getCached<ChecklistResult>(cacheKey('checklist', upperSymbol));
      // Auto-refresh if cached data is missing new fields (news, analystData, calendarEvents)
      if (cached && cached.news !== undefined) {
        return cached;
      }
    }

    const errors: string[] = [];
    let marketData: MarketData | null = null;
    let fundamentalData: FundamentalData | null = null;
    let daysBelow1Dollar: number | null = null;

    try {
      console.log(`[ChecklistService] Fetching stock data for ${upperSymbol}...`);
      const stockData = await this.financeProvider.getStockData(upperSymbol);
      marketData = stockData.marketData;
      fundamentalData = stockData.fundamentalData;
      console.log(`[ChecklistService] Stock data received for ${upperSymbol}`);
    } catch (error) {
      console.error(`[ChecklistService] Stock data error:`, error);
      // If main data fetch fails, return cached data if available
      const cached = await getCached<ChecklistResult>(cacheKey('checklist', upperSymbol));
      if (cached) {
        console.log(`[ChecklistService] Returning cached data due to fetch error`);
        return cached;
      }
      errors.push(`Stock data unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fetch historical data once for multiple uses (days below $1, volume analysis)
    let historicalBars: HistoricalBar[] = [];
    try {
      historicalBars = await this.financeProvider.getHistoricalData(upperSymbol, 90);
    } catch (error) {
      console.error(`[ChecklistService] Historical data error:`, error);
    }

    if (marketData && marketData.price < 5) {
      daysBelow1Dollar = this.calculateDaysBelow1Dollar(historicalBars);
    }

    const volumeAnalysis = this.analyzeHistoricalVolume(historicalBars);

    let secFilingInfo: SECFilingInfo | null = null;
    try {
      secFilingInfo = await this.secService.getFilingInfo(upperSymbol);
    } catch (error) {
      console.error(`[ChecklistService] SEC filing error:`, error);
      errors.push(`SEC filings unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fetch news, calendar events, and analyst data in parallel
    let news: NewsItemType[] = [];
    let calendarEvents: CalendarEventsType | null = null;
    let analystData: AnalystDataType | null = null;

    const [newsResult, calendarResult, analystResult] = await Promise.allSettled([
      this.financeProvider.getNews(upperSymbol, 5),
      this.financeProvider.getCalendarEvents(upperSymbol),
      this.financeProvider.getAnalystData(upperSymbol),
    ]);

    if (newsResult.status === 'fulfilled') {
      news = newsResult.value;
    }
    if (calendarResult.status === 'fulfilled') {
      calendarEvents = calendarResult.value;
    }
    if (analystResult.status === 'fulfilled') {
      analystData = analystResult.value;
    }

    const isBiotech = this.checkIfBiotech(marketData?.industry);

    const categories: ChecklistCategory[] = [
      this.buildVolumeAnalysis(marketData, volumeAnalysis),
      this.buildFundamentalsCategory(fundamentalData),
      this.buildPriceAnalysis(marketData, daysBelow1Dollar),
      this.buildRiskIndicators(secFilingInfo, marketData?.price ?? 0),
    ];

    const overallStatus = this.calculateOverallStatus(categories);

    // Generate logo URL using LogoKit (by stock ticker)
    const logoKitToken = process.env.LOGOKIT_TOKEN;
    const logoUrl = logoKitToken
      ? `https://img.logokit.com/ticker/${upperSymbol}?token=${logoKitToken}`
      : null;

    const result: ChecklistResult = {
      symbol: upperSymbol,
      companyName: marketData?.companyName || upperSymbol,
      industry: marketData?.industry || 'Unknown',
      isBiotech,
      price: marketData?.price || 0,
      marketCap: marketData?.marketCap || 0,
      logoUrl,
      categories,
      overallStatus,
      timestamp: new Date().toISOString(),
      errors,
      news,
      calendarEvents,
      analystData,
    };

    // Cache the result if no errors
    if (errors.length === 0) {
      await setCache(cacheKey('checklist', upperSymbol), result);
    }

    return result;
  }

  private checkIfBiotech(industry: string | null | undefined): boolean {
    if (!industry) return false;
    const industryLower = industry.toLowerCase();
    const biotechKeywords = ['biotech', 'pharmaceutical', 'drug', 'biopharmaceutical', 'life science'];
    return biotechKeywords.some(keyword => industryLower.includes(keyword));
  }

  private buildVolumeAnalysis(marketData: MarketData | null, volumeAnalysis: VolumeAnalysis): ChecklistCategory {
    const items: ChecklistItem[] = [];

    if (marketData && volumeAnalysis.medianVolume > 0) {
      const volumeRatio = marketData.volume / volumeAnalysis.medianVolume;
      items.push({
        id: 'volume_vs_median',
        label: 'Volume vs 90-Day Median',
        description: 'Current volume compared to typical daily volume. High spike may indicate ongoing pump.',
        value: volumeRatio,
        displayValue: `${volumeRatio.toFixed(1)}x`,
        status: this.getVolumeRatioStatus(volumeRatio),
        thresholds: {
          safe: '< 5x',
          warning: '5-20x',
          danger: '20x+',
        },
      });
    } else {
      items.push(this.createUnavailableItem('volume_vs_median', 'Volume vs 90-Day Median', 'Volume data unavailable'));
    }

    // Elevated volume days (5x+ avg) in past 60 days - indicates recent pump activity
    items.push({
      id: 'elevated_volume_days',
      label: 'Volume Spike Days (60d)',
      description: 'Days with volume >= 5x average. Multiple spike days may indicate prior pump activity.',
      value: volumeAnalysis.recentElevatedDays,
      displayValue: `${volumeAnalysis.recentElevatedDays} days`,
      status: this.getElevatedDaysStatus(volumeAnalysis.recentElevatedDays),
      thresholds: {
        safe: '0-1 days',
        warning: '2-4 days',
        danger: '5+ days',
      },
    });

    // Max volume spike info
    if (volumeAnalysis.maxVolumeRatio >= 5) {
      let spikeDescription = 'Largest single-day volume spike.';
      if (volumeAnalysis.maxVolumeDate) {
        const daysAgo = Math.floor((Date.now() - new Date(volumeAnalysis.maxVolumeDate).getTime()) / (1000 * 60 * 60 * 24));
        spikeDescription = daysAgo === 0 ? 'Peak volume was today.' : `Peak volume was ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago.`;
      }
      items.push({
        id: 'max_volume_spike',
        label: 'Biggest Spike (60d)',
        description: spikeDescription,
        value: volumeAnalysis.maxVolumeRatio,
        displayValue: `${volumeAnalysis.maxVolumeRatio.toFixed(1)}x`,
        status: this.getVolumeRatioStatus(volumeAnalysis.maxVolumeRatio),
        thresholds: {
          safe: '< 5x',
          warning: '5-20x',
          danger: '20x+',
        },
      });
    }

    if (marketData) {
      const changePercent = Math.abs(marketData.priceChangePercent);
      items.push({
        id: 'price_change',
        label: 'Daily Price Change',
        description: 'Large price spikes without news = potential pump.',
        value: marketData.priceChangePercent,
        displayValue: `${marketData.priceChangePercent >= 0 ? '+' : ''}${marketData.priceChangePercent.toFixed(2)}%`,
        status: this.getPriceChangeStatus(changePercent),
        thresholds: {
          safe: '0-20%',
          warning: '20-50%',
          danger: '50%+',
        },
      });
    } else {
      items.push(this.createUnavailableItem('price_change', 'Daily Price Change', 'Price data unavailable'));
    }

    return {
      id: 'volume_analysis',
      name: 'Volume Analysis',
      description: 'Unusual volume or price movement without news = potential pump & dump',
      items,
      status: this.getCategoryStatus(items),
    };
  }

  private buildFundamentalsCategory(fundamentalData: FundamentalData | null): ChecklistCategory {
    const items: ChecklistItem[] = [];

    const rawInsiderOwnership = fundamentalData?.insiderOwnership;
    const insiderOwnership = rawInsiderOwnership != null ? rawInsiderOwnership * 100 : null;

    if (insiderOwnership !== null) {
      items.push({
        id: 'insider_ownership',
        label: 'Insider Ownership',
        description: 'Higher insider ownership = management has skin in the game.',
        value: insiderOwnership,
        displayValue: `${insiderOwnership.toFixed(1)}%`,
        status: this.getInsiderOwnershipStatus(insiderOwnership),
        thresholds: {
          safe: '>20%',
          warning: '10-20%',
          danger: '<10%',
        },
      });
    } else {
      items.push(this.createUnavailableItem('insider_ownership', 'Insider Ownership', 'Data unavailable'));
    }

    const rawInstitutionalOwnership = fundamentalData?.institutionalOwnership;
    const institutionalOwnership = rawInstitutionalOwnership != null ? rawInstitutionalOwnership * 100 : null;

    if (institutionalOwnership !== null) {
      items.push({
        id: 'institutional_ownership',
        label: 'Institutional Ownership',
        description: 'Higher institutional backing = more credibility.',
        value: institutionalOwnership,
        displayValue: `${institutionalOwnership.toFixed(1)}%`,
        status: this.getInstitutionalOwnershipStatus(institutionalOwnership),
        thresholds: {
          safe: '>30%',
          warning: '10-30%',
          danger: '<10%',
        },
      });
    } else {
      items.push(this.createUnavailableItem('institutional_ownership', 'Institutional Ownership', 'Data unavailable'));
    }

    // Free Cash Flow
    if (fundamentalData?.freeCashFlow !== null && fundamentalData?.freeCashFlow !== undefined) {
      const fcf = fundamentalData.freeCashFlow;
      const isNegative = fcf < 0;
      const absFcf = Math.abs(fcf);
      const fcfDisplay = absFcf >= 1e9
        ? `${isNegative ? '-' : '+'}$${(absFcf / 1e9).toFixed(2)}B`
        : absFcf >= 1e6
          ? `${isNegative ? '-' : '+'}$${(absFcf / 1e6).toFixed(1)}M`
          : `${isNegative ? '-' : '+'}$${absFcf.toLocaleString()}`;

      items.push({
        id: 'free_cash_flow',
        label: 'Free Cash Flow',
        description: 'Annual cash generated (positive) or burned (negative).',
        value: fcf,
        displayValue: `${fcfDisplay}/yr`,
        status: this.getFreeCashFlowStatus(fcf),
        thresholds: {
          safe: 'Positive',
          warning: 'Slightly negative',
          danger: 'Burning cash',
        },
      });
    }

    // Cash Runway
    if (fundamentalData?.cashRunwayMonths !== null && fundamentalData?.cashRunwayMonths !== undefined) {
      items.push({
        id: 'cash_runway',
        label: 'Cash Runway',
        description: 'Months of cash remaining based on current burn rate.',
        value: fundamentalData.cashRunwayMonths,
        displayValue: `${fundamentalData.cashRunwayMonths.toFixed(0)} months`,
        status: this.getCashRunwayStatus(fundamentalData.cashRunwayMonths),
        thresholds: {
          safe: '>12 months',
          warning: '6-12 months',
          danger: '<6 months',
        },
      });
    } else if (fundamentalData?.freeCashFlow !== null && fundamentalData?.freeCashFlow !== undefined && fundamentalData.freeCashFlow >= 0) {
      items.push({
        id: 'cash_runway',
        label: 'Cash Runway',
        description: 'Company is generating cash, not burning it.',
        value: null,
        displayValue: 'N/A (FCF positive)',
        status: 'safe',
      });
    }

    // Total Cash
    if (fundamentalData?.totalCash !== null && fundamentalData?.totalCash !== undefined) {
      const cash = fundamentalData.totalCash;
      const displayValue = cash >= 1e9
        ? `$${(cash / 1e9).toFixed(2)}B`
        : cash >= 1e6
          ? `$${(cash / 1e6).toFixed(1)}M`
          : `$${cash.toLocaleString()}`;

      items.push({
        id: 'total_cash',
        label: 'Total Cash',
        description: 'Cash and equivalents on hand.',
        value: cash,
        displayValue,
        status: this.getTotalCashStatus(cash),
        thresholds: {
          safe: '>$50M',
          warning: '$10-50M',
          danger: '<$10M',
        },
      });
    }

    // R&D Spend / Revenue ratio
    if (fundamentalData?.researchDevelopment !== null && fundamentalData?.researchDevelopment !== undefined) {
      const rd = fundamentalData.researchDevelopment;
      const revenue = fundamentalData.totalRevenue;

      if (revenue && revenue > 0) {
        const rdRevenueRatio = (rd / revenue) * 100;
        items.push({
          id: 'rd_revenue_ratio',
          label: 'R&D / Revenue',
          description: 'R&D spending as percentage of revenue. High ratios may indicate unsustainable burn.',
          value: rdRevenueRatio,
          displayValue: `${rdRevenueRatio.toFixed(0)}%`,
          status: this.getRdRevenueStatus(rdRevenueRatio),
          thresholds: {
            safe: '<50%',
            warning: '50-100%',
            danger: '>100%',
          },
        });
      } else {
        const rdDisplay = rd >= 1e9
          ? `$${(rd / 1e9).toFixed(2)}B`
          : rd >= 1e6
            ? `$${(rd / 1e6).toFixed(1)}M`
            : `$${rd.toLocaleString()}`;

        items.push({
          id: 'rd_spend',
          label: 'R&D Spend (Annual)',
          description: 'Annual R&D expenditure. Pre-revenue company.',
          value: rd,
          displayValue: `${rdDisplay} (pre-revenue)`,
          status: 'safe',
        });
      }
    }

    return {
      id: 'fundamentals',
      name: 'Fundamentals',
      description: 'Ownership structure, cash position, and development stage',
      items,
      status: this.getCategoryStatus(items),
    };
  }

  private buildPriceAnalysis(
    marketData: MarketData | null,
    daysBelow1Dollar: number | null
  ): ChecklistCategory {
    const items: ChecklistItem[] = [];

    if (marketData) {
      items.push({
        id: 'price_level',
        label: 'Stock Price Level',
        description: 'Stocks below $1 face delisting risk.',
        value: marketData.price,
        displayValue: `$${marketData.price.toFixed(2)}`,
        status: this.getPriceLevelStatus(marketData.price),
        thresholds: {
          safe: '>$5',
          warning: '$1-$5',
          danger: '<$1',
        },
      });

      if (marketData.high52Week > 0 && marketData.low52Week > 0) {
        const range = marketData.high52Week - marketData.low52Week;
        const position = range > 0 ? ((marketData.price - marketData.low52Week) / range) * 100 : 50;
        items.push({
          id: '52_week_position',
          label: '52-Week Range Position',
          description: 'Where the stock trades within its 52-week range.',
          value: position,
          displayValue: `${position.toFixed(0)}% (L: $${marketData.low52Week.toFixed(2)}, H: $${marketData.high52Week.toFixed(2)})`,
          status: 'safe',
        });
      }
    } else {
      items.push(this.createUnavailableItem('price_level', 'Stock Price Level', 'Price data unavailable'));
    }

    if (daysBelow1Dollar !== null) {
      items.push({
        id: 'days_below_1',
        label: 'Consecutive Days Below $1',
        description: 'Nasdaq requires stocks to stay above $1. 30+ days = deficiency notice.',
        value: daysBelow1Dollar,
        displayValue: `${daysBelow1Dollar} days`,
        status: this.getDaysBelow1Status(daysBelow1Dollar),
        thresholds: {
          safe: '0 days',
          warning: '1-19 days',
          danger: '20+ days',
        },
      });
    }

    return {
      id: 'price_analysis',
      name: 'Price Analysis',
      description: 'Price level and delisting risk assessment',
      items,
      status: this.getCategoryStatus(items),
    };
  }

  private calculateDaysBelow1Dollar(bars: HistoricalBar[]): number {
    if (bars.length === 0) return 0;

    let consecutiveDays = 0;
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].close < 1) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    return consecutiveDays;
  }

  private analyzeHistoricalVolume(bars: HistoricalBar[]): VolumeAnalysis {
    const result: VolumeAnalysis = {
      medianVolume: 0,
      recentElevatedDays: 0,
      maxVolumeRatio: 0,
      maxVolumeDate: null,
    };

    if (bars.length === 0) return result;

    // Calculate median volume
    const volumes = bars.map(b => b.volume).sort((a, b) => a - b);
    const mid = Math.floor(volumes.length / 2);
    result.medianVolume = volumes.length % 2 === 0
      ? (volumes[mid - 1] + volumes[mid]) / 2
      : volumes[mid];

    if (result.medianVolume <= 0) return result;

    const elevatedThreshold = 5; // 5x median = warning level

    for (const bar of bars) {
      const ratio = bar.volume / result.medianVolume;
      if (ratio >= elevatedThreshold) {
        result.recentElevatedDays++;
      }
      if (ratio > result.maxVolumeRatio) {
        result.maxVolumeRatio = ratio;
        result.maxVolumeDate = bar.date;
      }
    }

    return result;
  }

  private buildRiskIndicators(secFilingInfo: SECFilingInfo | null, price: number): ChecklistCategory {
    const items: ChecklistItem[] = [];

    const hasRecentATM = secFilingInfo?.hasRecentATM ?? null;
    const atmFilingDate = secFilingInfo?.atmFilingDate;

    items.push({
      id: 'recent_atm',
      label: 'Recent ATM Offering',
      description: 'At-The-Market offerings (S-3 filings) dilute shareholders.',
      value: hasRecentATM,
      displayValue: hasRecentATM !== null
        ? (hasRecentATM ? `Yes${atmFilingDate ? ` (${atmFilingDate})` : ''}` : 'No')
        : 'Unknown',
      status: hasRecentATM === true ? 'warning' : (hasRecentATM === false ? 'safe' : 'unavailable'),
    });

    const hasRecentSplit = secFilingInfo?.hasPendingReverseSplit ?? null;
    const splitDate = secFilingInfo?.reverseSplitDate;
    // Only flag as reverse split (danger) if price is under $5 - high priced stocks do forward splits
    const isLikelyReverseSplit = hasRecentSplit && price < 5;

    items.push({
      id: 'pending_reverse_split',
      label: isLikelyReverseSplit ? 'Pending Reverse Split' : 'Recent Stock Split',
      description: isLikelyReverseSplit
        ? 'Reverse splits often signal desperation to maintain listing.'
        : 'Stock split detected (8-K Item 5.03). Forward splits are typically positive.',
      value: hasRecentSplit,
      displayValue: hasRecentSplit !== null
        ? (hasRecentSplit ? `Yes${splitDate ? ` (${splitDate})` : ''}` : 'No')
        : 'Unknown',
      status: isLikelyReverseSplit ? 'danger' : (hasRecentSplit === false ? 'safe' : 'safe'),
    });

    const hasNasdaqDeficiency = secFilingInfo?.hasNasdaqDeficiency ?? null;
    const deficiencyDate = secFilingInfo?.deficiencyDate;

    items.push({
      id: 'nasdaq_deficiency',
      label: 'Nasdaq Deficiency Notice',
      description: 'Company has received compliance warning (8-K Item 3.01) from Nasdaq.',
      value: hasNasdaqDeficiency,
      displayValue: hasNasdaqDeficiency !== null
        ? (hasNasdaqDeficiency ? `Yes${deficiencyDate ? ` (${deficiencyDate})` : ''}` : 'No')
        : 'Unknown',
      status: hasNasdaqDeficiency === true ? 'danger' : (hasNasdaqDeficiency === false ? 'safe' : 'unavailable'),
    });

    return {
      id: 'risk_indicators',
      name: 'Risk Indicators',
      description: 'Corporate actions and compliance status (auto-detected from SEC filings)',
      items,
      status: this.getCategoryStatus(items),
    };
  }

  private getVolumeRatioStatus(ratio: number): ChecklistStatus {
    if (ratio >= 20) return 'danger';
    if (ratio >= 5) return 'warning';
    return 'safe';
  }

  private getElevatedDaysStatus(days: number): ChecklistStatus {
    if (days >= 5) return 'danger';
    if (days >= 2) return 'warning';
    return 'safe';
  }

  private getPriceChangeStatus(changePercent: number): ChecklistStatus {
    if (changePercent >= 50) return 'danger';
    if (changePercent >= 20) return 'warning';
    return 'safe';
  }

  private getInsiderOwnershipStatus(percent: number): ChecklistStatus {
    if (percent < 10) return 'danger';
    if (percent < 20) return 'warning';
    return 'safe';
  }

  private getInstitutionalOwnershipStatus(percent: number): ChecklistStatus {
    if (percent < 10) return 'danger';
    if (percent < 30) return 'warning';
    return 'safe';
  }

  private getCashRunwayStatus(months: number): ChecklistStatus {
    if (months < 6) return 'danger';
    if (months < 12) return 'warning';
    return 'safe';
  }

  private getFreeCashFlowStatus(fcf: number): ChecklistStatus {
    if (fcf >= 0) return 'safe';
    const absFcf = Math.abs(fcf);
    if (absFcf > 500e6) return 'danger';
    if (absFcf > 100e6) return 'warning';
    return 'warning';
  }

  private getTotalCashStatus(cash: number): ChecklistStatus {
    if (cash < 10e6) return 'danger';
    if (cash < 50e6) return 'warning';
    return 'safe';
  }

  private getRdRevenueStatus(ratio: number): ChecklistStatus {
    if (ratio > 100) return 'danger';
    if (ratio > 50) return 'warning';
    return 'safe';
  }

  private getPriceLevelStatus(price: number): ChecklistStatus {
    if (price < 1) return 'danger';
    if (price < 5) return 'warning';
    return 'safe';
  }

  private getDaysBelow1Status(days: number): ChecklistStatus {
    if (days >= 20) return 'danger';
    if (days > 0) return 'warning';
    return 'safe';
  }

  private getCategoryStatus(items: ChecklistItem[]): ChecklistStatus {
    const statuses = items.map(i => i.status);
    if (statuses.includes('danger')) return 'danger';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.every(s => s === 'unavailable')) return 'unavailable';
    return 'safe';
  }

  private calculateOverallStatus(categories: ChecklistCategory[]): ChecklistStatus {
    const statuses = categories.map(c => c.status);
    if (statuses.includes('danger')) return 'danger';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.every(s => s === 'unavailable')) return 'unavailable';
    return 'safe';
  }

  private createUnavailableItem(id: string, label: string, description: string): ChecklistItem {
    return {
      id,
      label,
      description,
      value: null,
      displayValue: 'Unavailable',
      status: 'unavailable',
    };
  }
}
