/**
 * Agent script to analyze downloaded SEC 8-K filings and extract biotech catalyst patterns
 *
 * Run with: npx tsx scripts/analyze-sec-filings.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const FILINGS_DIR = './data/sec-filings';

// Pattern categories we're looking for
interface PatternMatch {
  symbol: string;
  file: string;
  category: string;
  match: string;
  context: string; // surrounding text
}

interface CategoryPatterns {
  name: string;
  patterns: RegExp[];
  // Optional negative patterns to filter out false positives
  excludePatterns?: RegExp[];
}

/**
 * Decode HTML entities commonly found in SEC filings
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#8221;/g, '"')
    .replace(/&#8220;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#160;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&#174;/g, '®')
    .replace(/&#945;/g, 'α')
    .replace(/&#9679;/g, '•')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' '); // normalize whitespace
}

/**
 * Check if text looks like boilerplate/legal text to exclude
 */
function isBoilerplate(text: string): boolean {
  const boilerplateIndicators = [
    /\/s\/\s+\w+/i,                    // Signatures like "/s/ John Smith"
    /By:\s*$/i,                         // "By:" signature lines
    /dated\s+(?:as\s+of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)/i,
    /filed\s+(?:as\s+)?Exhibit/i,       // "filed as Exhibit 10.1"
    /indemnification\s+agreement/i,
    /form\s+of\s+(?:indemnification|agreement)/i,
    /WITNESSETH/i,
    /WHEREAS/i,
  ];
  return boilerplateIndicators.some(p => p.test(text));
}

// Patterns to search for - refined based on initial analysis
const CATEGORIES: CategoryPatterns[] = [
  {
    name: 'PDUFA',
    patterns: [
      // Specific PDUFA date mentions
      /PDUFA[^.]*(?:date|goal)[^.]{0,100}/gi,
      /PDUFA\s+target\s+action\s+date[^.]{0,100}/gi,
      /Prescription\s+Drug\s+User\s+Fee\s+Act[^.]*(?:date|goal|target)[^.]{0,150}/gi,
      /(?:target|goal)\s+action\s+date\s+(?:of|is)\s+[^.]{0,100}/gi,
      /FDA[^.]{0,30}action\s+date\s+(?:of|is)\s+[^.]{0,100}/gi,
    ],
  },
  {
    name: 'AdCom',
    patterns: [
      // Advisory Committee with meeting context
      /Advisory\s+Committee\s+(?:meeting|scheduled|will\s+meet|convene)[^.]{0,150}/gi,
      /Advisory\s+Committee\s+(?:on|for)\s+[^.]{0,100}/gi,
      /(?:ODAC|AMDAC|CRDAC|EMDAC)[^.]*(?:meeting|scheduled|date)[^.]{0,100}/gi,
      /FDA\s+(?:advisory\s+)?panel\s+(?:meeting|scheduled|will)[^.]{0,100}/gi,
    ],
    excludePatterns: [
      /oDAC®/gi,  // Product name, not ODAC committee
      /Advisory\s+Committee,?\s+starting\s+on/gi,  // Board committee appointments
      /Advisory\s+Committee\s+(?:of|to)\s+the\s+Board/gi,
    ],
  },
  {
    name: 'FDA Designation',
    patterns: [
      // Designations with granted/received context
      /(?:granted|received|obtained)\s+(?:a\s+)?Breakthrough\s+Therapy[^.]{0,150}/gi,
      /Breakthrough\s+Therapy\s+(?:designation|status)[^.]{0,150}/gi,
      /(?:granted|received|obtained)\s+(?:a\s+)?Fast\s+Track[^.]{0,150}/gi,
      /Fast\s+Track\s+(?:designation|status)[^.]{0,150}/gi,
      /(?:granted|received)\s+(?:a\s+)?Priority\s+Review[^.]{0,150}/gi,
      /Priority\s+Review\s+(?:designation|status|for)[^.]{0,150}/gi,
      /(?:granted|received|obtained)\s+(?:a\s+)?Orphan\s+Drug[^.]{0,150}/gi,
      /Orphan\s+Drug\s+(?:designation|status)[^.]{0,150}/gi,
      /Accelerated\s+Approval\s+(?:pathway|designation|granted)[^.]{0,150}/gi,
      /RMAT\s+(?:designation|status)[^.]{0,100}/gi,  // Regenerative Medicine Advanced Therapy
    ],
    excludePatterns: [
      /risks\s+related\s+to/gi,  // Forward-looking disclaimer text
      /no\s+assurance/gi,
      /may\s+not\s+(?:receive|obtain|be\s+granted)/gi,
    ],
  },
  {
    name: 'FDA Approval/Rejection',
    patterns: [
      // Actual approvals (not conditional/future)
      /FDA\s+(?:has\s+)?approved\s+[A-Z][^.]{0,150}/gi,
      /received\s+(?:FDA\s+)?approval\s+(?:for|of|to)[^.]{0,150}/gi,
      /Complete\s+Response\s+Letter[^.]{0,150}/gi,
      /(?:issued|received)\s+(?:a\s+)?CRL[^.]{0,100}/gi,
      /FDA\s+(?:has\s+)?(?:rejected|declined)[^.]{0,100}/gi,
      /approval\s+(?:of|for)\s+(?:the\s+)?(?:NDA|BLA|sNDA|sBLA)[^.]{0,100}/gi,
    ],
    excludePatterns: [
      /if\s+(?:the\s+)?FDA\s+(?:has\s+)?approved/gi,
      /(?:prior\s+to|before)\s+(?:FDA\s+)?approval/gi,
      /FDA\s+approved\s+treatments?\s+for/gi,  // Referring to existing treatments
    ],
  },
  {
    name: 'Clinical Readout',
    patterns: [
      // Specific readout announcements
      /(?:announced|reported|released)\s+(?:positive\s+)?topline\s+(?:data|results)[^.]{0,150}/gi,
      /topline\s+(?:data|results)\s+(?:from|expected|readout)[^.]{0,150}/gi,
      /Phase\s+[123][a-b]?\s+(?:topline|interim|final)\s+(?:data|results)[^.]{0,150}/gi,
      /(?:met|achieved)\s+(?:its\s+)?primary\s+endpoint[^.]{0,150}/gi,
      /primary\s+endpoint\s+(?:met|achieved|results)[^.]{0,150}/gi,
      /pivotal\s+(?:trial|study)\s+(?:met|achieved|results|data)[^.]{0,150}/gi,
      /data\s+readout\s+(?:expected|anticipated|scheduled)[^.]{0,150}/gi,
    ],
    excludePatterns: [
      /Interim\s+Results\s*$/gi,  // Fragment matches
      /^Interim\s+Results\s*(?:announced)?$/gi,
    ],
  },
  {
    name: 'Clinical Milestone',
    patterns: [
      /(?:announced|completed|completes)\s+enrollment[^.]{0,150}/gi,
      /first\s+patient\s+(?:dosed|enrolled|treated|randomized)[^.]{0,150}/gi,
      /last\s+patient\s+(?:dosed|enrolled|treated|visit)[^.]{0,150}/gi,
      /(?:initiated|initiates|commenced)\s+(?:a\s+)?(?:Phase|pivotal|registrational)[^.]{0,150}/gi,
      /(?:initiated|initiates|commenced)\s+dosing[^.]{0,150}/gi,
      /enrollment\s+(?:completed|complete|closed)[^.]{0,100}/gi,
    ],
  },
  {
    name: 'NDA/BLA Submission',
    patterns: [
      // Specific submission events
      /(?:submitted|filed|submits|files)\s+(?:a\s+|an\s+|its\s+)?(?:NDA|BLA|sNDA|sBLA)[^.]{0,150}/gi,
      /(?:NDA|BLA|sNDA|sBLA)\s+(?:submitted|filed|accepted|submission)[^.]{0,150}/gi,
      /(?:submitted|filed)\s+(?:a\s+)?(?:New\s+Drug\s+Application|Biologics\s+License\s+Application)[^.]{0,150}/gi,
      /FDA\s+(?:accepted|received)\s+(?:the\s+)?(?:NDA|BLA|sNDA|sBLA)[^.]{0,150}/gi,
      /(?:NDA|BLA)\s+(?:acceptance|filing)[^.]{0,100}/gi,
    ],
    excludePatterns: [
      /abbreviated\s+new\s+drug\s+application/gi,  // ANDA (generics)
      /ANDA/gi,
      /form\s+of\s+indemnification/gi,
      /(?:agreement|proposal)\s+NDA/gi,  // Non-Disclosure Agreement
    ],
  },
  {
    name: 'Catalyst Dates',
    patterns: [
      // Catalyst-specific date patterns (not general dates)
      /(?:data|results|readout)\s+(?:expected|anticipated)\s+(?:in\s+)?(?:Q[1-4]|(?:first|second)\s+half|1H|2H)\s+\d{4}/gi,
      /(?:PDUFA|target\s+action)\s+date\s+(?:of|is)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
      /(?:approval|decision)\s+(?:expected|anticipated)\s+(?:by|in)\s+(?:Q[1-4]|(?:January|February|March|April|May|June|July|August|September|October|November|December))[^.]{0,50}/gi,
      /(?:trial|study)\s+(?:completion|results)\s+(?:expected|anticipated)\s+(?:in\s+)?(?:Q[1-4]|(?:first|second)\s+half|1H|2H)\s+\d{4}/gi,
      /Advisory\s+Committee\s+(?:meeting\s+)?(?:on|scheduled\s+for)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    ],
    excludePatterns: [
      /\/s\//gi,  // Signatures
      /By:\s/gi,
      /dated\s+(?:as\s+of)?/gi,
    ],
  },
];

async function getSymbolFolders(): Promise<string[]> {
  try {
    const entries = await fs.readdir(FILINGS_DIR, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    console.error(`Could not read ${FILINGS_DIR}. Run with SAVE_SEC_FILINGS=true first.`);
    return [];
  }
}

async function analyzeSymbol(symbol: string): Promise<PatternMatch[]> {
  const matches: PatternMatch[] = [];
  const symbolDir = path.join(FILINGS_DIR, symbol);

  const files = await fs.readdir(symbolDir);
  const txtFiles = files.filter(f => f.endsWith('.txt'));

  for (const file of txtFiles) {
    const rawContent = await fs.readFile(path.join(symbolDir, file), 'utf-8');
    // Decode HTML entities for cleaner matching
    const content = decodeHTMLEntities(rawContent);

    for (const category of CATEGORIES) {
      for (const pattern of category.patterns) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(content)) !== null) {
          const matchText = match[0].trim();

          // Get surrounding context
          const start = Math.max(0, match.index - 100);
          const end = Math.min(content.length, match.index + match[0].length + 100);
          const context = content.slice(start, end).trim();

          // Skip boilerplate text
          if (isBoilerplate(matchText) || isBoilerplate(context)) {
            continue;
          }

          // Check exclude patterns
          if (category.excludePatterns) {
            const excluded = category.excludePatterns.some(ep => {
              ep.lastIndex = 0;
              return ep.test(matchText) || ep.test(context);
            });
            if (excluded) continue;
          }

          matches.push({
            symbol,
            file,
            category: category.name,
            match: matchText,
            context,
          });
        }
      }
    }
  }

  return matches;
}

function dedupeMatches(matches: PatternMatch[]): PatternMatch[] {
  const seen = new Set<string>();
  return matches.filter(m => {
    // Normalize match text for deduping
    const normalized = m.match
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    const key = `${m.symbol}-${m.category}-${normalized}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract specific dates from matches for summary
 */
function extractDates(text: string): string[] {
  const dates: string[] = [];

  // Month Day, Year format
  const mdyPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi;
  let match;
  while ((match = mdyPattern.exec(text)) !== null) {
    dates.push(match[0]);
  }

  // Quarter format
  const qPattern = /(Q[1-4]|(?:first|second)\s+half|1H|2H)\s+\d{4}/gi;
  while ((match = qPattern.exec(text)) !== null) {
    dates.push(match[0]);
  }

  return dates;
}

async function main() {
  console.log('SEC Filing Pattern Analyzer\n');
  console.log('='.repeat(60));

  const symbols = await getSymbolFolders();
  if (symbols.length === 0) {
    console.log('No filings found. Run the app with SAVE_SEC_FILINGS=true first.');
    return;
  }

  console.log(`Found ${symbols.length} symbols to analyze\n`);

  const allMatches: PatternMatch[] = [];

  for (const symbol of symbols) {
    process.stdout.write(`Analyzing ${symbol}... `);
    const matches = await analyzeSymbol(symbol);
    console.log(`${matches.length} matches`);
    allMatches.push(...matches);
  }

  // Dedupe
  const uniqueMatches = dedupeMatches(allMatches);

  console.log('\n' + '='.repeat(60));
  console.log(`\nTotal unique matches: ${uniqueMatches.length}\n`);

  // Group by category and show summary
  const byCategory = new Map<string, PatternMatch[]>();
  for (const m of uniqueMatches) {
    const existing = byCategory.get(m.category) || [];
    existing.push(m);
    byCategory.set(m.category, existing);
  }

  console.log('SUMMARY BY CATEGORY:\n');
  for (const [category, matches] of byCategory) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${category.toUpperCase()} (${matches.length} matches)`);
    console.log('─'.repeat(60));

    // Collect unique symbols with matches
    const symbolsWithMatches = [...new Set(matches.map(m => m.symbol))];
    console.log(`Symbols: ${symbolsWithMatches.join(', ')}`);

    // Extract and show dates found
    const allDates: string[] = [];
    for (const m of matches) {
      allDates.push(...extractDates(m.match));
    }
    const uniqueDates = [...new Set(allDates)].slice(0, 10);
    if (uniqueDates.length > 0) {
      console.log(`Dates found: ${uniqueDates.join(', ')}`);
    }

    // Show up to 5 examples per category
    const examples = matches.slice(0, 5);
    for (const ex of examples) {
      console.log(`\n[${ex.symbol}] ${ex.file}`);
      console.log(`Match: ${ex.match.slice(0, 200)}${ex.match.length > 200 ? '...' : ''}`);
    }

    if (matches.length > 5) {
      console.log(`\n... and ${matches.length - 5} more matches`);
    }
  }

  // Save full results to JSON
  const outputPath = path.join(FILINGS_DIR, '_analysis_results.json');
  await fs.writeFile(outputPath, JSON.stringify(uniqueMatches, null, 2));
  console.log(`\n\nFull results saved to: ${outputPath}`);

  // Save category summary with more detail
  const summaryPath = path.join(FILINGS_DIR, '_category_summary.json');
  const summary: Record<string, {
    count: number;
    symbols: string[];
    dates: string[];
    examples: Array<{ symbol: string; match: string }>;
  }> = {};
  for (const [category, matches] of byCategory) {
    const allDates: string[] = [];
    for (const m of matches) {
      allDates.push(...extractDates(m.match));
    }
    summary[category] = {
      count: matches.length,
      symbols: [...new Set(matches.map(m => m.symbol))],
      dates: [...new Set(allDates)],
      examples: matches.slice(0, 10).map(m => ({ symbol: m.symbol, match: m.match })),
    };
  }
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Category summary saved to: ${summaryPath}`);
}

main().catch(console.error);
