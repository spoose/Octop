import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileAvatar, ProfileAvatarPicker } from "./ProfileAvatar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../hooks/useAuthImageSrc", () => ({
  useAuthImageSrc: (url: string) => ({
    src: url || "",
    loadState: url ? "ready" : "idle",
  }),
}));

describe("ProfileAvatar", () => {
  it("keeps the Lucide default when no icon is chosen", () => {
    const { container, rerender } = render(<ProfileAvatar />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();

    rerender(<ProfileAvatar icon={null} />);
    expect(container.querySelector("svg")).toBeTruthy();

    rerender(<ProfileAvatar icon="user" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a cropped portrait for a selected sample", () => {
    const { container } = render(<ProfileAvatar icon="doctor" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBeTruthy();
    expect(img?.className).toMatch(/presetPortraitImg/);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to the Lucide default for unknown icons", () => {
    const { container } = render(<ProfileAvatar icon="business" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a Lucide role sample instead of a portrait", () => {
    const { container } = render(<ProfileAvatar kind="role" icon="award" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("ProfileAvatarPicker", () => {
  it("offers the seven new samples and saves the selected id", async () => {
    const onSelectIcon = vi.fn();
    render(
      <ProfileAvatarPicker onPick={vi.fn()} onSelectIcon={onSelectIcon} />,
    );
    for (let i = 1; i <= 7; i++) {
      const button = screen.getByRole("button", {
        name: `adminUsers.avatarSample${i}`,
      });
      expect(button.querySelector("img")).toBeTruthy();
    }
    await userEvent.click(
      screen.getByRole("button", { name: "adminUsers.avatarSample1" }),
    );
    expect(onSelectIcon).toHaveBeenCalledWith("sample-1793347196559");
  });

  it("selecting the default sample saves a null icon", async () => {
    const onSelectIcon = vi.fn();
    render(
      <ProfileAvatarPicker
        icon="doctor"
        onPick={vi.fn()}
        onSelectIcon={onSelectIcon}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "adminUsers.avatarDefault" }),
    );
    expect(onSelectIcon).toHaveBeenCalledWith(null);
  });
});
