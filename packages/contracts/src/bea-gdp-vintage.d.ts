export declare const BEA_GDP_VINTAGES: readonly [
  {
    readonly url: 'https://www.bea.gov/news/2025/gross-domestic-product-2nd-quarter-2025-second-estimate-and-corporate-profits-preliminary';
    readonly publishedAt: '2025-08-28T12:30:00.000Z';
    readonly vintage: 'second';
  },
  {
    readonly url: 'https://www.bea.gov/news/2025/gross-domestic-product-2nd-quarter-2025-third-estimate-gdp-industry-corporate-profits';
    readonly publishedAt: '2025-09-25T12:30:00.000Z';
    readonly vintage: 'third';
  },
];
export declare function parseBeaGdpAnnualized(quote: string): {
  value: string;
  period: string;
  quote: string;
};
