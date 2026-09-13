if (window.history.state?.f360Index === undefined)
  window.history.replaceState({ ...window.history.state, f360Index: 0 }, '');
window.history.scrollRestoration = 'manual';
const positions = new Map<string, number>();
const focusTargets = new Map<string, { href: string; index: number }>();
const tabs = new Map<string, string>();
const readerOrigins = new Map<string, string>();
const validSections = new Set(['today', 'explore', 'money', 'saved', 'more']);
let pendingRestore: { route: string; y: number } | null = null;
export function prepareRestore(route: string) {
  pendingRestore = { route, y: positions.get(route) ?? 0 };
}
export const currentRoute = () => window.location.hash.slice(1) || 'today';
export function sectionFor(route: string) {
  const key = route.split('?')[0]!;
  if (
    [
      'holdings',
      'my-goals',
      'money',
      'overview',
      'allocations',
      'reports',
    ].includes(key) ||
    key.startsWith('securities')
  )
    return 'money';
  if (key === 'saved') return 'saved';
  if (key === 'explore' || key.startsWith('macro') || key === 'sources')
    return 'explore';
  if (key.startsWith('read/')) {
    const state = window.history.state;
    const stored = route === currentRoute() ? state?.readerOrigin : undefined;
    if (typeof stored === 'string' && validSections.has(stored)) return stored;
    const remembered = readerOrigins.get(route);
    if (remembered) return remembered;
    const from = route === currentRoute() ? state?.from : undefined;
    if (typeof from === 'string' && !from.startsWith('read/') && from !== route)
      return sectionFor(from);
    return 'today';
  }
  if (key === 'today') return 'today';
  return 'more';
}
export function rememberFocus(route = currentRoute()) {
  const element = document.activeElement;
  if (!(element instanceof HTMLAnchorElement) || !element.closest('main'))
    return;
  const href = element.getAttribute('href');
  if (!href) return;
  const siblings = [
    ...document.querySelectorAll<HTMLAnchorElement>('main a[href]'),
  ].filter((a) => a.getAttribute('href') === href);
  focusTargets.set(route, { href, index: siblings.indexOf(element) });
}
export function rememberPosition(route = currentRoute()) {
  if (pendingRestore?.route === route) return;
  positions.set(route, window.scrollY);
  rememberFocus(route);
  tabs.set(sectionFor(route), route);
}
export function restorePosition(route = currentRoute(), contentReady = true) {
  const y =
    pendingRestore?.route === route
      ? pendingRestore.y
      : (positions.get(route) ?? 0);
  requestAnimationFrame(() => {
    if (currentRoute() !== route) return;
    if (
      !contentReady &&
      document.documentElement.scrollHeight - window.innerHeight < y
    )
      return;
    if (pendingRestore?.route === route) pendingRestore = null;
    const target = focusTargets.get(route);
    if (target)
      [...document.querySelectorAll<HTMLAnchorElement>('main a[href]')]
        .filter((a) => a.getAttribute('href') === target.href)
        .at(target.index)
        ?.focus({ preventScroll: true });
    window.scrollTo(0, y);
  });
}
export function canNavigate() {
  return window.dispatchEvent(
    new Event('f360-before-navigate', { cancelable: true }),
  );
}
export function go(route: string, replace = false) {
  if (
    !/^[a-zA-Z0-9_/?=&.%:-]+$/.test(route) ||
    route === currentRoute() ||
    !canNavigate()
  )
    return;
  const from = currentRoute();
  rememberPosition(from);
  const readerOrigin = route.startsWith('read/') ? sectionFor(from) : undefined;
  if (readerOrigin) readerOrigins.set(route, readerOrigin);
  const state = {
    ...(readerOrigin ? { readerOrigin } : {}),
    f360: true,
    from,
    route,
    f360Index: (window.history.state?.f360Index ?? 0) + (replace ? 0 : 1),
  };
  if (replace) window.history.replaceState(state, '', `#${route}`);
  else window.history.pushState(state, '', `#${route}`);
  // Only this event has already consulted the dirty-form guard.
  window.dispatchEvent(
    Object.assign(new HashChangeEvent('hashchange'), { f360Approved: true }),
  );
}
export function returnTo(fallback = 'today') {
  if (window.history.state?.f360 && window.history.state?.from)
    window.history.back();
  else go(fallback, true);
}
export function tabRoute(tab: string, selected = sectionFor(currentRoute())) {
  // More is a directory, never a shortcut to whichever tool was visited last.
  // Tapping the active destination returns to its root; switching tabs resumes it.
  if (tab === 'more' || tab === selected) return tab;
  return tabs.get(tab) ?? tab;
}
