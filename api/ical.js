export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Only allow airbnb iCal URLs
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('airbnb') && !host.includes('hostify') && !host.includes('booking.com') && !host.includes('vrbo')) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const icalUrl = url.startsWith('webcal://') ? 'https://' + url.slice(9) : url;
    const response = await fetch(icalUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MAVI-Dashboard/1.0)' },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Upstream ${response.status}` });
    }

    const text = await response.text();

    // Cache for 15 minutes on CDN, 5 minutes browser
    res.setHeader('Cache-Control', 's-maxage=900, max-age=300, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
