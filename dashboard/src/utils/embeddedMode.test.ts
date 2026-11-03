import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiUrl, getWsUrl } from "../api/config";
import { registerSW } from "../sw-register";
import {
  bustServiceWorkerAndReload,
  tryReloadOnStaleChunk,
} from "./reloadOnStaleChunk";

beforeEach(() => {
  vi.stubGlobal("__POWERED_BY_WUJIE__", true);
  vi.stubGlobal("$wujie", {
    location: new URL("https://octop.example.test:9000/chat"),
    props: { reload: vi.fn() },
  });
  vi.stubGlobal("BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-wujie-embedded");
});

describe("embedded ordinary entry", () => {
  it.each([true, false])(
    "marks the HTML layout only when embedded=%s",
    (embedded) => {
      const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
      const script = html.match(
        /<script id="octop-boot-theme">([\s\S]*?)<\/script>/,
      )!;
      runInNewContext(script[1], {
        window: { __POWERED_BY_WUJIE__: embedded },
        document,
        localStorage: { getItem: () => null },
      });
      expect(document.documentElement.hasAttribute("data-wujie-embedded")).toBe(
        embedded,
      );
    },
  );

  it("does not touch the host's service workers or caches", async () => {
    const getRegistrations = vi.fn().mockResolvedValue([]);
    const register = vi.fn();
    const keys = vi.fn().mockResolvedValue([]);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations, register },
    });
    vi.stubGlobal("caches", { keys });

    await registerSW();
    await bustServiceWorkerAndReload();

    expect(getRegistrations).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(keys).not.toHaveBeenCalled();
  });

  it("leaves automatic stale-chunk recovery to the host", () => {
    expect(tryReloadOnStaleChunk(new Error("Loading chunk 1 failed"))).toBe(
      false,
    );
  });

  it("uses the child origin for relative API and WebSocket requests", () => {
    expect(getApiUrl("/models")).toBe(
      "https://octop.example.test:9000/api/models",
    );
    expect(getWsUrl("/browser-stream/ws")).toBe(
      "wss://octop.example.test:9000/api/browser-stream/ws",
    );
  });

  it("keeps an explicitly configured API target", () => {
    vi.stubGlobal("BASE_URL", "http://api.example.test:8088");
    expect(getApiUrl("/models")).toBe(
      "http://api.example.test:8088/api/models",
    );
    expect(getWsUrl("/desktop-stream/ws")).toBe(
      "ws://api.example.test:8088/api/desktop-stream/ws",
    );
  });

  it("does not install the HTML cache-clearing recovery handler", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(
      (match) => match[1].includes('var KEY = "octop:chunk-reload"'),
    )!;
    const addEventListener = vi.fn();
    runInNewContext(script[1], {
      window: { __POWERED_BY_WUJIE__: true, addEventListener },
    });
    expect(addEventListener).not.toHaveBeenCalled();
  });
});
