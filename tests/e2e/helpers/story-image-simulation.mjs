// Explicit opt-in isolated API process only; never imported by test discovery.
export async function installSyntheticStoryImage(pool, schema) {
  if (
    !/^e2e_feedback_[a-f0-9]{32}$/.test(schema) ||
    (await pool.query('SELECT current_schema() AS schema')).rows[0]?.schema !==
      schema
  )
    throw Error('Synthetic image transport requires the owned test schema.');
  await pool.query(
    "CREATE TABLE test_story_image_provider (id boolean PRIMARY KEY DEFAULT true CHECK(id), mode text NOT NULL CHECK(mode IN ('success','fail','hold')), calls integer NOT NULL DEFAULT 0, last_request jsonb)",
  );
  await pool.query(
    "INSERT INTO test_story_image_provider(id,mode) VALUES(true,'success')",
  );
  globalThis.fetch = async (url, init) => {
    if (
      String(url) !== 'https://api.openai.com/v1/images/generations' ||
      init?.method !== 'POST' ||
      new Headers(init.headers).get('authorization') !==
        'Bearer synthetic-story-image-key-never-send'
    )
      throw Error('Unexpected network request in synthetic image fixture.');
    const input = JSON.parse(String(init.body));
    if (
      input.model !== 'synthetic-story-image-model' ||
      typeof input.prompt !== 'string' ||
      !input.prompt.startsWith('Create an editorial conceptual illustration')
    )
      throw Error('Unexpected image provider request.');
    await pool.query(
      'UPDATE test_story_image_provider SET calls=calls+1,last_request=$1 WHERE id=true',
      [JSON.stringify({ model: input.model, prompt: input.prompt })],
    );
    const deadline = performance.now() + 10000;
    let mode;
    for (;;) {
      mode = (
        await pool.query(
          'SELECT mode FROM test_story_image_provider WHERE id=true',
        )
      ).rows[0].mode;
      if (mode !== 'hold') break;
      if (init.signal?.aborted || performance.now() >= deadline)
        throw Error('Synthetic provider hold expired.');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const body =
      mode === 'fail'
        ? {
            error: {
              message: 'TEST-SIMULATION provider temporarily unavailable',
            },
          }
        : {
            data: [
              {
                b64_json:
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
              },
            ],
          };
    return new Response(JSON.stringify(body), {
      status: mode === 'fail' ? 503 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
