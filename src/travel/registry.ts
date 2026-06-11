import type {
    TravelBookDefinition,
    TravelResource,
} from "./types";

export const SHIMANAMI_TRAVEL_BOOK = {
    id: "2026-shimanami",
    path: "/2026-shimanami",
    sourceDocumentIds: [
        "11DVuL-VuJ-lVM6jNDhGosmNbzv4EdSEdew1zfslHdLI",
    ],
    title: "瀨戶內・島波海道",
    eyebrow: "2026 TRAVEL BOOK",
    dateRange: "6/25–7/2",
    destinations: "岡山、尾道、今治、松山",
    metadata: {
        title: "瀨戶內・島波海道 2026 | TripSplit",
        description: "岡山、尾道、島波海道、今治與松山的八日行動旅行手冊。",
    },
} satisfies TravelBookDefinition;

export const TRAVEL_BOOKS: readonly TravelBookDefinition[] = [
    SHIMANAMI_TRAVEL_BOOK,
];

export function resourceMatchesTravelBook(
    resource: TravelResource,
    travelBook: TravelBookDefinition,
) {
    if (!resource.url) {
        return false;
    }

    return travelBook.sourceDocumentIds.some((documentId) =>
        resource.url?.includes(`/document/d/${documentId}`),
    );
}

export function getTravelBooksForResources(
    resources: readonly TravelResource[],
) {
    return TRAVEL_BOOKS.filter((travelBook) =>
        resources.some((resource) =>
            resourceMatchesTravelBook(resource, travelBook),
        ),
    );
}

export function isPublicTravelBookPath(pathname: string) {
    return TRAVEL_BOOKS.some((travelBook) => travelBook.path === pathname);
}
