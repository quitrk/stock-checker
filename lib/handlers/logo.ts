export interface LogoResult {
  buffer: Buffer;
  contentType: string | null;
}

export async function fetchLogo(symbol: string): Promise<LogoResult | null> {
  const logoKitToken = process.env.LOGOKIT_TOKEN;
  if (!logoKitToken) {
    return null;
  }

  const upperSymbol = symbol.toUpperCase();
  const logoUrl = `https://img.logokit.com/ticker/${upperSymbol}?token=${logoKitToken}`;

  const response = await fetch(logoUrl);

  if (!response.ok) {
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type');

  return { buffer, contentType };
}
