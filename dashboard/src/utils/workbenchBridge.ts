import { useEffect } from "react";
import { isEmbeddedApp } from "./appRuntime";

/**
 * 工作台（wujie 宿主）与 Octop 之间的最小协议。
 * 宿主 → 子应用：`workbench:hello`（请求重新上报状态）、`workbench:prompt`（提交问题）。
 * 子应用 → 宿主：`octop:status`（登录状态）。
 */
export const WORKBENCH_HELLO_EVENT = "workbench:hello";
export const WORKBENCH_PROMPT_EVENT = "workbench:prompt";
export const OCTOP_STATUS_EVENT = "octop:status";

type WorkbenchAuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "offline";
export type WorkbenchPromptPayload = { prompt: string; accept?: () => void };

type WujieBus = {
  $on: (event: string, fn: (...args: unknown[]) => void) => unknown;
  $off: (event: string, fn: (...args: unknown[]) => void) => unknown;
  $emit: (event: string, ...args: unknown[]) => unknown;
};

const getBus = (): WujieBus | undefined =>
  window.$wujie?.bus as WujieBus | undefined;

/** 嵌入模式下向宿主上报登录状态。独立运行时不做任何事。 */
export function reportOctopStatus(status: WorkbenchAuthStatus): void {
  if (!isEmbeddedApp()) return;
  getBus()?.$emit(OCTOP_STATUS_EVENT, { status });
}

/** 上报认证状态，并在工作台首页重新挂载时回应查询。 */
export function useWorkbenchAuthStatus(status: WorkbenchAuthStatus): void {
  useEffect(() => {
    if (!isEmbeddedApp()) return;
    const bus = getBus();
    if (!bus) return;

    const report = () => reportOctopStatus(status);
    bus.$on(WORKBENCH_HELLO_EVENT, report);
    report();
    return () => {
      bus.$off(WORKBENCH_HELLO_EVENT, report);
    };
  }, [status]);
}

/** 嵌入模式下接收工作台提问。 */
export function subscribeWorkbenchPrompt(
  receive: (prompt: string) => boolean,
): () => void {
  if (!isEmbeddedApp()) return () => undefined;
  const bus = getBus();
  if (!bus) return () => undefined;

  const onPrompt = (payload: unknown) => {
    const request = payload as Partial<WorkbenchPromptPayload> | undefined;
    const prompt = request?.prompt;
    if (typeof prompt !== "string") return;
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (receive(trimmed) && typeof request?.accept === "function") {
      request.accept();
    }
  };

  bus.$on(WORKBENCH_PROMPT_EVENT, onPrompt);
  return () => {
    bus.$off(WORKBENCH_PROMPT_EVENT, onPrompt);
  };
}
