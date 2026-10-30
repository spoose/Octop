declare global {
  interface Window {
    __POWERED_BY_QIANKUN__?: boolean;
  }
}

let embeddedRoot: HTMLElement | null = null;

export function setEmbeddedRoot(root: HTMLElement | null): void {
  embeddedRoot = root;
}

export function isEmbeddedApp(): boolean {
  return embeddedRoot !== null || !!window.__POWERED_BY_QIANKUN__;
}

export function getAppDocumentRoot(): HTMLElement {
  return embeddedRoot ?? document.documentElement;
}

export function getAppAssetUrl(path: string): string {
  return isEmbeddedApp() ? new URL(path, import.meta.url).href : path;
}
