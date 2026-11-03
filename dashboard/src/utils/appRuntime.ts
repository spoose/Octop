declare global {
  interface Window {
    __POWERED_BY_WUJIE__?: boolean;
    $wujie?: {
      location: Location;
      // The workspace reloads this instance through its existing retry action.
      props: { reload: () => void };
    };
  }
}

export function isEmbeddedApp(): boolean {
  return !!window.__POWERED_BY_WUJIE__;
}

export function getAppLocation(): Location {
  return window.$wujie?.location ?? window.location;
}

export function replaceAppRoute(path: string): void {
  if (!isEmbeddedApp()) {
    window.location.replace(path);
    return;
  }
  // Keep the iframe document intact and notify BrowserRouter of the new route.
  window.history.replaceState(window.history.state, "", path);
  window.dispatchEvent(
    new PopStateEvent("popstate", { state: window.history.state }),
  );
}

export function reloadApp(): void {
  if (window.$wujie) {
    window.$wujie.props.reload();
    return;
  }
  window.location.reload();
}
