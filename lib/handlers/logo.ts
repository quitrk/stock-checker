export interface LogoResult {
  buffer: Buffer;
  contentType: string | null;
}

export async function fetchLogo(symbol: string): Promise<LogoResult | null> {
  const logoKitToken = process.env.LOGOKIT_TOKEN;
  if (!logoKitToken) {
    console.log('[Logo] No LOGOKIT_TOKEN configured');
    return null;
  }

  const upperSymbol = symbol.toUpperCase();
  const logoUrl = `https://img.logokit.com/ticker/${upperSymbol}?token=${logoKitToken}`;

  try {
    const response = await fetch(logoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      console.log(`[Logo] Failed to fetch ${upperSymbol}: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');

    return { buffer, contentType };
  } catch (error) {
    console.log(`[Logo] Error fetching ${upperSymbol}:`, error);
    return null;
  }
}
