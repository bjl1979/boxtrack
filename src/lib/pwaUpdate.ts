/**
 * App updates. The service worker keeps a copy of the app on the phone; when a new version is
 * published, the new copy downloads in the background and waits. The user taps "Update" and the
 * app reloads into the new version – no reinstall, and the data in IndexedDB is untouched.
 *
 * Checks happen when the app starts, whenever it comes back to the foreground, every hour while
 * it is open, and on demand (Settings → About & updates).
 */
import { registerSW } from 'virtual:pwa-register';

export type CheckResult = 'available' | 'latest' | 'offline' | 'unsupported' | 'error';

interface State {
  /** A new version is downloaded and waiting. */
  needRefresh: boolean;
  /** First install finished: the app works offline. */
  offlineReady: boolean;
  checking: boolean;
}

let state: State = { needRefresh: false, offlineReady: false, checking: false };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let updateSW: ((reload?: boolean) => Promise<void>) | undefined;
const HOUR = 60 * 60 * 1000;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const pwaUpdate = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
  dismissOfflineReady: () => set({ offlineReady: false }),
  dismissUpdate: () => set({ needRefresh: false }),
  /**
   * Switches to the waiting new version and reloads. Done here rather than through the plugin,
   * whose reload only fires for updates it noticed itself (not ones found by "Check for updates").
   */
  async apply() {
    const waiting = registration?.waiting;
    if (!waiting) {
      if (updateSW) await updateSW(true);
      window.location.reload();
      return;
    }
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(reload, 5000); // safety net if the browser never reports the switch
  },
};

/** Waits until a newly found version has finished downloading (or 60 s pass). */
function waitForInstall(sw: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      if (sw.state === 'installed' || sw.state === 'activated' || sw.state === 'redundant') {
        sw.removeEventListener('statechange', done);
        resolve();
      }
    };
    sw.addEventListener('statechange', done);
    setTimeout(resolve, 60_000);
    done();
  });
}

/** Asks the server whether a newer version was published. */
export async function checkForUpdate(): Promise<CheckResult> {
  if (!('serviceWorker' in navigator) || !registration) return 'unsupported';
  if (!navigator.onLine) return 'offline';
  set({ checking: true });
  try {
    await registration.update();
    const incoming = registration.installing ?? registration.waiting;
    if (incoming) {
      if (registration.installing) await waitForInstall(registration.installing);
      set({ needRefresh: !!registration.waiting || state.needRefresh });
      return registration.waiting ? 'available' : 'latest';
    }
    return state.needRefresh ? 'available' : 'latest';
  } catch {
    return navigator.onLine ? 'error' : 'offline';
  } finally {
    set({ checking: false });
  }
}

let started = false;
export function startPwaUpdates(): void {
  if (started || !('serviceWorker' in navigator)) return;
  started = true;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ needRefresh: true }),
    onOfflineReady: () => set({ offlineReady: true }),
    onRegisteredSW: (_url, r) => {
      registration = r;
      setInterval(() => void checkForUpdate(), HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkForUpdate();
      });
    },
  });
}

export const appVersion = {
  version: __APP_VERSION__,
  build: __BUILD_ID__,
  builtAt: __BUILD_TIME__,
};
