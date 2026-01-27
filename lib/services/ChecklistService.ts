import { yahooFinance, type FundamentalData, type MarketData, type HistoricalBar, type ShortInterestData } from './providers/index.js';
import { SECService, SECFilingInfo } from './SECService.js';
import { CatalystService } from './CatalystService.js';
import { FDAProvider, type FDADecision } from './providers/FDAProvider.js';
import { setCache, cacheKey } from './CacheService.js';
import type {
  ChecklistResult,
  ChecklistCategory,
  ChecklistItem,
  ChecklistStatus,
  NewsItem as NewsItemType,
  CatalystEvent,
  AnalystData as AnalystDataType,
  EarningsPerformance,
  FDAHistory,
} from '../types/index.js';

interface VolumeAnalysis {
  medianVolume: number;        // Median daily volume (more robust than avg)
  recentElevatedDays: number;  // Days with volume > 5x median
  maxVolumeRatio: number;      // Highest volume ratio in period
  maxVolumeDate: string | null; // Date of highest volume
}

export class ChecklistService {
  private secService: SECService;
  private catalystService: CatalystService;
  private fdaProvider: FDAProvider;

  constructor() {
    this.secService = new SECService();
    // Share providers with CatalystService to reuse cached data
    this.catalystService = new CatalystService(yahooFinance, this.secService);
    this.fdaProvider = new FDAProvider();
  }

  async generateChecklist(symbol: string, options: { skipCache?: boolean; ttl?: number } = {}): Promise<ChecklistResult> {
    const { ttl } = options;
    const upperSymbol = symbol.toUpperCase();
    // Cache disabled for symbol lookups - always fetch fresh data

    const errors: string[] = [];
    let marketData: MarketData | null = null;
    let fundamentalData: FundamentalData | null = null;
    let shortInterestData: ShortInterestData | null = null;
    let daysBelow1Dollar: number | null = null;

    try {
      console.log(`[ChecklistService] Fetching stock data for ${upperSymbol}...`);
      const stockData = await yahooFinance.getStockData(upperSymbol);
      marketData = stockData.marketData;
      fundamentalData = stockData.fundamentalData;
      shortInterestData = stockData.shortInterestData;
      console.log(`[ChecklistService] Stock data received for ${upperSymbol}`);
    } catch (error) {
      console.error(`[ChecklistService] Stock data error:`, error);
      errors.push(`Stock data unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    let secFilingInfo: SECFilingInfo | null = null;
    try {
      secFilingInfo = await this.secService.getFilingInfo(upperSymbol);
    } catch (error) {
      console.error(`[ChecklistService] SEC filing error:`, error);
      errors.push(`SEC filings unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fetch news, catalyst events, analyst data, and earnings history in parallel
    let news: NewsItemType[] = [];
    let catalystEvents: CatalystEvent[] = [];
    let analystData: AnalystDataType | null = null;

    const companyName = marketData?.companyName || upperSymbol;
    const industry = marketData?.industry || 'Unknown';

    const [newsResult, catalystResult, analystResult, earningsHistoryResult] = await Promise.allSettled([
      yahooFinance.getNews(upperSymbol, 5),
      this.catalystService.getCatalystEvents(upperSymbol, companyName, industry),
      yahooFinance.getAnalystData(upperSymbol),
      yahooFinance.getEarningsHistory(upperSymbol),
    ]);

    // Calculate how many days of historical data we need
    let daysNeeded = 90; // minimum for volume analysis
    if (earningsHistoryResult.status === 'fulfilled' && earningsHistoryResult.value.length > 0) {
      const oldestEarningsDate = earningsHistoryResult.value[0]?.date;
      if (oldestEarningsDate) {
        const daysSinceOldest = Math.ceil(
          (Date.now() - new Date(oldestEarningsDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        daysNeeded = Math.max(daysNeeded, daysSinceOldest + 30);
      }
    }

    // Fetch historical data once with enough days for all uses
    let historicalBars: HistoricalBar[] = [];
    try {
      historicalBars = await yahooFinance.getHistoricalData(upperSymbol, daysNeeded);
    } catch (error) {
      console.error(`[ChecklistService] Historical data error:`, error);
    }

    if (marketData && marketData.price < 5) {
      daysBelow1Dollar = this.calculateDaysBelow1Dollar(historicalBars);
    }

    const volumeAnalysis = this.analyzeHistoricalVolume(historicalBars);

    if (newsResult.status === 'fulfilled') {
      news = newsResult.value;
    }
    if (catalystResult.status === 'fulfilled') {
      catalystEvents = catalystResult.value;
    }
    if (analystResult.status === 'fulfilled') {
      analystData = analystResult.value;
      if (analystData) {
        const parts: string[] = [];
        if (analystData.recommendationKey) {
          parts.push(analystData.recommendationKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
        }
        if (analystData.targetPrice) {
          parts.push(`$${analystData.targetPrice.toFixed(0)} target`);
        }
        if (parts.length > 0) {
          analystData.summary = parts.join(' · ');
        }
      }
    }

    // Build earnings performance data
    const earningsPerformance = earningsHistoryResult.status === 'fulfilled'
      ? this.buildEarningsPerformance(earningsHistoryResult.value, historicalBars)
      : null;

    // Add performance history to earnings catalyst events
    if (earningsPerformance) {
      this.attachEarningsToEvents(catalystEvents, earningsPerformance);
    }

    // Fetch FDA history for biotech companies
    let fdaHistory: FDAHistory | null = null;
    let fdaCategory: ChecklistCategory | null = null;
    const isBiotech = industry.toLowerCase().includes('biotech') ||
                      industry.toLowerCase().includes('pharma') ||
                      industry.toLowerCase().includes('drug');
    if (isBiotech) {
      try {
        const fdaDecisions = await this.fdaProvider.getFDAHistory(companyName);
        if (fdaDecisions.length > 0) {
          const totalApproved = fdaDecisions.filter(d => d.approved).length;
          const totalRejected = fdaDecisions.filter(d => !d.approved).length;
          const totalPriority = fdaDecisions.filter(d => d.reviewPriority === 'PRIORITY').length;
          const recentDecisions = fdaDecisions.slice(0, 5).map(decision => ({
            date: decision.date,
            approved: decision.approved,
            drugName: decision.drugName,
            reviewPriority: decision.reviewPriority,
            url: decision.url,
          }));
          fdaHistory = { totalApproved, totalRejected, totalPriority, recentDecisions };
          fdaCategory = this.buildFDATrackRecord(totalApproved, totalRejected, totalPriority);
        }
      } catch (error) {
        console.error(`[ChecklistService] FDA history error:`, error);
      }
    }

    const categories: ChecklistCategory[] = [
      this.buildVolumeAnalysis(marketData, volumeAnalysis),
      this.buildPriceAnalysis(marketData, daysBelow1Dollar),
      this.buildShortInterestCategory(shortInterestData),
      this.buildFundamentalsCategory(fundamentalData),
      this.buildRiskIndicators(secFilingInfo, marketData?.price ?? 0),
      ...(fdaCategory ? [fdaCategory] : []),
    ];

    const overallStatus = this.calculateOverallStatus(categories);

    // Generate logo URL - use proxy endpoint to avoid Cloudflare blocking
    const logoKitToken = process.env.LOGOKIT_TOKEN;
    const logoUrl = logoKitToken ? `/api/logo/${upperSymbol}` : null;

    const result: ChecklistResult = {
      symbol: upperSymbol,
      companyName: marketData?.companyName || upperSymbol,
      industry: marketData?.industry || 'Unknown',
      price: marketData?.price || 0,
      priceChange: marketData?.priceChange || 0,
      priceChangePercent: marketData?.priceChangePercent || 0,
      marketCap: marketData?.marketCap || 0,
      logoUrl,
      categories,
      overallStatus,
      timestamp: new Date().toISOString(),
      errors,
      news,
      newsSummary: news.length > 0 ? news[0].title : undefined,
      catalystEvents,
      analystData,
      shortInterestData,
      earningsPerformance,
      fdaHistory,
    };

    // Cache the result if no errors
    if (errors.length === 0) {
      await setCache(cacheKey('checklist', upperSymbol), result, ttl);
    }

    return result;
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
      summaryItemId: 'volume_vs_median',
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
        description: 'Percentage of shares held by company insiders.',
        value: insiderOwnership,
        displayValue: `${insiderOwnership.toFixed(1)}%`,
        status: 'safe',
      });
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
      summaryItemId: 'cash_runway',
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
          safe: '>$2',
          warning: '$1-$2',
          danger: '<$1',
        },
      });

      if (marketData.high52Week > 0 && marketData.low52Week > 0) {
        const range = marketData.high52Week - marketData.low52Week;
        const position = range > 0 ? ((marketData.price - marketData.low52Week) / range) * 100 : 50;
        items.push({
          id: '52_week_position',
          label: '52-Week Range Position',
          description: `Where the stock trades within its 52-week range (L: $${marketData.low52Week.toFixed(2)}, H: $${marketData.high52Week.toFixed(2)}).`,
          value: position,
          displayValue: `${position.toFixed(0)}% (52w)`,
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
      summaryItemId: '52_week_position',
    };
  }

  private buildShortInterestCategory(shortInterestData: ShortInterestData | null): ChecklistCategory {
    const items: ChecklistItem[] = [];

    // Calculate squeeze potential score (0-100)
    const squeezeScore = this.calculateSqueezeScore(shortInterestData);

    items.push({
      id: 'squeeze_score',
      label: 'Squeeze Score',
      description: 'Combined score based on short %, days to cover, and trend. Higher = shorts more vulnerable.',
      value: squeezeScore,
      displayValue: `${squeezeScore}%`,
      status: this.getSqueezeStatus(squeezeScore),
    });

    // Short % of Float (informational)
    if (shortInterestData?.shortPercentOfFloat != null) {
      const shortPercent = shortInterestData.shortPercentOfFloat * 100;
      items.push({
        id: 'short_percent_float',
        label: 'Short % of Float',
        description: 'Percentage of tradeable shares currently shorted.',
        value: shortPercent,
        displayValue: `${shortPercent.toFixed(1)}%`,
        status: 'safe',
      });
    }

    // Days to Cover (informational)
    if (shortInterestData?.shortRatio != null) {
      items.push({
        id: 'days_to_cover',
        label: 'Days to Cover',
        description: 'Days needed to cover all shorts based on avg volume.',
        value: shortInterestData.shortRatio,
        displayValue: `${shortInterestData.shortRatio.toFixed(1)} days`,
        status: 'safe',
      });
    }

    // Short Interest Trend (informational)
    if (shortInterestData?.sharesShort != null && shortInterestData?.sharesShortPriorMonth != null) {
      const current = shortInterestData.sharesShort;
      const prior = shortInterestData.sharesShortPriorMonth;
      const changePercent = prior > 0 ? ((current - prior) / prior) * 100 : 0;
      const isIncreasing = changePercent > 0;

      items.push({
        id: 'short_interest_trend',
        label: 'Short Interest Trend',
        description: 'Month-over-month change in shares shorted.',
        value: changePercent,
        displayValue: `${isIncreasing ? '+' : ''}${changePercent.toFixed(1)}%`,
        status: 'safe',
      });
    }

    // Data date for context
    if (shortInterestData?.dateShortInterest) {
      items.push({
        id: 'short_data_date',
        label: 'Data As Of',
        description: 'Short interest data is reported bi-monthly with a delay.',
        value: shortInterestData.dateShortInterest,
        displayValue: shortInterestData.dateShortInterest,
        status: 'safe',
      });
    }

    return {
      id: 'short_interest',
      name: 'Short Interest',
      description: 'Short selling activity and squeeze potential',
      items,
      status: this.getSqueezeStatus(squeezeScore),
      summaryItemId: 'squeeze_score',
    };
  }

  private calculateSqueezeScore(data: ShortInterestData | null): number {
    if (!data) return 0;

    let score = 0;

    // Short % of float: 0-40 points
    // 0% = 0pts, 10% = 20pts, 20% = 35pts, 30%+ = 40pts
    if (data.shortPercentOfFloat != null) {
      const shortPct = data.shortPercentOfFloat * 100;
      if (shortPct >= 30) score += 40;
      else if (shortPct >= 20) score += 35;
      else if (shortPct >= 15) score += 28;
      else if (shortPct >= 10) score += 20;
      else if (shortPct >= 5) score += 10;
      else score += Math.floor(shortPct * 2);
    }

    // Days to cover: 0-35 points
    // <2 days = 0pts, 3-5 days = 15pts, 5-7 days = 25pts, 7+ days = 35pts
    if (data.shortRatio != null) {
      const dtc = data.shortRatio;
      if (dtc >= 10) score += 35;
      else if (dtc >= 7) score += 30;
      else if (dtc >= 5) score += 25;
      else if (dtc >= 3) score += 15;
      else if (dtc >= 2) score += 8;
      else score += Math.floor(dtc * 4);
    }

    // Short interest trend: 0-25 points
    // Decreasing = 0pts, flat = 5pts, +10% = 15pts, +20%+ = 25pts
    if (data.sharesShort != null && data.sharesShortPriorMonth != null && data.sharesShortPriorMonth > 0) {
      const changePct = ((data.sharesShort - data.sharesShortPriorMonth) / data.sharesShortPriorMonth) * 100;
      if (changePct >= 20) score += 25;
      else if (changePct >= 10) score += 18;
      else if (changePct >= 5) score += 12;
      else if (changePct > 0) score += 5;
      // Decreasing adds nothing
    }

    return Math.min(100, score);
  }

  private getSqueezeStatus(score: number): ChecklistStatus {
    // Warning = pay attention, volatility likely (not "danger")
    if (score >= 26) return 'warning';
    return 'safe';
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
      id: 'dilution_compliance',
      name: 'Dilution & Compliance',
      description: 'Corporate actions and compliance status (auto-detected from SEC filings)',
      items,
      status: this.getCategoryStatus(items),
    };
  }

  private buildFDATrackRecord(totalApproved: number, totalRejected: number, totalPriority: number): ChecklistCategory {
    const items: ChecklistItem[] = [];
    const total = totalApproved + totalRejected;
    const approvalRate = total > 0 ? Math.round((totalApproved / total) * 100) : 0;
    const priorityRate = total > 0 ? Math.round((totalPriority / total) * 100) : 0;

    items.push({
      id: 'fda_approval_rate',
      label: 'Approval Rate',
      description: 'Historical FDA approval success rate for this company.',
      value: approvalRate,
      displayValue: `${approvalRate}%`,
      status: this.getFDAApprovalStatus(approvalRate),
      thresholds: {
        safe: '≥80%',
        warning: '50-79%',
        danger: '<50%',
      },
    });

    items.push({
      id: 'fda_total_approved',
      label: 'Total Approved',
      description: 'Number of FDA-approved drugs/therapies.',
      value: totalApproved,
      displayValue: `${totalApproved}`,
      status: 'safe',
    });

    items.push({
      id: 'fda_total_rejected',
      label: 'Total Rejected',
      description: 'Number of FDA rejections (CRLs, refusals).',
      value: totalRejected,
      displayValue: `${totalRejected}`,
      status: totalRejected > totalApproved ? 'danger' : totalRejected > 0 ? 'warning' : 'safe',
    });

    items.push({
      id: 'fda_priority_rate',
      label: 'Priority Review Rate',
      description: 'Percentage of submissions granted priority review status.',
      value: priorityRate,
      displayValue: `${priorityRate}%`,
      status: 'safe',
    });

    return {
      id: 'fda_track_record',
      name: 'FDA Track Record',
      description: 'Historical FDA approval history and success rate',
      items,
      status: this.getCategoryStatus(items),
      summaryItemId: 'fda_approval_rate',
    };
  }

  private getFDAApprovalStatus(rate: number): ChecklistStatus {
    if (rate >= 80) return 'safe';
    if (rate >= 50) return 'warning';
    return 'danger';
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
    if (price < 2) return 'warning';
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

  private calculatePriceMovement(date: string, bars: HistoricalBar[]): number | null {
    if (bars.length === 0 || !date) return null;

    const idx = bars.findIndex(b => b.date >= date);
    if (idx < 0 || idx >= bars.length - 1) return null;

    const priceOnDay = bars[idx]?.close;
    const priceAfter = bars[idx + 1]?.close;

    if (!priceOnDay || !priceAfter) return null;
    return ((priceAfter - priceOnDay) / priceOnDay) * 100;
  }

  private buildEarningsPerformance(
    earningsHistory: { date: string; epsActual: number | null; epsEstimate: number | null; surprisePercent: number | null; priceMovement: number | null }[],
    bars: HistoricalBar[]
  ): EarningsPerformance | null {
    if (earningsHistory.length === 0) return null;

    const history = earningsHistory.map(h => ({
      ...h,
      priceMovement: this.calculatePriceMovement(h.date, bars),
    }));

    const withSurprise = history.filter(h => h.surprisePercent !== null);
    const beatCount = withSurprise.filter(h => (h.surprisePercent ?? 0) > 0).length;
    const withPriceMove = history.filter(h => h.priceMovement !== null);
    const avgPriceMove = withPriceMove.length > 0
      ? withPriceMove.reduce((sum, h) => sum + (h.priceMovement ?? 0), 0) / withPriceMove.length
      : null;
    const lastPriceMove = history[history.length - 1]?.priceMovement ?? null;

    return {
      history: history.map(h => ({
        date: h.date,
        epsActual: h.epsActual,
        epsEstimate: h.epsEstimate,
        surprisePercent: h.surprisePercent,
        priceMovement: h.priceMovement,
      })),
      beatCount,
      totalCount: withSurprise.length,
      avgPriceMove,
      lastPriceMove,
    };
  }

  private attachEarningsToEvents(events: CatalystEvent[], performance: EarningsPerformance): void {
    for (const event of events) {
      if (event.eventType === 'earnings' || event.eventType === 'earnings_call') {
        event.earningsHistory = performance.history.slice(-3).map(h => ({
          date: h.date,
          beat: h.surprisePercent !== null ? h.surprisePercent > 0 : null,
          priceMove: h.priceMovement,
        }));
      }
    }
  }

}
