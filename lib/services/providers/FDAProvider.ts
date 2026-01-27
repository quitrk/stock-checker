/**
 * Provider for OpenFDA API
 * Used to fetch historical FDA drug approval/rejection data
 */

export interface FDADecision {
  date: string;
  drugName: string;
  approved: boolean;
  applicationNumber: string;
  reviewPriority: 'PRIORITY' | 'STANDARD' | null;
  url: string | null;
}

interface OpenFDASubmission {
  submission_type?: string;
  submission_status?: string;
  submission_status_date?: string;
  review_priority?: string;
  application_docs?: {
    type?: string;
    url?: string;
  }[];
}

interface OpenFDADrugResult {
  application_number?: string;
  submissions?: OpenFDASubmission[];
  products?: {
    brand_name?: string;
  }[];
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
  };
}

interface OpenFDAResponse {
  error?: {
    code?: string;
    message?: string;
  };
  meta?: {
    results?: {
      total?: number;
    };
  };
  results?: OpenFDADrugResult[];
}

export class FDAProvider {
  private readonly baseUrl = 'https://api.fda.gov/drug/drugsfda.json';
  private readonly MIN_REQUEST_INTERVAL = 200;
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
   * Clean company name for search - extract core name and use wildcard
   */
  private cleanCompanyName(name: string): string {
    // Remove common suffixes
    const cleaned = name
      .replace(/,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|LLC|PLC|Limited|Co\.?|Pharmaceuticals?|Therapeutics?|Biosciences?|Biotech|A\/S|AG|S\.?A\.?|N\.?V\.?|SE|plc)$/gi, '')
      .trim();

    // Take first two words and add wildcard for fuzzy matching
    const words = cleaned.split(/\s+/).slice(0, 2).join(' ');
    return words + '*';
  }

  /**
   * Get FDA approval/rejection history for a company
   */
  async getFDAHistory(companyName: string): Promise<FDADecision[]> {
    const decisions: FDADecision[] = [];

    try {
      const searchName = this.cleanCompanyName(companyName);
      if (searchName.length < 3) return decisions;

      console.log(`[FDAProvider] Searching FDA history for "${searchName}"`);
      await this.throttle();

      // Search by manufacturer name in openfda field
      const params = new URLSearchParams({
        search: `openfda.manufacturer_name:"${searchName}"`,
        limit: '100',
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      const data = (await response.json()) as OpenFDAResponse;

      // Handle API error responses (returned as JSON, not HTTP status)
      if (data.error) {
        if (data.error.code === 'NOT_FOUND') {
          console.log(`[FDAProvider] No FDA history found for "${searchName}"`);
          return decisions;
        }
        throw new Error(`OpenFDA API error: ${data.error.message}`);
      }

      if (!data.results) return decisions;

      console.log(`[FDAProvider] Found ${data.results.length} drug applications for "${searchName}"`);

      // Process each drug application
      for (const drug of data.results) {
        if (!drug.submissions) continue;

        // Look for original NDA/BLA submissions (new drug approvals)
        for (const submission of drug.submissions) {
          // Focus on original applications and their approval/rejection
          const isOriginal = submission.submission_type === 'ORIG';
          const status = submission.submission_status;
          const statusDate = submission.submission_status_date;

          if (!isOriginal || !statusDate) continue;

          // Check if approved or rejected (Complete Response Letter)
          const isApproved = status === 'AP';
          const isRejected = status === 'TA' || status === 'WR'; // Tentative Approval or Withdrawn

          if (isApproved || isRejected) {
            const brandName = drug.openfda?.brand_name?.[0] ||
                              drug.products?.[0]?.brand_name ||
                              drug.openfda?.generic_name?.[0] ||
                              'Unknown';

            // Get review priority
            const priority = submission.review_priority;
            const reviewPriority = priority === 'PRIORITY' ? 'PRIORITY' : priority === 'STANDARD' ? 'STANDARD' : null;

            // Get approval letter URL
            const letterDoc = submission.application_docs?.find(doc => doc.type === 'Letter');
            const url = letterDoc?.url || null;

            decisions.push({
              date: this.formatDate(statusDate),
              drugName: brandName,
              approved: isApproved,
              applicationNumber: drug.application_number || '',
              reviewPriority,
              url,
            });
          }
        }
      }

      // Sort by date descending (most recent first)
      decisions.sort((a, b) => b.date.localeCompare(a.date));

      console.log(`[FDAProvider] Found ${decisions.length} FDA decisions for "${searchName}"`);

      return decisions;

    } catch (error) {
      console.error(`[FDAProvider] Error fetching FDA history for ${companyName}:`, error);
      return decisions;
    }
  }

  /**
   * Format date from YYYYMMDD to YYYY-MM-DD
   */
  private formatDate(dateStr: string): string {
    if (dateStr.length === 8) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  }
}
