import Link from "next/link";
import { ArrowRight, Bike, CarFront } from "lucide-react";
import type { TravelBookDefinition } from "@/src/travel/types";

export function TravelBookCard({
    travelBook,
}: {
    travelBook: TravelBookDefinition;
}) {
    const isRoadBook = travelBook.id === "2026-hokkaido-car";
    const Icon = isRoadBook ? CarFront : Bike;

    return (
        <Link
            href={travelBook.path}
            className={
                isRoadBook
                    ? "group relative block overflow-hidden rounded-[1.5rem] bg-[#172a36] p-5 text-white shadow-lg transition-transform active:scale-[0.98]"
                    : "group relative block overflow-hidden rounded-[1.5rem] bg-[#126b8a] p-5 text-white shadow-lg transition-transform active:scale-[0.98]"
            }
        >
            <div className="absolute -right-8 -top-10 size-36 rounded-full border-[18px] border-white/10" />
            {isRoadBook && (
                <div
                    aria-hidden="true"
                    className="absolute -bottom-14 right-12 h-40 w-20 rounded-t-full bg-black/15"
                >
                    <div className="mx-auto h-full w-0.5 bg-[repeating-linear-gradient(to_bottom,#f4c542_0,#f4c542_10px,transparent_10px,transparent_20px)]" />
                </div>
            )}
            <div className="relative">
                <div className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-[#f2c94c]">
                    <Icon size={16} />
                    {travelBook.eyebrow}
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight">
                    {travelBook.title}
                </h2>
                <p className="mt-1 text-sm text-[#d9eef3]">
                    {travelBook.dateRange} · {travelBook.destinations}
                </p>
                <span className="mt-5 flex items-center gap-2 text-sm font-bold">
                    開啟旅行手冊
                    <ArrowRight
                        size={16}
                        className="transition-transform group-hover:translate-x-1"
                    />
                </span>
            </div>
        </Link>
    );
}
