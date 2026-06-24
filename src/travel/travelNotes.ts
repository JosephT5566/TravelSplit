import { createStore, del, getMany, set } from "idb-keyval";

const NOTES_DATABASE = "travelsplit";
const NOTES_STORE = "travel-notes";
const STORAGE_VERSION = 1;
const travelNotesStore = createStore(NOTES_DATABASE, NOTES_STORE);

export interface TravelNote {
    version: typeof STORAGE_VERSION;
    tripId: string;
    dayId: string;
    markdown: string;
    updatedAt: string;
}

function noteKey(tripId: string, dayId: string) {
    return `${tripId}:${dayId}`;
}

function isTravelNote(value: unknown): value is TravelNote {
    if (!value || typeof value !== "object") return false;
    const note = value as TravelNote;
    return (
        note.version === STORAGE_VERSION &&
        typeof note.tripId === "string" &&
        typeof note.dayId === "string" &&
        typeof note.markdown === "string" &&
        typeof note.updatedAt === "string"
    );
}

export async function getTravelNotes(tripId: string, dayIds: readonly string[]) {
    const stored = await getMany<unknown>(
        dayIds.map((dayId) => noteKey(tripId, dayId)),
        travelNotesStore,
    );

    return dayIds.reduce<Record<string, string>>((notes, dayId, index) => {
        const note = stored[index];
        if (isTravelNote(note) && note.tripId === tripId && note.dayId === dayId) {
            notes[dayId] = note.markdown;
        }
        return notes;
    }, {});
}

export async function saveTravelNote(tripId: string, dayId: string, markdown: string) {
    const key = noteKey(tripId, dayId);
    if (!markdown.trim()) {
        await del(key, travelNotesStore);
        return;
    }

    const note: TravelNote = {
        version: STORAGE_VERSION,
        tripId,
        dayId,
        markdown,
        updatedAt: new Date().toISOString(),
    };
    await set(key, note, travelNotesStore);
}

export async function requestPersistentTravelStorage() {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return navigator.storage.persist();
}
