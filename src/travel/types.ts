export interface TravelBookDefinition {
    id: string;
    path: `/${string}`;
    sourceDocumentIds: string[];
    title: string;
    eyebrow: string;
    dateRange: string;
    destinations: string;
    metadata: {
        title: string;
        description: string;
    };
}

export interface TravelResource {
    url?: string;
}
