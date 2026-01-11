import { YahooFinanceProvider, type FundamentalData, type MarketData } from './providers/index.js';
import { SECService, SECFilingInfo } from './SECService.js';
import type {
  ChecklistResult,
  ChecklistCategory,
  ChecklistItem,
  ChecklistStatus,
  ManualChecklistInput,
} from '../types/index.js';

export class ChecklistService {
  private financeProvider: YahooFinanceProvider;
  private secService: SECService;

  constructor() {
    this.financeProvider = new YahooFinanceProvider();
    this.secService = new SECService();
  }

  async generateChecklist(
    symbol: string,
    manualInput?: ManualChecklistInput
  ): Promise<ChecklistResult> {
    const errors: string[] = [];
    let marketData: MarketData | null = null;
    let fundamentalData: FundamentalData | null = null;
    let daysBelow1Dollar: number | null = null;

    try {
      console.log(`[ChecklistService] Fetching stock data for ${symbol}...`);
      const stockData = await this.financeProvider.getStockData(symbol);
      marketData = stockData.marketData;
      fundamentalData = stockData.fundamentalData;
      console.log(`[ChecklistService] Stock data received for ${symbol}`);
    } catch (error) {
      console.error(`[ChecklistService] Stock data error:`, error);
      errors.push(`Stock data unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (marketData && marketData.price < 5) {
      try {
        daysBelow1Dollar = await this.calculateDaysBelow1Dollar(symbol);
      } catch (error) {
        console.error(`[ChecklistService] Days below $1 calculation error:`, error);
      }
    }

    let secFilingInfo: SECFilingInfo | null = null;
    try {
      secFilingInfo = await this.secService.getFilingInfo(symbol);
    } catch (error) {
      console.error(`[ChecklistService] SEC filing error:`, error);
      errors.push(`SEC filings unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const isBiotech = this.checkIfBiotech(marketData?.industry);

    const categories: ChecklistCategory[] = [
      this.buildVolumeAnalysis(marketData),
      this.buildFundamentalsCategory(fundamentalData, manualInput),
      this.buildPriceAnalysis(marketData, daysBelow1Dollar, manualInput),
      this.buildRiskIndicators(secFilingInfo, manualInput),
    ];

    const overallStatus = this.calculateOverallStatus(categories);

    return {
      symbol: symbol.toUpperCase(),
      companyName: marketData?.companyName || symbol.toUpperCase(),
      industry: marketData?.industry || 'Unknown',
      isBiotech,
      price: marketData?.price || 0,
      marketCap: marketData?.marketCap || 0,
      categories,
      overallStatus,
      timestamp: new Date().toISOString(),
      errors,
    };
  }

  private checkIfBiotech(industry: string | null | undefined): boolean {
    if (!industry) return false;
    const industryLower = industry.toLowerCase();
    const biotechKeywords = ['biotech', 'pharmaceutical', 'drug', 'biopharmaceutical', 'life science'];
    return biotechKeywords.some(keyword => industryLower.includes(keyword));
  }

  private buildVolumeAnalysis(marketData: MarketData | null): ChecklistCategory {
    const items: ChecklistItem[] = [];

    if (marketData && marketData.avgVolume10Day > 0) {
      const volumeRatio10 = marketData.volume / marketData.avgVolume10Day;
      items.push({
        id: 'volume_ratio_10d',
        label: 'Volume vs 10-Day Avg',
        description: 'Compare current volume to 10-day average. High spikes without news = red flag.',
        value: volumeRatio10,
        displayValue: `${volumeRatio10.toFixed(1)}x`,
        status: this.getVolumeRatioStatus(volumeRatio10),
        thresholds: {
          safe: '1-3x',
          warning: '5-10x',
          danger: '20x+',
        },
        isManual: false,
      });
    } else {
      items.push(this.createUnavailableItem('volume_ratio_10d', 'Volume vs 10-Day Avg', 'Volume data unavailable'));
    }

    if (marketData && marketData.avgVolume90Day > 0) {
      const volumeRatio90 = marketData.volume / marketData.avgVolume90Day;
      items.push({
        id: 'volume_ratio_90d',
        label: 'Volume vs 90-Day Avg',
        description: 'Compare current volume to 90-day average. Sustained high volume = increased interest.',
        value: volumeRatio90,
        displayValue: `${volumeRatio90.toFixed(1)}x`,
        status: this.getVolumeRatioStatus(volumeRatio90),
        thresholds: {
          safe: '1-3x',
          warning: '5-10x',
          danger: '20x+',
        },
        isManual: false,
      });
    } else {
      items.push(this.createUnavailableItem('volume_ratio_90d', 'Volume vs 90-Day Avg', 'Volume data unavailable'));
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
        isManual: false,
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

  private buildFundamentalsCategory(
    fundamentalData: FundamentalData | null,
    manualInput?: ManualChecklistInput
  ): ChecklistCategory {
    const items: ChecklistItem[] = [];

    const rawInsiderOwnership = fundamentalData?.insiderOwnership;
    const insiderOwnership = manualInput?.insiderOwnership ??
      (rawInsiderOwnership != null ? rawInsiderOwnership * 100 : null);

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
        isManual: manualInput?.insiderOwnership !== undefined,
      });
    } else {
      items.push(this.createManualItem('insider_ownership', 'Insider Ownership', 'Data unavailable'));
    }

    const rawInstitutionalOwnership = fundamentalData?.institutionalOwnership;
    const institutionalOwnership = manualInput?.institutionalOwnership ??
      (rawInstitutionalOwnership != null ? rawInstitutionalOwnership * 100 : null);

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
        isManual: manualInput?.institutionalOwnership !== undefined,
      });
    } else {
      items.push(this.createManualItem('institutional_ownership', 'Institutional Ownership', 'Data unavailable'));
    }

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
        isManual: false,
      });
    } else if (fundamentalData?.totalCash !== null && fundamentalData?.totalCash !== undefined) {
      const cash = fundamentalData.totalCash;
      const displayValue = cash >= 1e9
        ? `$${(cash / 1e9).toFixed(2)}B`
        : cash >= 1e6
          ? `$${(cash / 1e6).toFixed(1)}M`
          : `$${cash.toLocaleString()}`;

      const cashStatus: ChecklistStatus = cash < 10e6 ? 'danger' : cash < 50e6 ? 'warning' : 'safe';

      items.push({
        id: 'cash_runway',
        label: 'Cash Position',
        description: 'Total cash on hand (burn rate unknown).',
        value: cash,
        displayValue,
        status: cashStatus,
        thresholds: {
          safe: '>$50M',
          warning: '$10-50M',
          danger: '<$10M',
        },
        isManual: false,
      });
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
    calculatedDaysBelow1: number | null,
    manualInput?: ManualChecklistInput
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
        isManual: false,
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
          isManual: false,
        });
      }
    } else {
      items.push(this.createUnavailableItem('price_level', 'Stock Price Level', 'Price data unavailable'));
    }

    const daysBelow1 = manualInput?.daysBelow1Dollar ?? calculatedDaysBelow1;

    if (daysBelow1 !== null && daysBelow1 !== undefined) {
      items.push({
        id: 'days_below_1',
        label: 'Consecutive Days Below $1',
        description: 'Nasdaq requires stocks to stay above $1. 30+ days = deficiency notice.',
        value: daysBelow1,
        displayValue: `${daysBelow1} days`,
        status: this.getDaysBelow1Status(daysBelow1),
        thresholds: {
          safe: '0 days',
          warning: '1-19 days',
          danger: '20+ days',
        },
        isManual: manualInput?.daysBelow1Dollar !== undefined,
      });
    } else if (marketData && marketData.price < 1) {
      items.push(this.createManualItem('days_below_1', 'Days Trading Below $1', 'Could not calculate from history'));
    }

    return {
      id: 'price_analysis',
      name: 'Price Analysis',
      description: 'Price level and delisting risk assessment',
      items,
      status: this.getCategoryStatus(items),
    };
  }

  private async calculateDaysBelow1Dollar(symbol: string): Promise<number> {
    const bars = await this.financeProvider.getHistoricalData(symbol, 60);

    if (bars.length === 0) return 0;

    let consecutiveDays = 0;
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].close < 1) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    console.log(`[ChecklistService] ${symbol}: ${consecutiveDays} consecutive days below $1`);
    return consecutiveDays;
  }

  private buildRiskIndicators(
    secFilingInfo: SECFilingInfo | null,
    manualInput?: ManualChecklistInput
  ): ChecklistCategory {
    const items: ChecklistItem[] = [];

    const hasRecentATM = manualInput?.hasRecentATM ?? secFilingInfo?.hasRecentATM ?? null;
    const atmFilingDate = secFilingInfo?.atmFilingDate;
    const isATMFromSEC = manualInput?.hasRecentATM === undefined && secFilingInfo?.hasRecentATM !== undefined;

    items.push({
      id: 'recent_atm',
      label: 'Recent ATM Offering',
      description: 'At-The-Market offerings (S-3 filings) dilute shareholders.',
      value: hasRecentATM,
      displayValue: hasRecentATM !== null
        ? (hasRecentATM
            ? `Yes${atmFilingDate ? ` (${atmFilingDate})` : ''}`
            : 'No')
        : 'Not specified',
      status: hasRecentATM === true ? 'warning' : (hasRecentATM === false ? 'safe' : 'manual'),
      isManual: !isATMFromSEC,
    });

    const hasPendingReverseSplit = manualInput?.hasPendingReverseSplit ?? secFilingInfo?.hasPendingReverseSplit ?? null;
    const reverseSplitDate = secFilingInfo?.reverseSplitDate;
    const isReverseSplitFromSEC = manualInput?.hasPendingReverseSplit === undefined && secFilingInfo?.hasPendingReverseSplit !== undefined;

    items.push({
      id: 'pending_reverse_split',
      label: 'Pending Reverse Split',
      description: 'Reverse splits (8-K Item 5.03) often signal desperation to maintain listing.',
      value: hasPendingReverseSplit,
      displayValue: hasPendingReverseSplit !== null
        ? (hasPendingReverseSplit
            ? `Yes${reverseSplitDate ? ` (${reverseSplitDate})` : ''}`
            : 'No')
        : 'Not specified',
      status: hasPendingReverseSplit === true ? 'danger' : (hasPendingReverseSplit === false ? 'safe' : 'manual'),
      isManual: !isReverseSplitFromSEC,
    });

    const hasNasdaqDeficiency = manualInput?.hasNasdaqDeficiency ?? secFilingInfo?.hasNasdaqDeficiency ?? null;
    const deficiencyDate = secFilingInfo?.deficiencyDate;
    const isDeficiencyFromSEC = manualInput?.hasNasdaqDeficiency === undefined && secFilingInfo?.hasNasdaqDeficiency !== undefined;

    items.push({
      id: 'nasdaq_deficiency',
      label: 'Nasdaq Deficiency Notice',
      description: 'Company has received compliance warning (8-K Item 3.01) from Nasdaq.',
      value: hasNasdaqDeficiency,
      displayValue: hasNasdaqDeficiency !== null
        ? (hasNasdaqDeficiency
            ? `Yes${deficiencyDate ? ` (${deficiencyDate})` : ''}`
            : 'No')
        : 'Not specified',
      status: hasNasdaqDeficiency === true ? 'danger' : (hasNasdaqDeficiency === false ? 'safe' : 'manual'),
      isManual: !isDeficiencyFromSEC,
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
    if (statuses.every(s => s === 'manual' || s === 'unavailable')) return 'manual';
    return 'safe';
  }

  private calculateOverallStatus(categories: ChecklistCategory[]): ChecklistStatus {
    const statuses = categories.map(c => c.status);
    if (statuses.includes('danger')) return 'danger';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.every(s => s === 'manual' || s === 'unavailable')) return 'manual';
    return 'safe';
  }

  private createManualItem(id: string, label: string, description: string): ChecklistItem {
    return {
      id,
      label,
      description,
      value: null,
      displayValue: 'Enter value',
      status: 'manual',
      isManual: true,
    };
  }

  private createUnavailableItem(id: string, label: string, description: string): ChecklistItem {
    return {
      id,
      label,
      description,
      value: null,
      displayValue: 'Unavailable',
      status: 'unavailable',
      isManual: false,
    };
  }
}
