"use client";

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
    AlertTriangle,
    BedDouble,
    CarFront,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock3,
    ExternalLink,
    FileText,
    Flag,
    Fuel,
    Hotel,
    Info,
    Map,
    MapPin,
    Mountain,
    Navigation,
    PackageCheck,
    Plane,
    Route,
    Sailboat,
    Share2,
    ShieldAlert,
    Sparkles,
    TrainFront,
    Utensils,
    WifiOff,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/src/stores/AuthStore";
import {
    getDateInTimeZone,
    getEffectiveDayIndex,
} from "@/src/travel/date";
import {
    HOKKAIDO_PREPARATION_ITEMS,
    HOKKAIDO_TRIP,
    type HokkaidoDay,
    type HokkaidoDrivingSegment,
    type HokkaidoEvent,
    type HokkaidoEventType,
    type HokkaidoWarningSeverity,
} from "@/src/travel/hokkaido";
import { HOKKAIDO_CAR_TRAVEL_BOOK } from "@/src/travel/registry";

const EVENT_ICON: Record<
    HokkaidoEventType,
    React.ComponentType<{ className?: string }>
> = {
    drive: CarFront,
    ferry: Sailboat,
    flight: Plane,
    transit: TrainFront,
    activity: Mountain,
    food: Utensils,
    lodging: Hotel,
    task: Check,
    reminder: Info,
    safety: ShieldAlert,
};

const STATUS_LABEL = {
    confirmed: "已確認",
    "to-confirm": "待確認",
    informational: "行程資訊",
};

const PRIORITY_LABEL = {
    required: "必要",
    recommended: "建議",
    optional: "可選",
};

const WARNING_STYLE: Record<HokkaidoWarningSeverity, string> = {
    notice: "border-[#d9cfea] bg-[#f3eff8] text-[#604d7e]",
    deadline: "border-[#efd57a] bg-[#fff8d9] text-[#725800]",
    safety: "border-[#efb4ac] bg-[#fff0ed] text-[#8b3931]",
};

const ROUTE_IMAGE_BY_DAY: Partial<Record<HokkaidoDay["id"], string>> = {
    "day-1": "https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-d1.jpg",
    "day-2": "https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-d2.jpg",
    "day-4": "https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-d4.jpg",
    "day-5": "https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-d5.jpg",
    "day-7": "https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-d7.jpg",
    "day-8": "https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-d8.jpg",
};

function RoadRibbon({
    driving,
    routeImageUrl,
}: {
    driving: HokkaidoDrivingSegment;
    routeImageUrl?: string;
}) {
    const routeStops = [
        driving.origin,
        ...driving.waypoints,
        driving.destination,
    ];
    const isLongDrive = driving.distanceKm >= 200;
    const isDriving = driving.mode === "driving";

    return (
        <section
            className={cn(
                "overflow-hidden rounded-[1.75rem] text-white shadow-[0_18px_45px_rgba(23,42,54,0.16)]",
                isLongDrive ? "bg-[#172a36]" : "bg-[#176b87]",
            )}
            aria-label={`今日交通：${driving.origin}到${driving.destination}，${driving.distanceKm}公里`}
        >
            <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-5">
                <div>
                    <p className="flex items-center gap-2 font-hokkaido-data text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">
                        <Route className="size-4 text-[#f4c542]" />
                        Today&apos;s road
                    </p>
                    <p className="mt-1 text-sm font-bold text-white/90">
                        {driving.mode === "parked"
                            ? "車留港口 · 今日搭船"
                            : driving.mode === "returned"
                                ? "租車已歸還 · 公共交通"
                                : isLongDrive
                                    ? "長途移動日"
                                    : "今日駕車"}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-hokkaido-data text-4xl font-bold leading-none tracking-[-0.04em] text-[#f4c542]">
                        {driving.distanceKm}
                    </p>
                    <p className="font-hokkaido-data text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                        kilometers
                    </p>
                </div>
            </div>

            {routeImageUrl ? (
                <img
                    src={routeImageUrl}
                    alt={`${driving.origin}到${driving.destination}路線圖`}
                    className="mx-5 mb-5 h-auto w-[calc(100%-2.5rem)] rounded-[1.25rem]"
                />
            ) : (
                <div className="relative mx-5 overflow-hidden rounded-[1.25rem] bg-[#101f28] px-4 py-5">
                    <div
                        aria-hidden="true"
                        className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#f4c542_0,#f4c542_12px,transparent_12px,transparent_23px)] opacity-80"
                    />
                    <ol className="relative z-10 space-y-4">
                        {routeStops.map((stop, index) => {
                            const edge =
                                index === 0 ||
                                index === routeStops.length - 1;
                            const leftSide = index % 2 === 0;
                            return (
                                <li
                                    key={`${stop}-${index}`}
                                    className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center"
                                >
                                    <div
                                        className={cn(
                                            "min-w-0 rounded-xl border px-3 py-2 text-xs font-bold leading-4",
                                            edge
                                                ? "border-[#f4c542]/55 bg-[#f4c542] text-[#172a36]"
                                                : "border-white/15 bg-white/10 text-white",
                                            leftSide
                                                ? "col-start-1 mr-3 justify-self-end text-right"
                                                : "col-start-3 ml-3 justify-self-start",
                                        )}
                                    >
                                        {stop}
                                    </div>
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "col-start-2 row-start-1 mx-auto size-3 rounded-full border-2 border-[#101f28]",
                                            edge
                                                ? "bg-[#f4c542]"
                                                : "bg-white",
                                        )}
                                    />
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}

            <div className="grid grid-cols-2 gap-px bg-white/10">
                <div className="bg-black/10 px-5 py-4">
                    <p className="font-hokkaido-data text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                        travel mode
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold">
                        {isDriving ? (
                            <CarFront className="size-4 text-[#f4c542]" />
                        ) : driving.mode === "parked" ? (
                            <Sailboat className="size-4 text-[#f4c542]" />
                        ) : (
                            <TrainFront className="size-4 text-[#f4c542]" />
                        )}
                        {isDriving
                            ? "自駕"
                            : driving.mode === "parked"
                                ? "渡輪"
                                : "公共交通"}
                    </p>
                </div>
                <div className="bg-black/10 px-5 py-4">
                    <p className="font-hokkaido-data text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                        drive time
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold">
                        <Clock3 className="size-4 text-[#f4c542]" />
                        {driving.duration || "不適用"}
                    </p>
                </div>
            </div>

            <div className="space-y-3 px-5 py-5">
                <p className="text-sm leading-6 text-white/80">{driving.note}</p>
                {driving.alerts?.map((alert) => (
                    <div
                        key={alert.label}
                        className={cn(
                            "flex gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold leading-5",
                            alert.severity === "safety" &&
                                "border-[#d95d4f]/40 bg-[#d95d4f]/20 text-[#ffd9d3]",
                            alert.severity === "deadline" &&
                                "border-[#f4c542]/35 bg-[#f4c542]/15 text-[#ffe99b]",
                            alert.severity === "notice" &&
                                "border-white/15 bg-white/10 text-white/80",
                        )}
                    >
                        {alert.severity === "safety" ? (
                            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                        ) : alert.severity === "deadline" ? (
                            <Clock3 className="mt-0.5 size-4 shrink-0" />
                        ) : (
                            <Info className="mt-0.5 size-4 shrink-0" />
                        )}
                        <span>{alert.label}</span>
                    </div>
                ))}
                {driving.mapUrl && (
                    <Button
                        asChild
                        className="h-11 w-full rounded-full bg-[#f4c542] font-bold text-[#172a36] hover:bg-[#f8d562]"
                    >
                        <a
                            href={driving.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Navigation className="size-4" />
                            開啟今日路線
                        </a>
                    </Button>
                )}
            </div>
        </section>
    );
}

function EventCard({ event }: { event: HokkaidoEvent }) {
    const Icon = EVENT_ICON[event.type];
    const optional = event.priority === "optional";

    return (
        <article
            className={cn(
                "rounded-[1.35rem] border bg-white p-4 shadow-[0_10px_28px_rgba(23,42,54,0.055)]",
                optional
                    ? "border-dashed border-[#b7a9ce] bg-[#fbf9fd]"
                    : "border-[#d8e0e2]",
            )}
        >
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full",
                        event.type === "safety"
                            ? "bg-[#fff0ed] text-[#d95d4f]"
                            : event.type === "lodging"
                                ? "bg-[#f0ecf6] text-[#8067a8]"
                                : "bg-[#e4f0f3] text-[#176b87]",
                    )}
                >
                    <Icon className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-hokkaido-data text-xs font-bold tracking-wide text-[#176b87]">
                            {event.time}
                        </span>
                        {event.priority && (
                            <span
                                className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    event.priority === "required" &&
                                        "bg-[#172a36] text-white",
                                    event.priority === "recommended" &&
                                        "bg-[#e4f0f3] text-[#14556b]",
                                    event.priority === "optional" &&
                                        "border border-[#b7a9ce] text-[#6c578e]",
                                )}
                            >
                                {PRIORITY_LABEL[event.priority]}
                            </span>
                        )}
                        {event.status && event.status !== "informational" && (
                            <span
                                className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    event.status === "confirmed"
                                        ? "bg-[#dff0e8] text-[#27664c]"
                                        : "bg-[#fff4c7] text-[#725800]",
                                )}
                            >
                                {STATUS_LABEL[event.status]}
                            </span>
                        )}
                    </div>
                    <h3 className="mt-1 text-[17px] font-black leading-snug text-[#172a36]">
                        {event.title}
                    </h3>
                    {event.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#627780]">
                            <MapPin className="size-3.5" />
                            {event.location}
                        </p>
                    )}
                    {event.description && (
                        <p className="mt-2 text-sm leading-6 text-[#516872]">
                            {event.description}
                        </p>
                    )}
                    {event.lodging && (
                        <div className="mt-3 rounded-xl border border-[#ded6e9] bg-[#f7f4fa] p-3">
                            <p className="flex items-center gap-2 text-sm font-black text-[#4f3e69]">
                                <BedDouble className="size-4" />
                                {event.lodging.name}
                            </p>
                            {event.lodging.secondaryName && (
                                <p className="mt-0.5 text-xs text-[#77698b]">
                                    {event.lodging.secondaryName}
                                </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {event.lodging.nights && (
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#5e5071]">
                                        連住 {event.lodging.nights} 晚
                                    </span>
                                )}
                                {event.lodging.meals && (
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#5e5071]">
                                        {event.lodging.meals}
                                    </span>
                                )}
                                {event.lodging.platform && (
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#5e5071]">
                                        {event.lodging.platform}
                                    </span>
                                )}
                                {event.lodging.payment && (
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#5e5071]">
                                        {event.lodging.payment}
                                    </span>
                                )}
                            </div>
                            <p className="mt-2 text-[10px] leading-4 text-[#857991]">
                                訂房代碼與私人連結請查看原始文件。
                            </p>
                        </div>
                    )}
                    {event.warning && (
                        <div
                            className={cn(
                                "mt-3 flex gap-2 rounded-xl border p-3 text-xs font-bold leading-5",
                                WARNING_STYLE[
                                    event.warningSeverity || "notice"
                                ],
                            )}
                        >
                            {event.warningSeverity === "safety" ? (
                                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                            ) : event.warningSeverity === "deadline" ? (
                                <Clock3 className="mt-0.5 size-4 shrink-0" />
                            ) : (
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            )}
                            <span>{event.warning}</span>
                        </div>
                    )}
                    {event.links && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {event.links.map((link) => (
                                <Button
                                    key={link.url}
                                    asChild
                                    variant="outline"
                                    className="h-10 rounded-full border-[#b9cdd2] bg-white px-3 text-xs font-bold text-[#176b87] hover:bg-[#edf5f6]"
                                >
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {link.kind === "map" ? (
                                            <Navigation className="size-3.5" />
                                        ) : (
                                            <ExternalLink className="size-3.5" />
                                        )}
                                        {link.label}
                                    </a>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

function PreparationChecklist({ storageKey }: { storageKey: string }) {
    const [checked, setChecked] = React.useState<string[]>([]);

    React.useEffect(() => {
        try {
            setChecked(JSON.parse(localStorage.getItem(storageKey) || "[]"));
        } catch {
            setChecked([]);
        }
    }, [storageKey]);

    const toggle = (id: string) => {
        setChecked((current) => {
            const next = current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id];
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });
    };

    return (
        <div className="p-5">
            <div className="rounded-2xl bg-[#172a36] p-4 text-white">
                <p className="font-hokkaido-data text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4c542]">
                    Before departure
                </p>
                <p className="mt-2 text-xl font-black">出發前要完成的事</p>
                <p className="mt-1 text-sm leading-6 text-white/65">
                    進度只儲存在這台裝置，不會改動原始文件或費用資料。
                </p>
            </div>
            <div className="mt-4 space-y-2">
                {HOKKAIDO_PREPARATION_ITEMS.map((item) => {
                    const active = checked.includes(item.id);
                    return (
                        <label
                            key={item.id}
                            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-[#d8e0e2] bg-white px-3 py-2 hover:bg-[#f4f8f8]"
                        >
                            <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggle(item.id)}
                                className="sr-only"
                            />
                            <span
                                className={cn(
                                    "flex size-7 shrink-0 items-center justify-center rounded-lg border-2",
                                    active
                                        ? "border-[#176b87] bg-[#176b87] text-white"
                                        : "border-[#9db2b8] bg-white",
                                )}
                            >
                                {active && (
                                    <Check className="size-4" strokeWidth={3} />
                                )}
                            </span>
                            <span
                                className={cn(
                                    "text-sm font-bold text-[#304852]",
                                    active &&
                                        "text-[#89999e] line-through",
                                )}
                            >
                                {item.label}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

function DayItinerary({ day }: { day: HokkaidoDay }) {
    const headingId = `${day.id}-heading`;
    const routeImageUrl = ROUTE_IMAGE_BY_DAY[day.id];

    return (
        <div className="space-y-5">
            <section aria-labelledby={headingId}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="font-hokkaido-data text-xs font-bold uppercase tracking-[0.16em] text-[#176b87]">
                            {day.date.replaceAll("-", ".")} · {day.weekday}
                        </p>
                        <p className="mt-2 text-xs font-bold text-[#8067a8]">
                            {day.region}
                        </p>
                        <h2
                            id={headingId}
                            className="mt-1 text-[2rem] font-black leading-tight tracking-[-0.04em] text-[#172a36]"
                        >
                            {day.destination}
                        </h2>
                    </div>
                    <span className="font-hokkaido-data text-5xl font-bold leading-none tracking-[-0.06em] text-[#cbd7da]">
                        {day.dayLabel}
                    </span>
                </div>
                <p className="mt-3 font-hokkaido-display text-xl font-bold leading-snug text-[#304852]">
                    {day.theme}
                </p>
                {day.note && (
                    <p className="mt-3 border-l-4 border-[#f4c542] pl-3 text-sm leading-6 text-[#627780]">
                        {day.note}
                    </p>
                )}
            </section>

            {day.driving && (
                <RoadRibbon
                    driving={day.driving}
                    routeImageUrl={routeImageUrl}
                />
            )}

            <section
                className="relative space-y-4 pl-8"
                aria-label={`${day.destination} 行程時間線`}
            >
                <div
                    aria-hidden="true"
                    className="absolute bottom-6 left-[13px] top-5 w-[5px] rounded-full bg-[#176b87]"
                />
                {day.events.map((event, index) => (
                    <div key={event.id} className="relative">
                        <span
                            aria-hidden="true"
                            className={cn(
                                "absolute -left-[27px] top-6 z-10 size-[15px] rounded-full border-[3px] border-[#f6f8f7]",
                                event.warningSeverity === "safety"
                                    ? "bg-[#d95d4f]"
                                    : index === 0
                                        ? "bg-[#f4c542]"
                                        : event.type === "lodging"
                                            ? "bg-[#8067a8]"
                                            : "bg-[#176b87]",
                            )}
                        />
                        <EventCard event={event} />
                    </div>
                ))}
                <span
                    aria-hidden="true"
                    className="absolute -left-[1px] bottom-0 flex size-7 items-center justify-center rounded-full bg-[#172a36] text-white"
                >
                    <Flag className="size-3.5" />
                </span>
            </section>
        </div>
    );
}

export function HokkaidoTravelBook() {
    const trip = HOKKAIDO_TRIP;
    const days = trip.days;
    const { isAuthInitialized, isSignedIn, user } = useAuthState();
    const showUserHeader = isAuthInitialized && isSignedIn && Boolean(user);
    const preparationStorageKey = `${HOKKAIDO_CAR_TRAVEL_BOOK.id}-preparation-v1`;
    const [effectiveIndex, setEffectiveIndex] = React.useState(() =>
        getEffectiveDayIndex(days, new Date(), trip.timezone),
    );
    const [selectedIndex, setSelectedIndex] = React.useState(effectiveIndex);
    const [manualSelection, setManualSelection] = React.useState(false);
    const [offline, setOffline] = React.useState(false);
    const [shareStatus, setShareStatus] = React.useState("");
    const [carouselHeight, setCarouselHeight] = React.useState<number>();
    const [carouselRef, carouselApi] = useEmblaCarousel({
        align: "start",
        containScroll: "trimSnaps",
        duration: 24,
        startIndex: effectiveIndex,
    });
    const dateStripRef = React.useRef<HTMLDivElement>(null);
    const shareStatusTimerRef = React.useRef<number | null>(null);

    const refreshEffectiveDay = React.useCallback(() => {
        const nextIndex = getEffectiveDayIndex(
            days,
            new Date(),
            trip.timezone,
        );
        setEffectiveIndex(nextIndex);
        if (!manualSelection) {
            setSelectedIndex(nextIndex);
        }
    }, [days, manualSelection, trip.timezone]);

    React.useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                refreshEffectiveDay();
            }
        };
        const onNetwork = () => setOffline(!navigator.onLine);
        const timer = window.setInterval(refreshEffectiveDay, 60_000);

        onNetwork();
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("online", onNetwork);
        window.addEventListener("offline", onNetwork);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("online", onNetwork);
            window.removeEventListener("offline", onNetwork);
        };
    }, [refreshEffectiveDay]);

    React.useEffect(() => {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        dateStripRef.current
            ?.querySelector<HTMLElement>(
                `[data-day-index="${selectedIndex}"]`,
            )
            ?.scrollIntoView({
                behavior: reduceMotion ? "auto" : "smooth",
                inline: "center",
                block: "nearest",
            });
    }, [selectedIndex]);

    React.useEffect(() => {
        if (
            !carouselApi ||
            carouselApi.selectedScrollSnap() === selectedIndex
        ) {
            return;
        }
        carouselApi.scrollTo(selectedIndex);
    }, [carouselApi, selectedIndex]);

    React.useEffect(() => {
        if (!carouselApi) {
            return;
        }

        const onSelect = () => {
            const nextIndex = carouselApi.selectedScrollSnap();
            setSelectedIndex(nextIndex);
            setManualSelection(nextIndex !== effectiveIndex);
        };

        carouselApi.on("select", onSelect);
        carouselApi.on("reInit", onSelect);
        return () => {
            carouselApi.off("select", onSelect);
            carouselApi.off("reInit", onSelect);
        };
    }, [carouselApi, effectiveIndex]);

    React.useEffect(() => {
        if (!carouselApi) {
            return;
        }

        const slide = carouselApi.slideNodes()[selectedIndex];
        if (!slide) {
            return;
        }

        const updateHeight = () => setCarouselHeight(slide.scrollHeight);
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(slide);
        return () => observer.disconnect();
    }, [carouselApi, selectedIndex]);

    React.useEffect(
        () => () => {
            if (shareStatusTimerRef.current) {
                window.clearTimeout(shareStatusTimerRef.current);
            }
        },
        [],
    );

    const currentTripDate = getDateInTimeZone(new Date(), trip.timezone);
    const beforeTrip = currentTripDate < trip.startDate;
    const afterTrip = currentTripDate > trip.endDate;

    const selectDay = (index: number) => {
        setSelectedIndex(index);
        setManualSelection(index !== effectiveIndex);
    };

    const returnToToday = () => {
        setManualSelection(false);
        setSelectedIndex(effectiveIndex);
    };

    const showShareStatus = (message: string) => {
        setShareStatus(message);
        if (shareStatusTimerRef.current) {
            window.clearTimeout(shareStatusTimerRef.current);
        }
        shareStatusTimerRef.current = window.setTimeout(
            () => setShareStatus(""),
            2500,
        );
    };

    const copyCurrentUrl = async () => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(window.location.href);
            return;
        }
        throw new Error("Clipboard unavailable");
    };

    const shareTravelBook = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: HOKKAIDO_CAR_TRAVEL_BOOK.metadata.title,
                    text: HOKKAIDO_CAR_TRAVEL_BOOK.metadata.description,
                    url: window.location.href,
                });
                return;
            }
            await copyCurrentUrl();
            showShareStatus("連結已複製");
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            showShareStatus("無法分享連結");
        }
    };

    return (
        <main
            lang="zh-Hant"
            className="min-h-full bg-[#f6f8f7] font-hokkaido-body text-[#172a36]"
        >
            {showUserHeader && user && (
                <AppHeader
                    user={user}
                    brandHref="/"
                    accountDisabledLabel="旅遊手冊中無法開啟帳戶選單"
                />
            )}

            <header className="relative aspect-[4/3] overflow-hidden bg-[#172a36] px-5 py-5 text-white md:aspect-auto md:min-h-[38rem] md:px-8 md:pb-10 md:pt-8 lg:px-12">
                <picture aria-hidden="true" className="absolute inset-0">
                    <source
                        media="(min-width: 768px)"
                        srcSet="https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-hero-dweb.jpg"
                    />
                    <img
                        src="https://cdn.josephtseng-tw.com/travel-split/2026-hokkaido-hero-mweb.jpg"
                        alt=""
                        className="size-full object-cover object-center"
                    />
                </picture>
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,25,34,0.82)_0%,rgba(10,25,34,0.52)_45%,rgba(10,25,34,0.08)_76%),linear-gradient(90deg,rgba(10,25,34,0.76)_0%,rgba(10,25,34,0.28)_58%,transparent_82%)] md:bg-[linear-gradient(180deg,rgba(10,25,34,0.72)_0%,rgba(10,25,34,0.18)_62%,transparent_85%),linear-gradient(90deg,rgba(10,25,34,0.8)_0%,rgba(10,25,34,0.42)_38%,transparent_68%)]"
                />

                <div className="relative mx-auto max-w-7xl">
                    <div className="flex items-center justify-between gap-3">
                        <p className="font-hokkaido-data text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9c8d2]">
                            Hokkaido road book · {trip.year}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white/10 px-3 py-1 font-hokkaido-data text-[10px] font-bold">
                                {trip.timezoneLabel}
                            </span>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="開啟行前清單"
                                        className="size-9 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                    >
                                        <PackageCheck className="size-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-[#f6f8f7] p-0 sm:max-w-xl">
                                    <DialogHeader className="sr-only">
                                        <DialogTitle>北海道行前清單</DialogTitle>
                                        <DialogDescription>
                                            管理渡輪、預約與裝備準備進度。
                                        </DialogDescription>
                                    </DialogHeader>
                                    <PreparationChecklist
                                        storageKey={preparationStorageKey}
                                    />
                                </DialogContent>
                            </Dialog>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={shareTravelBook}
                                aria-label="分享北海道旅遊手冊"
                                className="size-9 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
                            >
                                <Share2 className="size-4" />
                            </Button>
                        </div>
                    </div>

                    <p
                        aria-live="polite"
                        className={cn(
                            "absolute right-0 top-11 rounded-full bg-[#f4c542] px-3 py-1.5 text-xs font-bold text-[#172a36] shadow-lg transition-opacity",
                            shareStatus
                                ? "opacity-100"
                                : "pointer-events-none opacity-0",
                        )}
                    >
                        {shareStatus}
                    </p>

                    <div className="mt-5 max-w-md md:mt-10">
                        <p className="flex items-center gap-2 text-xs font-bold text-[#c9dbe0]">
                            <Sparkles className="size-4 text-[#f4c542]" />
                            12 DAYS · 1,368 KM PLANNED
                        </p>
                        <h1 className="mt-2 font-hokkaido-display text-[2.5rem] font-bold leading-[0.94] tracking-[-0.055em] md:mt-3 md:text-[3.2rem]">
                            {trip.heroTitle}
                            <br />
                            <span className="text-[#f4c542]">
                                {trip.heroAccent}
                            </span>
                        </h1>
                        <p className="mt-3 flex items-start gap-2 text-xs font-bold leading-5 text-[#c9dbe0] md:mt-5 md:text-sm md:leading-6">
                            <MapPin className="mt-1 size-4 shrink-0 text-[#8067a8]" />
                            {trip.routeSummary}
                        </p>
                    </div>

                    <div className="mt-4 grid max-w-md grid-cols-2 gap-2 md:mt-7">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="font-hokkaido-data text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                                rental car
                            </p>
                            <p className="mt-1 text-xs font-bold">
                                {trip.rentalPeriod}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="font-hokkaido-data text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                                longest day
                            </p>
                            <p className="mt-1 text-xs font-bold">
                                D8 · 220 km
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div
                className={cn(
                    "sticky z-20 border-b border-[#cad7da] bg-[#f6f8f7]/95 backdrop-blur-md",
                    showUserHeader ? "top-16" : "top-0",
                )}
            >
                <div
                    ref={dateStripRef}
                    className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label="旅程日期"
                >
                    {days.map((day, index) => (
                        <button
                            key={day.id}
                            type="button"
                            data-day-index={index}
                            onClick={() => selectDay(index)}
                            aria-pressed={index === selectedIndex}
                            className={cn(
                                "relative min-w-[64px] rounded-2xl border px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b87] focus-visible:ring-offset-2",
                                index === selectedIndex
                                    ? "border-[#172a36] bg-[#172a36] text-white"
                                    : "border-[#d8e0e2] bg-white text-[#627780]",
                            )}
                        >
                            <span className="block font-hokkaido-data text-[10px] font-bold">
                                {day.dayLabel}
                            </span>
                            <span className="mt-0.5 block font-hokkaido-data text-sm font-bold">
                                8/{Number(day.date.slice(8))}
                            </span>
                            {index === effectiveIndex && (
                                <span
                                    className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-[#f6f8f7] bg-[#f4c542]"
                                    aria-label="目前旅程日"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-5">
                {offline && (
                    <div className="flex items-center gap-2 rounded-xl bg-[#fff4c7] px-3 py-2 text-xs font-bold text-[#725800]">
                        <WifiOff className="size-4" />
                        離線閱讀中，地圖與外部網站可能無法開啟。
                    </div>
                )}

                {(beforeTrip || afterTrip) &&
                    selectedIndex === effectiveIndex && (
                        <div className="flex items-start gap-3 rounded-2xl border border-[#c5d8dd] bg-[#eaf3f5] p-4 text-sm leading-6 text-[#315d6b]">
                            <Info className="mt-0.5 size-5 shrink-0" />
                            <p>
                                {beforeTrip
                                    ? "旅程尚未開始，先顯示 D1，方便完成預約與裝備準備。"
                                    : "旅程已結束，保留 D12 作為旅行記錄。"}
                            </p>
                        </div>
                    )}

                {manualSelection && (
                    <Button
                        onClick={returnToToday}
                        className="h-11 w-full rounded-full bg-[#176b87] font-bold text-white hover:bg-[#145a72]"
                    >
                        <Navigation className="size-4" />
                        回到目前旅程日
                    </Button>
                )}

                <div
                    ref={carouselRef}
                    className="touch-pan-y overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
                    style={{ height: carouselHeight }}
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="北海道每日行程"
                >
                    <div className="flex items-start">
                        {days.map((day, index) => (
                            <div
                                key={day.id}
                                className="min-w-0 flex-[0_0_100%]"
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${index + 1} / ${days.length}`}
                                aria-hidden={index !== selectedIndex}
                                inert={index !== selectedIndex}
                            >
                                <DayItinerary day={day} />
                            </div>
                        ))}
                    </div>
                </div>

                <nav className="grid grid-cols-2 gap-3" aria-label="前後日期">
                    <Button
                        variant="outline"
                        disabled={selectedIndex === 0}
                        onClick={() => selectDay(selectedIndex - 1)}
                        className="h-12 rounded-2xl border-[#b9cdd2] bg-white font-bold text-[#304852]"
                    >
                        <ChevronLeft className="size-4" />
                        前一天
                    </Button>
                    <Button
                        variant="outline"
                        disabled={selectedIndex === days.length - 1}
                        onClick={() => selectDay(selectedIndex + 1)}
                        className="h-12 rounded-2xl border-[#b9cdd2] bg-white font-bold text-[#304852]"
                    >
                        後一天
                        <ChevronRight className="size-4" />
                    </Button>
                </nav>

                <a
                    href={trip.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-14 items-center justify-between rounded-2xl border border-[#d8e0e2] bg-white px-4 text-sm font-bold text-[#516872] transition-colors hover:bg-[#f0f5f5]"
                >
                    <span className="flex items-center gap-3">
                        <FileText className="size-5 text-[#176b87]" />
                        查看原始行程文件
                    </span>
                    <ExternalLink className="size-4" />
                </a>

                <div className="flex items-center justify-center gap-4 pb-2 text-[11px] font-bold text-[#819298]">
                    <span className="flex items-center gap-1.5">
                        <Fuel className="size-3.5" />
                        半箱油就補滿
                    </span>
                    <span className="h-3 w-px bg-[#cbd5d8]" />
                    <span className="flex items-center gap-1.5">
                        <Map className="size-3.5" />
                        時刻與路況再確認
                    </span>
                </div>
            </div>
        </main>
    );
}
