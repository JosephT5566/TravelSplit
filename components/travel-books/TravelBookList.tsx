import { TravelBookCard } from "./TravelBookCard";
import { getTravelBooksForResources } from "@/src/travel/registry";
import type { TravelResource } from "@/src/travel/types";

export function TravelBookList({
    resources,
}: {
    resources: readonly TravelResource[];
}) {
    const travelBooks = getTravelBooksForResources(resources);

    if (travelBooks.length === 0) {
        return null;
    }

    return (
        <section className="grid grid-cols-1 gap-4" aria-label="旅行手冊">
            {travelBooks.map((travelBook) => (
                <TravelBookCard
                    key={travelBook.id}
                    travelBook={travelBook}
                />
            ))}
        </section>
    );
}
