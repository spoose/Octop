import { getAppAssetUrl } from "../utils/appDocument";
/**
 * Shared empty-state mascot (served from ``dashboard/public``).
 * Prefer ``OctopEmptyMascot`` / ``EmptyState variant="mascot"`` over hardcoding.
 */
export const OCTOP_EMPTY_MASCOT_SRC = getAppAssetUrl("/octop-mascot-empty.png");
