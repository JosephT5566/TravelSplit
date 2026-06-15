export type GoogleMapsTravelMode =
    | "driving"
    | "walking"
    | "bicycling"
    | "transit";

export const createGoogleMapsSearchUrl = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const createGoogleMapsDirectionsUrl = (
    origin: string,
    destination: string,
    waypoints: readonly string[] = [],
    travelMode: GoogleMapsTravelMode = "driving",
) => {
    const params = new URLSearchParams({
        api: "1",
        origin,
        destination,
        travelmode: travelMode,
    });

    if (waypoints.length > 0) {
        params.set("waypoints", waypoints.join("|"));
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
};
