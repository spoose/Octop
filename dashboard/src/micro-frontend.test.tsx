import { act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAppDocumentRoot, setEmbeddedRoot } from "./utils/appDocument";
import { syncDocumentLang } from "./utils/localePrefs";

const { initI18n } = vi.hoisted(() => {
  window.__POWERED_BY_QIANKUN__ = true;
  return { initI18n: vi.fn(() => Promise.resolve()) };
});
vi.mock("./i18n", () => ({ default: { language: "zh" }, initI18n }));
vi.mock("./App", () => ({
  default: function TestApp({ initialPath }: { initialPath: string }) {
    const [draft, setDraft] = useState("");
    return (
      <label>
        {initialPath}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
    );
  },
}));
import { mount, unmount } from "./micro-frontend";

describe("Octop micro frontend lifecycle", () => {
  let container: HTMLElement;
  beforeEach(() => {
    initI18n.mockResolvedValue(undefined);
    document.documentElement.lang = "en";
    container = document.createElement("section");
    container.innerHTML =
      '<div id="octop-micro-root"><div id="root"></div></div>';
    document.body.appendChild(container);
  });
  afterEach(async () => {
    await act(() => unmount());
    setEmbeddedRoot(null);
    container.remove();
  });

  it("scopes locale changes and resets UI state when remounted", async () => {
    await act(() => mount({ container, initialPath: "/login" }));
    const scope = container.querySelector<HTMLElement>("#octop-micro-root")!;
    expect(getAppDocumentRoot()).toBe(scope);
    expect(scope.lang).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("en");
    fireEvent.change(container.querySelector("input")!, {
      target: { value: "draft" },
    });
    expect(container.querySelector("input")!.value).toBe("draft");
    await act(() => unmount());
    expect(container.querySelector("input")).toBeNull();
    await act(() => mount({ container, initialPath: "/" }));
    expect(container.querySelector("input")!.value).toBe("");
    expect(container.querySelector("label")!.textContent).toBe("/");
  });

  it("does not render after unmount while initialization is pending", async () => {
    let finish!: () => void;
    initI18n.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = mount({ container });
    await unmount();
    finish();
    await act(() => pending);
    expect(container.querySelector("input")).toBeNull();
    syncDocumentLang("zh");
    expect(document.documentElement.lang).toBe("en");
  });

  it("rejects an invalid mount container before initialization", async () => {
    await expect(
      mount({ container: document.createElement("div") }),
    ).rejects.toThrow("root not found");
  });
});
