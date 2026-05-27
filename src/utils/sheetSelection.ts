export const SHEET_ID_STORAGE_KEY = "tripsplit_selected_sheet_id";
export const SHEET_ID_CHANGE_EVENT = "tripsplit_selected_sheet_id_change";

export function getAvailableSheetIds(): string[] {
    const rawSheetId = process.env.NEXT_PUBLIC_SHEET_ID;

    if (!rawSheetId) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawSheetId);
        if (Array.isArray(parsed)) {
            return parsed
                .filter(
                    (sheetId): sheetId is string => typeof sheetId === "string",
                )
                .map((sheetId) => sheetId.trim())
                .filter(Boolean);
        }
        if (typeof parsed === "string") {
            return [parsed.trim()].filter(Boolean);
        }
    } catch {
        // Fall through to plain string/comma separated parsing.
    }

    return rawSheetId
        .split(",")
        .map((sheetId) => sheetId.trim())
        .filter(Boolean);
}

export function isSheetSelectionRequired(): boolean {
    return getAvailableSheetIds().length > 1;
}

export function getSelectedSheetId(): string {
    const availableSheetIds = getAvailableSheetIds();

    if (availableSheetIds.length === 0) {
        throw new Error("Missing NEXT_PUBLIC_SHEET_ID env variable.");
    }

    if (typeof window === "undefined") {
        return availableSheetIds[0];
    }

    if (availableSheetIds.length === 1) {
        const [sheetId] = availableSheetIds;
        window.localStorage.setItem(SHEET_ID_STORAGE_KEY, sheetId);
        return sheetId;
    }

    const storedSheetId = window.localStorage.getItem(SHEET_ID_STORAGE_KEY);
    if (storedSheetId && availableSheetIds.includes(storedSheetId)) {
        return storedSheetId;
    }

    throw new Error("No Google Sheet selected.");
}

export function getStoredSheetId(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    const storedSheetId = window.localStorage.getItem(SHEET_ID_STORAGE_KEY);
    const availableSheetIds = getAvailableSheetIds();

    if (storedSheetId && availableSheetIds.includes(storedSheetId)) {
        return storedSheetId;
    }

    return null;
}

export function getActiveSheetIdOrNull(): string | null {
    const availableSheetIds = getAvailableSheetIds();

    if (availableSheetIds.length === 1) {
        return availableSheetIds[0];
    }

    return getStoredSheetId();
}

export function saveSelectedSheetId(sheetId: string) {
    window.localStorage.setItem(SHEET_ID_STORAGE_KEY, sheetId);
    window.dispatchEvent(new CustomEvent(SHEET_ID_CHANGE_EVENT));
}
