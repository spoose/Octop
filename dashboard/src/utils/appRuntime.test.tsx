import { act, render, screen } from "@testing-library/react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppLocation, reloadApp, replaceAppRoute } from "./appRuntime";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("app runtime", () => {
  it("uses the ordinary browser location and navigation when standalone", () => {
    const replace = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal("location", { replace, reload });

    expect(getAppLocation()).toBe(window.location);
    replaceAppRoute("/login");
    reloadApp();

    expect(replace).toHaveBeenCalledWith("/login");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("updates BrowserRouter without replacing the iframe document", () => {
    vi.stubGlobal("__POWERED_BY_WUJIE__", true);
    window.history.replaceState({ idx: 0 }, "", "/chat");
    function Route() {
      const location = useLocation();
      return <output aria-label="route">{location.pathname}</output>;
    }
    render(
      <BrowserRouter>
        <Route />
      </BrowserRouter>,
    );

    act(() => replaceAppRoute("/login"));

    expect(screen.getByLabelText("route")).toHaveTextContent("/login");
    expect(window.history.state).toEqual({ idx: 0 });
  });

  it("delegates embedded reload to the host exactly once", () => {
    const reload = vi.fn();
    const location = new URL("https://octop.example.test/chat");
    vi.stubGlobal("$wujie", { location, props: { reload } });

    expect(getAppLocation()).toBe(location);
    reloadApp();

    expect(reload).toHaveBeenCalledOnce();
  });
});
