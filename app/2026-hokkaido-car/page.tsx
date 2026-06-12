import type { Metadata } from "next";
import { HokkaidoTravelBook } from "@/components/travel-books/hokkaido/HokkaidoTravelBook";
import { HOKKAIDO_CAR_TRAVEL_BOOK } from "@/src/travel/registry";

export const metadata: Metadata = {
    title: HOKKAIDO_CAR_TRAVEL_BOOK.metadata.title,
    description: HOKKAIDO_CAR_TRAVEL_BOOK.metadata.description,
};

export default function HokkaidoTravelBookPage() {
    return <HokkaidoTravelBook />;
}
