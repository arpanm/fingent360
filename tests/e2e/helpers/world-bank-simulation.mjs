// Installed only inside an explicitly selected, isolated API test process.
export async function installSyntheticWorldBank(pool, schema) {
  if (
    !/^e2e_feedback_[a-f0-9]{32}$/.test(schema) ||
    (await pool.query('SELECT current_schema() AS schema')).rows[0]?.schema !==
      schema
  )
    throw Error('World Bank simulation requires the owned test schema.');
  await pool.query(
    'CREATE TABLE test_world_bank_provider(id boolean PRIMARY KEY DEFAULT true CHECK(id),mode text NOT NULL,calls integer NOT NULL DEFAULT 0,last_url text,last_body text)',
  );
  await pool.query(
    "INSERT INTO test_world_bank_provider(id,mode) VALUES(true,'success')",
  );
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const match = url.pathname.match(
      /^\/v2\/country\/IND\/indicator\/(NY\.GDP\.MKTP\.KD\.ZG|FP\.CPI\.TOTL\.ZG)$/,
    );
    if (
      url.origin !== 'https://api.worldbank.org' ||
      !match ||
      init?.redirect !== 'error' ||
      new Headers(init.headers).get('accept') !== 'application/json'
    )
      throw Error(
        'Unexpected network request in synthetic World Bank fixture.',
      );
    const mode = (
      await pool.query(
        'SELECT mode FROM test_world_bank_provider WHERE id=true',
      )
    ).rows[0].mode;
    const body =
      mode === 'invalid'
        ? '[{"synthetic":"malformed provider envelope"}]'
        : `[{"page":1,"pages":1,"per_page":100,"total":1,"sourceid":"2","lastupdated":"2026-01-01"},[{"indicator":{"id":"${match[1]}","value":"TEST-SIMULATION annual series"},"country":{"id":"IN","value":"India"},"countryiso3code":"IND","date":"2024","value":1.234567890123456789,"unit":"","obs_status":"","decimal":18}]]`;
    await pool.query(
      'UPDATE test_world_bank_provider SET calls=calls+1,last_url=$1,last_body=$2 WHERE id=true',
      [url.href, body],
    );
    if (mode === 'network')
      throw new TypeError('TEST-SIMULATION unavailable transport');
    if (mode === 'empty')
      return new Response(null, {
        headers: { 'content-type': 'application/json' },
      });
    if (mode === 'interrupted')
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('TEST-SIMULATION interrupted body'));
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    return new Response(mode === 'oversized' ? ' '.repeat(1000001) : body, {
      status: mode === 'http' ? 503 : 200,
      headers: {
        'content-type': mode === 'format' ? 'text/html' : 'application/json',
      },
    });
  };
}
