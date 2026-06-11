import type { Metadata } from "next";
import { ShimanamiTravelBook } from "@/components/travel-books/shimanami/ShimanamiTravelBook";
import { SHIMANAMI_TRAVEL_BOOK } from "@/src/travel/registry";

export const metadata: Metadata = {
    title: SHIMANAMI_TRAVEL_BOOK.metadata.title,
    description: SHIMANAMI_TRAVEL_BOOK.metadata.description,
};

export default function ShimanamiTravelBookPage() {
    return <ShimanamiTravelBook />;
}
