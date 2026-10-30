import { afterEach, describe, expect, it } from "vitest";
import { getAppAssetUrl, setEmbeddedRoot } from "./appDocument";

afterEach(() => {
  setEmbeddedRoot(null);
  delete window.__POWERED_BY_QIANKUN__;
});

describe("getAppAssetUrl", () => {
  it.each([
    "/pwa-512.png",
    "/octop-mascot-type.webp",
    "/octop/assets/icon.svg",
  ])("keeps the original standalone path %s", (path) =>
    expect(getAppAssetUrl(path)).toBe(path),
  );

  it("resolves embedded assets before the React root mounts", () => {
    window.__POWERED_BY_QIANKUN__ = true;
    const resolved = new URL(getAppAssetUrl("/pwa-512.png"));
    expect(resolved.pathname).toMatch(/\/pwa-512\.png$/);
  });

  it("resolves embedded assets from the mounted application", () => {
    setEmbeddedRoot(document.createElement("div"));
    const resolved = new URL(getAppAssetUrl("/octop-mascot-empty.png"));
    expect(resolved.pathname).toMatch(/\/octop-mascot-empty\.png$/);
  });
});
