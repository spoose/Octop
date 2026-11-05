import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OCTOP_STATUS_EVENT,
  WORKBENCH_HELLO_EVENT,
  WORKBENCH_PROMPT_EVENT,
  reportOctopStatus,
  subscribeWorkbenchPrompt,
  useWorkbenchAuthStatus,
} from "./workbenchBridge";

type Listener = (...args: unknown[]) => void;

function createBus() {
  const listeners = new Map<string, Listener[]>();
  return {
    listeners,
    $on: vi.fn((event: string, fn: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
    }),
    $off: vi.fn((event: string, fn: Listener) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((item) => item !== fn),
      );
    }),
    $emit: vi.fn((event: string, ...args: unknown[]) => {
      (listeners.get(event) ?? []).forEach((fn) => fn(...args));
    }),
  };
}

let bus: ReturnType<typeof createBus>;

beforeEach(() => {
  bus = createBus();
  vi.stubGlobal("__POWERED_BY_WUJIE__", true);
  vi.stubGlobal("$wujie", {
    location: new URL("https://octop.example.test:9000/chat"),
    props: { reload: vi.fn() },
    bus,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reportOctopStatus", () => {
  it("emits the login status to the workbench host when embedded", () => {
    reportOctopStatus("authenticated");
    expect(bus.$emit).toHaveBeenCalledWith(OCTOP_STATUS_EVENT, {
      status: "authenticated",
    });
  });

  it("does nothing when running standalone", () => {
    vi.stubGlobal("__POWERED_BY_WUJIE__", false);
    reportOctopStatus("authenticated");
    expect(bus.$emit).not.toHaveBeenCalled();
  });
});

describe("subscribeWorkbenchPrompt", () => {
  it("delivers trimmed prompts and ignores blank or malformed payloads", () => {
    const onPrompt = vi.fn();
    subscribeWorkbenchPrompt(onPrompt);

    bus.$emit(WORKBENCH_PROMPT_EVENT, { prompt: "  查询用量  " });
    bus.$emit(WORKBENCH_PROMPT_EVENT, { prompt: "   " });
    bus.$emit(WORKBENCH_PROMPT_EVENT, { prompt: 42 });
    bus.$emit(WORKBENCH_PROMPT_EVENT);

    expect(onPrompt).toHaveBeenCalledOnce();
    expect(onPrompt).toHaveBeenCalledWith("查询用量");
  });

  it("removes the prompt listener on cleanup", () => {
    const onPrompt = vi.fn();
    const unsubscribe = subscribeWorkbenchPrompt(onPrompt);
    unsubscribe();
    bus.$emit(WORKBENCH_PROMPT_EVENT, { prompt: "after cleanup" });
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it("is inert when running standalone", () => {
    vi.stubGlobal("__POWERED_BY_WUJIE__", false);
    const onPrompt = vi.fn();
    subscribeWorkbenchPrompt(onPrompt);
    expect(bus.$on).not.toHaveBeenCalled();
  });
});

describe("useWorkbenchAuthStatus", () => {
  it("answers hello on the login route and reports the new status after login", () => {
    const { rerender, unmount } = renderHook(
      ({
        status,
      }: {
        status: "unauthenticated" | "checking" | "authenticated";
      }) => useWorkbenchAuthStatus(status),
      { initialProps: { status: "unauthenticated" } },
    );
    bus.$emit(WORKBENCH_HELLO_EVENT);
    expect(bus.$emit).toHaveBeenLastCalledWith(OCTOP_STATUS_EVENT, {
      status: "unauthenticated",
    });

    rerender({ status: "checking" });
    expect(bus.$emit).toHaveBeenLastCalledWith(OCTOP_STATUS_EVENT, {
      status: "checking",
    });
    rerender({ status: "authenticated" });
    expect(bus.$emit).toHaveBeenLastCalledWith(OCTOP_STATUS_EVENT, {
      status: "authenticated",
    });

    unmount();
    expect(bus.listeners.get(WORKBENCH_HELLO_EVENT)).toEqual([]);
  });
});
