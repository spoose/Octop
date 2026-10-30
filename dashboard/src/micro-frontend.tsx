import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import i18n, { initI18n } from "./i18n";
import { setEmbeddedRoot } from "./utils/appDocument";
import { normalizeUiLocale, syncDocumentLang } from "./utils/localePrefs";
import "./styles/micro-frontend.css";

interface MountProps {
  container: HTMLElement;
  initialPath?: string;
}

let root: Root | null = null;
let mountVersion = 0;

export async function bootstrap(): Promise<void> {}

export async function mount({ container, initialPath = "/" }: MountProps) {
  const scope = container.querySelector<HTMLElement>("#octop-micro-root");
  const node = scope?.querySelector<HTMLElement>("#root");
  if (!scope || !node) throw new Error("Octop micro frontend root not found");
  const version = ++mountVersion;
  setEmbeddedRoot(scope);
  await initI18n();
  if (version !== mountVersion) return;
  syncDocumentLang(normalizeUiLocale(i18n.language));
  root = createRoot(node);
  root.render(<App embedded initialPath={initialPath} />);
}

export async function unmount(): Promise<void> {
  mountVersion++;
  root?.unmount();
  root = null;
  // Pending async effects keep their detached scope instead of writing to the host.
}

if (!window.__POWERED_BY_QIANKUN__) {
  void mount({ container: document.body });
}
