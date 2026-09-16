/** Synthetic upstream grammar. Original provider access is never exercised by these cases. */
export function installSyntheticIndiaGdpArchive() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith('https://archive.pib.gov.in/'))
      return original(input, init);
    if (url.endsWith('/erelease.aspx')) {
      if (init?.method === 'POST')
        return new Response(
          "0|1~<h3>Min of Statistics & Programme Implementation</h3><button id='294102'>QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT FOR THE FIRST QUARTER (APRIL-JUNE) OF 2026-27</button>",
          { headers: { 'content-type': 'text/html' } },
        );
      return new Response(
        '<select id="rmonthID"></select><select id="minID"></select><input type="hidden" name="__VIEWSTATE" value="synthetic"/>',
        { headers: { 'content-type': 'text/html' } },
      );
    }
    if (url.endsWith('/erelcontent.aspx?relid=294102'))
      return new Response(
        '<div id="ministry">Ministry of Statistics &amp; Programme Implementation<span>31-August, 2026 16:00 IST</span></div><div align="center">QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT FOR THE FIRST QUARTER (APRIL-JUNE) OF 2026-27<br>synthetic research fixture</div><p>Ministry of Statistics and Programme Implementation. Constant (2022-23) prices. Benchmark-Indicator methodology.</p><p>Real GDP or GDP at Constant Prices in Q1 of FY 2026-27 is estimated at ₹81.36 lakh crore, against ₹75.46 lakh crore in Q1 of FY 2025-26, showing a growth rate of 7.8%.</p>',
        { headers: { 'content-type': 'text/html' } },
      );
    return new Response('Synthetic source unavailable', { status: 404 });
  };
}
