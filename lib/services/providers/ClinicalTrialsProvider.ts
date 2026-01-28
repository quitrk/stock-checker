import type { CatalystEvent } from '../../types/index.js';

interface ClinicalTrialStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      officialTitle?: string;
      briefTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      primaryCompletionDateStruct?: { date?: string; type?: string };
      completionDateStruct?: { date?: string; type?: string };
    };
    designModule?: {
      phases?: string[];
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
  };
}

interface ClinicalTrialsResponse {
  studies?: ClinicalTrialStudy[];
  totalCount?: number;
}

/**
 * Provider for ClinicalTrials.gov API v2
 * Used to fetch clinical trial data for biotech stocks
 */
export class ClinicalTrialsProvider {
  private readonly baseUrl = 'https://clinicaltrials.gov/api/v2/studies';
  private readonly MIN_REQUEST_INTERVAL = 300; // 300ms between requests
  private lastRequestTime = 0;

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_REQUEST_INTERVAL) {
      await new Promise(r => setTimeout(r, this.MIN_REQUEST_INTERVAL - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Check if a stock's industry suggests it's biotech/pharma
   */
  static isBiotechIndustry(industry: string): boolean {
    const lowercaseIndustry = industry.toLowerCase();
    return (
      lowercaseIndustry.includes('biotech') ||
      lowercaseIndustry.includes('pharma') ||
      lowercaseIndustry.includes('drug') ||
      lowercaseIndustry.includes('therapeutics') ||
      lowercaseIndustry.includes('biolog') ||
      lowercaseIndustry.includes('healthcare') && lowercaseIndustry.includes('research')
    );
  }

  async getCatalystEvents(symbol: string, companyName: string): Promise<CatalystEvent[]> {
    const events: CatalystEvent[] = [];

    try {
      // Clean company name for search (remove Inc, Corp, etc.)
      const searchName = companyName
        .replace(/,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|LLC|PLC|Limited|Co\.?)$/i, '')
        .trim();

      const today = new Date().toISOString().split('T')[0];
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      // Two parallel requests:
      // 1. Active trials sorted by completion date (for upcoming)
      // 2. Completed trials sorted by completion date desc (for recent past)
      const activeParams = new URLSearchParams({
        'query.spons': searchName,
        'filter.overallStatus': 'RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION,NOT_YET_RECRUITING',
        'pageSize': '50',
        'sort': 'PrimaryCompletionDate:asc',
      });

      const completedParams = new URLSearchParams({
        'query.spons': searchName,
        'filter.overallStatus': 'COMPLETED',
        'pageSize': '30',
        'sort': 'PrimaryCompletionDate:desc',
      });

      await this.throttle();
      const [activeResponse, completedResponse] = await Promise.all([
        fetch(`${this.baseUrl}?${activeParams}`, { headers: { 'Accept': 'application/json' } }),
        fetch(`${this.baseUrl}?${completedParams}`, { headers: { 'Accept': 'application/json' } }),
      ]);

      const activeData = activeResponse.ok
        ? (await activeResponse.json()) as ClinicalTrialsResponse
        : { studies: [] };
      const completedData = completedResponse.ok
        ? (await completedResponse.json()) as ClinicalTrialsResponse
        : { studies: [] };

      // Process active trials (for upcoming)
      const upcoming: CatalystEvent[] = [];
      for (const study of activeData.studies || []) {
        const event = this.parseStudy(study, symbol);
        if (event && event.date >= today) {
          upcoming.push(event);
        }
      }

      // Process completed trials (for recent past)
      const past: CatalystEvent[] = [];
      for (const study of completedData.studies || []) {
        const event = this.parseStudy(study, symbol);
        if (event && event.date < today && event.date >= ninetyDaysAgoStr) {
          past.push(event);
        }
      }

      // Sort and limit: 20 soonest upcoming + 20 most recent past
      upcoming.sort((a, b) => a.date.localeCompare(b.date));
      past.sort((a, b) => b.date.localeCompare(a.date));

      events.push(...upcoming.slice(0, 20));
      events.push(...past.slice(0, 20));

      // Final sort by date
      events.sort((a, b) => a.date.localeCompare(b.date));
      return events;
    } catch (error) {
      console.error(`[ClinicalTrials] Error fetching trials for ${symbol}:`, error);
      return events;
    }
  }

  private parseStudy(study: ClinicalTrialStudy, symbol: string): CatalystEvent | null {
    const protocol = study.protocolSection;
    if (!protocol) return null;

    const nctId = protocol.identificationModule?.nctId;
    const title = protocol.identificationModule?.briefTitle || protocol.identificationModule?.officialTitle;
    const phases = protocol.designModule?.phases || [];
    const primaryCompletion = protocol.statusModule?.primaryCompletionDateStruct;
    const studyCompletion = protocol.statusModule?.completionDateStruct;

    // Skip if no phase info
    if (phases.length === 0) return null;

    // Use primary completion date if available, otherwise study completion
    const completionDate = primaryCompletion?.date || studyCompletion?.date;
    if (!completionDate) return null;

    // Parse the date (format: "2024-06" or "2024-06-15")
    const dateParts = completionDate.split('-');
    const formattedDate = dateParts.length === 2
      ? `${completionDate}-01`
      : completionDate;

    const phaseStr = phases.map(p => p.replace('PHASE', 'Phase ')).join('/');
    const isEstimate = primaryCompletion?.type === 'ESTIMATED' || studyCompletion?.type === 'ESTIMATED';

    return {
      id: `ct-${symbol}-${nctId}`,
      symbol,
      eventType: 'clinical_trial',
      date: formattedDate,
      isEstimate,
      title: `${phaseStr} Trial Completion`,
      description: title,
      source: 'clinicaltrials',
      sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
      trialPhases: phases,
    };
  }
}
