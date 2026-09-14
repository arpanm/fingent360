import type pg from 'pg';
import type { WorkerId } from '@fingent360/contracts';
/** Hold through the caller's transaction. A committed exclusive pause fences all
 * later claims, including scheduling. Never update this row from an admitted job. */
export async function admitWorker(
  client: pg.PoolClient,
  worker: WorkerId,
): Promise<boolean> {
  const result = await client.query<{ paused: boolean }>(
    'SELECT paused FROM worker_controls WHERE worker=$1 FOR SHARE',
    [worker],
  );
  if (!result.rows[0]) throw Error('Worker control unavailable.');
  return !result.rows[0].paused;
}
export async function recordWorkerObservation(
  client: pg.PoolClient,
  worker: WorkerId,
  outcome: 'heartbeat' | 'success' | 'storage' | 'preparation',
) {
  if (outcome === 'heartbeat')
    await client.query(
      'UPDATE worker_observations SET heartbeat_at=clock_timestamp() WHERE worker=$1',
      [worker],
    );
  else if (outcome === 'success')
    await client.query(
      'UPDATE worker_observations SET last_success_at=clock_timestamp() WHERE worker=$1',
      [worker],
    );
  else
    await client.query(
      'UPDATE worker_observations SET last_failure_at=clock_timestamp(),failure_category=$2 WHERE worker=$1',
      [worker, outcome],
    );
}
