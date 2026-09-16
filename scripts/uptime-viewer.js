const byId = (id) => document.getElementById(id);
async function refresh() {
  byId('refresh').disabled = true;
  byId('error').textContent = '';
  byId('status').textContent = 'Loading persisted observations…';
  try {
    const response = await fetch('/state', { cache: 'no-store' });
    if (!response.ok) throw Error('Observer readout unavailable.');
    const value = await response.json();
    byId('targets').replaceChildren();
    byId('incidents').replaceChildren();
    byId('status').textContent =
      `${value.sampleCount} retained observations. Last persisted: ${value.updatedAt ?? 'never'}.`;
    if (value.storageError)
      byId('error').textContent =
        'Journal write failed. Displayed observations are previously saved evidence; new health is unknown.';
    for (const target of value.targets) {
      const li = document.createElement('li');
      li.textContent = `${target.id}: ${value.storageError ? 'unknown' : target.status}`;
      const detail = document.createElement('small');
      detail.textContent = target.latest
        ? `${target.latest.at} · ${target.latest.latencyMs} ms · ${target.latest.reason}`
        : 'No observations yet.';
      li.append(detail);
      byId('targets').append(li);
    }
    for (const incident of value.incidents) {
      const li = document.createElement('li');
      li.textContent = `${incident.target} · ${incident.recoveredAt ? 'Recovered' : 'Open'} · first failed ${incident.firstFailureAt} · first recovered ${incident.recoveredAt ?? 'not observed'}`;
      byId('incidents').append(li);
    }
    if (!value.incidents.length)
      byId('incidents').textContent = 'No retained incident episodes.';
  } catch {
    byId('status').textContent = 'Current observer state unknown.';
    byId('error').textContent =
      'Cannot read observations. Check the independent monitor process and refresh.';
  } finally {
    byId('refresh').disabled = false;
  }
}
byId('refresh').addEventListener('click', () => void refresh());
void refresh();
