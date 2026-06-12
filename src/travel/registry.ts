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

export const HOKKAIDO_CAR_TRAVEL_BOOK = {
    id: "2026-hokkaido-car",
    path: "/2026-hokkaido-car",
    sourceDocumentIds: [
        "1KTb3yvRp3MPHajXC5oqxgHQb6AjHNmERxbrX0KcEHmc",
    ],
    title: "北海道自駕",
    eyebrow: "2026 ROAD BOOK",
    dateRange: "8/5–8/16",
    destinations: "道北、道東、美瑛、札幌",
    metadata: {
        title: "北海道自駕 2026 | TripSplit",
        description: "從新千歲一路前往宗谷岬、利尻、知床、阿寒湖、美瑛與札幌的十二日自駕手冊。",
    },
} satisfies TravelBookDefinition;

export const TRAVEL_BOOKS: readonly TravelBookDefinition[] = [
    SHIMANAMI_TRAVEL_BOOK,
    HOKKAIDO_CAR_TRAVEL_BOOK,
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
    const normalizedPath = pathname
        .replace(/\.html$/, "")
        .replace(/\/$/, "") || "/";

    return TRAVEL_BOOKS.some(
        (travelBook) => travelBook.path === normalizedPath,
    );
}
