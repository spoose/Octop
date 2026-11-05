import { useCallback, useEffect, useRef } from "react";
import {
  reportOctopStatus,
  subscribeWorkbenchPrompt,
} from "../../../utils/workbenchBridge";

type UseWorkbenchPromptParams = {
  /** 当前用户是否已登录（由 AuthGuard 之后的会话决定）。 */
  authenticated: boolean;
  /** Agent 是否可以开始一轮对话。 */
  ready: boolean;
  /** 实际发送函数；需与 Chat 页现有发送链路一致（含 HITL 拦截）。 */
  send: (text: string) => Promise<void>;
};

/**
 * 嵌入工作台时，接收宿主转交的问题并在 Chat 就绪后自动发送。
 * - 问题先入队；在 Agent 就绪前不发送，避免丢失。
 * 独立运行时整个 hook 不产生副作用。
 */
export function useWorkbenchPrompt({
  authenticated,
  ready,
  send,
}: UseWorkbenchPromptParams): void {
  const queueRef = useRef<string[]>([]);
  const flushingRef = useRef(false);
  const sendRef = useRef(send);
  const readyRef = useRef(ready);
  sendRef.current = send;
  readyRef.current = authenticated && ready;

  const flush = useCallback(async () => {
    if (!readyRef.current || flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (readyRef.current && queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (next) await sendRef.current(next);
      }
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const unsubscribe = subscribeWorkbenchPrompt((prompt) => {
      queueRef.current.push(prompt);
      void flush();
      return true;
    });
    // Ask the host to flush again now that Chat can accept queued prompts.
    reportOctopStatus("authenticated");
    return unsubscribe;
  }, [authenticated, flush]);

  useEffect(() => {
    void flush();
  }, [authenticated, ready, flush]);
}
