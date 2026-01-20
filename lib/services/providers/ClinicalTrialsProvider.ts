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

      console.log(`[ClinicalTrials] Searching trials for "${searchName}"`);

      const params = new URLSearchParams({
        'query.spons': searchName,
        'filter.overallStatus': 'RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION',
        'pageSize': '20',
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.error(`[ClinicalTrials] API error: ${response.status}`);
        return events;
      }

      const data = (await response.json()) as ClinicalTrialsResponse;
      const studies = data.studies || [];

      console.log(`[ClinicalTrials] Found ${studies.length} active trials for ${searchName}`);

      for (const study of studies) {
        const protocol = study.protocolSection;
        if (!protocol) continue;

        const nctId = protocol.identificationModule?.nctId;
        const title = protocol.identificationModule?.briefTitle || protocol.identificationModule?.officialTitle;
        const status = protocol.statusModule?.overallStatus;
        const phases = protocol.designModule?.phases || [];
        const primaryCompletion = protocol.statusModule?.primaryCompletionDateStruct;
        const studyCompletion = protocol.statusModule?.completionDateStruct;

        // Skip if no phase info
        if (phases.length === 0) continue;

        // Use primary completion date if available, otherwise study completion
        const completionDate = primaryCompletion?.date || studyCompletion?.date;
        if (!completionDate) continue;

        // Parse the date (format: "2024-06" or "2024-06-15")
        const dateParts = completionDate.split('-');
        const formattedDate = dateParts.length === 2
          ? `${completionDate}-01` // Add day if only year-month
          : completionDate;

        const phaseStr = phases.map(p => p.replace('PHASE', 'Phase ')).join('/');
        const isEstimate = primaryCompletion?.type === 'ESTIMATED' || studyCompletion?.type === 'ESTIMATED';

        events.push({
          id: `ct-${nctId}`,
          symbol,
          eventType: 'clinical_trial',
          date: formattedDate,
          isEstimate,
          title: `${phaseStr} Trial Completion`,
          description: title,
          source: 'clinicaltrials',
          sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
          metadata: {
            nctId,
            status,
            phases,
          },
        });
      }

      // Sort by date
      events.sort((a, b) => a.date.localeCompare(b.date));

      console.log(`[ClinicalTrials] Returning ${events.length} trial events for ${symbol}`);
      return events;
    } catch (error) {
      console.error(`[ClinicalTrials] Error fetching trials for ${symbol}:`, error);
      return events;
    }
  }
}
