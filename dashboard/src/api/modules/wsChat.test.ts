import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthToken } from "../request";
import { buildDashboardChatWsUrl } from "./wsChat";

vi.mock("../request", () => ({ getAuthToken: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe("buildDashboardChatWsUrl", () => {
  it.each([
    ["http://localhost:8088", "ws://localhost:8088"],
    ["https://octop.example.test", "wss://octop.example.test"],
    ["", `ws://${window.location.host}`],
  ])("uses the API origin with BASE_URL=%s", (apiBase, expectedOrigin) => {
    vi.stubGlobal("BASE_URL", apiBase);
    vi.mocked(getAuthToken).mockReturnValue("test token+a&b");
    const url = new URL(buildDashboardChatWsUrl("bridge:conn:bot"));
    expect(url.origin).toBe(expectedOrigin);
    expect(url.pathname).toBe("/api/agents/bridge%3Aconn%3Abot/chat/ws");
    expect(url.searchParams.get("token")).toBe("test token+a&b");
    expect([...url.searchParams.keys()]).toEqual(["token"]);
  });

  it("omits the query when no token exists", () => {
    vi.stubGlobal("BASE_URL", "http://localhost:8088");
    vi.mocked(getAuthToken).mockReturnValue("");
    expect(buildDashboardChatWsUrl("bot")).toBe(
      "ws://localhost:8088/api/agents/bot/chat/ws",
    );
  });
});
