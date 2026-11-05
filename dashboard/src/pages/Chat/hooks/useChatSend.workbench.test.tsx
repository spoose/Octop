import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatSend } from "./useChatSend";

const { navigate, showError } = vi.hoisted(() => ({
  navigate: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/utils/antdMessage", () => ({ message: { error: showError } }));
vi.mock("./useSessions", () => ({}));
vi.mock("./chatStore", () => ({}));

function setup(resolvedId: Promise<string>) {
  navigate.mockClear();
  showError.mockClear();
  const sendMessage = vi.fn();
  const renameSession = vi.fn();
  const { result } = renderHook(() =>
    useChatSend({
      resolvedAgentId: "know-bot",
      activeThreadId: "thr_old",
      sessions: [],
      messagesLength: 3,
      selectedModel: null,
      selectedConnectors: [],
      selectedKnowledgeBaseIds: [],
      reasoningMode: "auto",
      reasoningEffort: null,
      sendMessage,
      createSession: () => ({
        session: {
          id: "__pending__",
          name: "New Chat",
          threadId: "",
          updatedAt: null,
          channelType: "dashboard",
        },
        resolvedId,
      }),
      renameSession,
      t: ((key: string) => key) as Parameters<typeof useChatSend>[0]["t"],
    }),
  );
  return { result, sendMessage, renameSession };
}

describe("workbench prompt session", () => {
  it("waits for a new thread and sends the prompt to it instead of the active thread", async () => {
    let resolveThread!: (id: string) => void;
    const resolvedId = new Promise<string>((resolve) => {
      resolveThread = resolve;
    });
    const { result, sendMessage, renameSession } = setup(resolvedId);
    const sent = result.current.sendNewThread("今日菜单");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      resolveThread("thr_new");
      expect(await sent).toBe(true);
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0].slice(0, 5)).toEqual([
      "今日菜单",
      "",
      "know-bot",
      undefined,
      "thr_new",
    ]);
    expect(renameSession).toHaveBeenCalledWith("thr_new", "今日菜单");
    expect(navigate).toHaveBeenCalledWith("/chat/know-bot/thr_new");
  });

  it("returns failure without sending into the old thread if creation fails", async () => {
    const { result, sendMessage } = setup(Promise.resolve(""));
    await expect(result.current.sendNewThread("今日菜单")).resolves.toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledOnce();
  });
});
