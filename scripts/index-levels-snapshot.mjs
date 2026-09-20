import { IndexLevelPublicSchema } from '../packages/contracts/dist/index.js';
export async function captureIndexLevels(get) {
  const value = IndexLevelPublicSchema.parse(
    await get('/index-levels/snapshot'),
  );
  if (value.nextBefore !== null)
    throw Error(
      'Index history exceeds the1000-date snapshot limit; refusing a partial installation.',
    );
  const current = IndexLevelPublicSchema.parse(
    await get('/index-levels/snapshot'),
  );
  if (
    current.nextBefore !== null ||
    JSON.stringify(current.editions) !== JSON.stringify(value.editions)
  )
    throw Error(
      'Index publication changed during snapshot capture. Retry; the existing bundle is unchanged.',
    );
  return current;
}
