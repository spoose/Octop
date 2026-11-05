import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OCTOP_STATUS_EVENT,
  WORKBENCH_PROMPT_EVENT,
} from "../../../utils/workbenchBridge";
import { useWorkbenchPrompt } from "./useWorkbenchPrompt";

type Listener = (...args: unknown[]) => void;

let listeners: Map<string, Listener[]>;
let bus: {
  $on: ReturnType<typeof vi.fn>;
  $off: ReturnType<typeof vi.fn>;
  $emit: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  listeners = new Map();
  bus = {
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

const emitPrompt = (prompt: string) =>
  (listeners.get(WORKBENCH_PROMPT_EVENT) ?? []).forEach((fn) => fn({ prompt }));

describe("useWorkbenchPrompt", () => {
  it("reports the login status to the host on mount", () => {
    renderHook(() =>
      useWorkbenchPrompt({ authenticated: true, ready: false, send: vi.fn() }),
    );
    expect(bus.$emit).toHaveBeenCalledWith(OCTOP_STATUS_EVENT, {
      status: "authenticated",
    });
  });

  it("queues a prompt until the agent is ready, then sends it once", () => {
    const send = vi.fn();
    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useWorkbenchPrompt({ authenticated: true, ready, send }),
      { initialProps: { ready: false } },
    );

    emitPrompt("先排队");
    expect(send).not.toHaveBeenCalled();

    rerender({ ready: true });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("先排队");

    rerender({ ready: true });
    expect(send).toHaveBeenCalledOnce();
  });

  it("sends immediately when the agent is already ready", () => {
    const send = vi.fn();
    renderHook(() =>
      useWorkbenchPrompt({ authenticated: true, ready: true, send }),
    );
    emitPrompt("直接发送");
    expect(send).toHaveBeenCalledWith("直接发送");
  });

  it("accepts delivery synchronously when it first announces login", () => {
    const accept = vi.fn();
    const send = vi.fn().mockResolvedValue(undefined);
    bus.$on(OCTOP_STATUS_EVENT, () => {
      bus.$emit(WORKBENCH_PROMPT_EVENT, { prompt: "首条提问", accept });
    });

    renderHook(() =>
      useWorkbenchPrompt({ authenticated: true, ready: true, send }),
    );

    expect(accept).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledExactlyOnceWith("首条提问");
  });

  it("waits for the first send before starting the next", async () => {
    let finishFirst!: () => void;
    const send = vi
      .fn()
      .mockResolvedValue(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirst = resolve;
          }),
      );
    renderHook(() =>
      useWorkbenchPrompt({ authenticated: true, ready: true, send }),
    );

    emitPrompt("第一条");
    emitPrompt("第二条");
    expect(send.mock.calls).toEqual([["第一条"]]);

    await act(async () => finishFirst());
    expect(send.mock.calls).toEqual([["第一条"], ["第二条"]]);
  });

  it("does not accept prompts while unauthenticated", () => {
    const send = vi.fn();
    renderHook(() =>
      useWorkbenchPrompt({ authenticated: false, ready: true, send }),
    );
    emitPrompt("需要登录");
    expect(send).not.toHaveBeenCalled();
  });
});
