"use client";

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    AlertTriangle,
    Bike,
    BusFront,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleHelp,
    CloudRain,
    ExternalLink,
    FileText,
    Flag,
    Footprints,
    Hotel,
    Info,
    MapPin,
    NotebookPen,
    Navigation,
    PackageCheck,
    Route,
    ShieldAlert,
    ShoppingBag,
    Share2,
    Sun,
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
import { PackingChecklist } from "@/components/travel-books/shimanami/PackingChecklist";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/src/stores/AuthStore";
import {
    formatMonthDay,
    getDateInTimeZone,
    getEffectiveDayIndex,
} from "@/src/travel/date";
import {
    PREPARATION_ITEMS,
    SHIMANAMI_TRIP,
    type ShimanamiDay,
    type ShimanamiEvent,
    type ShimanamiEventType,
} from "@/src/travel/shimanami";
import { SHIMANAMI_TRAVEL_BOOK } from "@/src/travel/registry";
import {
    getTravelNotes,
    requestPersistentTravelStorage,
    saveTravelNote,
} from "@/src/travel/travelNotes";

const EVENT_ICON: Record<ShimanamiEventType, React.ComponentType<{ className?: string }>> = {
    transport: BusFront,
    activity: Footprints,
    food: Utensils,
    lodging: Hotel,
    cycling: Bike,
    task: Check,
    reminder: ShieldAlert,
};

const STATUS_LABEL = {
    confirmed: "已確認",
    "to-confirm": "待確認",
    cancelled: "已取消",
    informational: "行程資訊",
};

const PRIORITY_LABEL = {
    required: "必要",
    recommended: "建議",
    optional: "可選",
};

type NoteSaveStatus = "idle" | "saving" | "saved" | "error";

function EventCard({ event }: { event: ShimanamiEvent }) {
    const Icon = EVENT_ICON[event.type];
    const isOptional = event.priority === "optional";
    const isCompact = event.compact === true;

    return (
        <article
            className={cn(
                "relative rounded-[1.35rem] border bg-white shadow-[0_10px_28px_rgba(19,50,59,0.06)]",
                isCompact ? "p-3" : "p-4",
                isOptional ? "border-dashed border-[#9cb9c2] bg-[#f8fbfb]" : "border-[#d6e3e6]",
                event.status === "cancelled" && "opacity-55",
            )}
        >
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        "mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-[#d9eef3] text-[#126b8a]",
                        isCompact ? "size-8" : "size-10",
                    )}
                >
                    <Icon className={isCompact ? "size-4" : "size-[18px]"} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold tracking-wide text-[#126b8a]">
                            {event.time}
                        </span>
                        {event.priority && (
                            <span
                                className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                                    event.priority === "required" && "bg-[#17323b] text-white",
                                    event.priority === "recommended" && "bg-[#d9eef3] text-[#174d60]",
                                    event.priority === "optional" && "border border-[#9cb9c2] text-[#506a73]",
                                )}
                            >
                                {PRIORITY_LABEL[event.priority]}
                            </span>
                        )}
                        {event.status && event.status !== "informational" && (
                            <span
                                className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    event.status === "confirmed" && "bg-[#dcefe6] text-[#27664c]",
                                    event.status === "to-confirm" && "bg-[#fff1bf] text-[#795d00]",
                                    event.status === "cancelled" && "bg-[#eee] text-[#666]",
                                )}
                            >
                                {STATUS_LABEL[event.status]}
                            </span>
                        )}
                    </div>
                    <h3
                        className={cn(
                            "font-extrabold leading-snug text-[#17323b]",
                            isCompact ? "text-[15px]" : "text-[17px]",
                        )}
                    >
                        {event.title}
                    </h3>
                    {event.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#607983]">
                            <MapPin className="size-3.5" />
                            {event.location}
                        </p>
                    )}
                    {event.description && (
                        <p
                            className={cn(
                                "text-[#506a73]",
                                isCompact ? "mt-1.5 text-xs leading-5" : "mt-2 text-sm leading-6",
                            )}
                        >
                            {event.description}
                        </p>
                    )}
                    {event.options && (
                        <div className="mt-3 space-y-2" aria-label={`${event.title}選項`}>
                            {event.options.map((option, index) => (
                                <div
                                    key={option.id}
                                    className="rounded-xl border border-[#c8dce1] bg-[#f2f7f8] p-3"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#126b8a] font-mono text-[11px] font-black text-white">
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-extrabold text-[#17323b]">
                                                {option.title}
                                            </h4>
                                            {option.description && (
                                                <p className="mt-1 text-xs leading-5 text-[#607983]">
                                                    {option.description}
                                                </p>
                                            )}
                                            {option.links && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {option.links.map((link) => (
                                                        <a
                                                            key={link.url}
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#b8d1d8] bg-white px-3 text-[11px] font-bold text-[#126b8a] hover:bg-[#eaf5f7]"
                                                        >
                                                            <Navigation className="size-3.5" />
                                                            {link.label}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {event.highlight && (
                        <HighlightImage highlight={event.highlight} />
                    )}
                    {event.warning && (
                        <div className="mt-3 flex gap-2 rounded-xl bg-[#fff0ed] p-3 text-xs font-semibold leading-5 text-[#9b3f36]">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
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
                                    className={cn(
                                        "rounded-full border-[#b8d1d8] bg-white px-3 text-xs font-bold text-[#126b8a] hover:bg-[#eaf5f7]",
                                        isCompact ? "h-8" : "h-10",
                                    )}
                                >
                                    <a href={link.url} target="_blank" rel="noopener noreferrer">
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

function HighlightImage({
    highlight,
}: {
    highlight: NonNullable<ShimanamiEvent["highlight"]>;
}) {
    const [failed, setFailed] = React.useState(false);
    const showPlaceholder = !highlight.src || failed;

    return (
        <figure className="mt-3 overflow-hidden rounded-xl border border-[#d6e3e6] bg-[#eaf5f7]">
            {showPlaceholder ? (
                <div
                    className="flex aspect-[16/9] flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#d9eef3,#f7faf8)] px-5 text-center"
                    role="img"
                    aria-label={`${highlight.placeholderName}圖片預留位置`}
                >
                    <MapPin className="size-6 text-[#126b8a]" />
                    <span className="text-sm font-extrabold text-[#294852]">
                        {highlight.placeholderName}
                    </span>
                    <span className="text-[11px] font-medium text-[#607983]">
                        圖片預留位置
                    </span>
                </div>
            ) : (
                <img
                    src={highlight.src}
                    alt={highlight.alt}
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                    className="aspect-[16/9] w-full object-cover"
                />
            )}
            <figcaption className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] font-medium text-[#607983]">
                <span>旅程亮點 · {highlight.placeholderName}</span>
                {highlight.sourceUrl && highlight.sourceLabel && (
                    <a
                        href={highlight.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 font-bold text-[#126b8a] hover:underline"
                    >
                        圖片來源：{highlight.sourceLabel}
                    </a>
                )}
            </figcaption>
        </figure>
    );
}

function CyclingProgress({ cycling }: { cycling: NonNullable<ShimanamiDay["cycling"]> }) {
    return (
        <section className="overflow-hidden rounded-[1.5rem] bg-[#17323b] p-5 text-white">
            <div className="flex items-center gap-2 text-[#f2c94c]">
                <Route className="size-4" />
                <span className="text-xs font-extrabold tracking-[0.16em]">
                    {cycling.label}
                </span>
            </div>
            <p className="mt-3 text-xl font-black leading-snug">{cycling.route}</p>
            {cycling.routeImage && (
                <img
                    src={cycling.routeImage.src}
                    alt={cycling.routeImage.alt}
                    loading="lazy"
                    decoding="async"
                    className="mt-4 aspect-[16/9] w-full rounded-2xl object-cover"
                />
            )}
            
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-xs text-[#a9c7d0]">預計距離</p>
                    <p className="mt-1 font-bold">{cycling.distance}</p>
                </div>
                <div>
                    <p className="text-xs text-[#a9c7d0]">安全時段</p>
                    <p className="mt-1 whitespace-pre-line font-bold">{cycling.rideWindow}</p>
                </div>
            </div>
        </section>
    );
}

function WeatherForecast({ weather }: { weather: NonNullable<ShimanamiDay["weather"]> }) {
    const ariaLabel = `天氣預報：${weather.condition}，降雨機率 ${weather.precipitationProbability}%，最高 ${weather.morningCelsius} 度，最低 ${weather.nightCelsius} 度`;
    const className = "relative flex h-full flex-col justify-between gap-3 rounded-2xl border border-[#c8dce1] bg-[#eef6f8] px-3.5 py-3 text-[#294852]";
    const content = (
        <>
            <span className="text-xs font-extrabold tracking-[0.16em] text-[#17323b]">
                {weather.location}
            </span>
            {weather.link && (
                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-white text-[#126b8a] shadow-sm">
                    <ExternalLink className="size-3" aria-hidden="true" />
                </span>
            )}
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#126b8a] shadow-sm">
                    <CloudRain className="size-[18px]" />
                </span>
                <p className="text-sm font-extrabold leading-snug text-right">{weather.condition}</p>
            </div>
            <div>
                <p className="text-xs font-bold text-[#126b8a]">
                    降雨 {weather.precipitationProbability}%
                </p>
                <p className="mt-0.5 font-mono text-xs font-black text-[#17323b]">
                    上午: {weather.morningCelsius}
                </p>
                <p className="font-mono text-xs font-black text-[#17323b]">
                    下午: {weather.nightCelsius}
                </p>
            </div>
        </>
    );

    if (weather.link) {
        return (
            <a
                href={weather.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`${className} cursor-pointer no-underline transition hover:border-[#126b8a] hover:bg-white hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126b8a]`}
                aria-label={ariaLabel}
            >
                {content}
            </a>
        );
    }

    return (
        <section className={className} aria-label={ariaLabel}>
            {content}
        </section>
    );
}

function Checklist({
    items,
    storageKey,
    title,
}: {
    items: readonly { id: string; label: string }[];
    storageKey: string;
    title: string;
}) {
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
        <details className="group rounded-[1.5rem] border border-[#d6e3e6] bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 font-extrabold text-[#17323b] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-[#fff1bf] text-[#795d00]">
                        <ShoppingBag className="size-4" />
                    </span>
                    {title}
                    <span className="font-mono text-xs text-[#607983]">
                        {checked.length}/{items.length}
                    </span>
                </span>
                <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-1 border-t border-[#e2ebed] p-3">
                {items.map((item) => {
                    const active = checked.includes(item.id);
                    return (
                        <label
                            key={item.id}
                            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#f2f7f8]"
                        >
                            <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggle(item.id)}
                                className="sr-only"
                            />
                            <span
                                className={cn(
                                    "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                                    active
                                        ? "border-[#126b8a] bg-[#126b8a] text-white"
                                        : "border-[#9cb9c2] bg-white",
                                )}
                            >
                                {active && <Check className="size-4" strokeWidth={3} />}
                            </span>
                            <span
                                className={cn(
                                    "text-sm font-medium text-[#294852]",
                                    active && "text-[#7c9096] line-through",
                                )}
                            >
                                {item.label}
                            </span>
                        </label>
                    );
                })}
            </div>
        </details>
    );
}

function DayNoteDialog({
    day,
    note,
    loaded,
    saveStatus,
    onNoteChange,
    onClose,
}: {
    day: ShimanamiDay;
    note: string;
    loaded: boolean;
    saveStatus: NoteSaveStatus;
    onNoteChange: (markdown: string) => void;
    onClose: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [mode, setMode] = React.useState<"edit" | "preview">("edit");
    const hasNote = note.trim().length > 0;

    const setDialogOpen = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            onClose();
            setMode("edit");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={!loaded}
                    className={cn(
                        "h-11 w-full justify-start rounded-2xl border-[#b8d1d8] bg-white px-4 font-bold text-[#294852] hover:bg-[#eaf5f7] hover:text-[#126b8a]",
                        hasNote && "border-[#8fc0cc] bg-[#eaf5f7] text-[#126b8a]",
                        saveStatus === "error" && "border-[#efc1bb] bg-[#fff8f6] text-[#9b3f36]",
                    )}
                >
                    <NotebookPen className="size-4" />
                    {!loaded
                        ? "正在載入筆記…"
                        : hasNote
                          ? saveStatus === "error"
                              ? "編輯今日筆記 · 儲存失敗"
                              : saveStatus === "saving"
                                ? "編輯筆記 · 儲存中"
                                : "編輯筆記"
                          : "新增筆記"}
                </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden bg-[#f7faf8] p-0 sm:max-w-xl">
                <DialogHeader className="border-b border-[#d6e3e6] bg-white px-5 py-4 text-left">
                    <DialogTitle className="flex items-center gap-2 text-[#17323b]">
                        <NotebookPen className="size-5 text-[#126b8a]" />
                        {day.city} · 今日筆記
                    </DialogTitle>
                    <DialogDescription>
                        {day.date.replaceAll("-", ".")} · {day.weekday}。使用 Markdown 記下旅途中的想法與體驗。
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between gap-3 border-b border-[#d6e3e6] px-4 py-3">
                    <div
                        className="inline-flex rounded-xl border border-[#c8dce1] bg-white p-1"
                        role="tablist"
                        aria-label="筆記模式"
                    >
                        {(["edit", "preview"] as const).map((item) => (
                            <button
                                key={item}
                                type="button"
                                role="tab"
                                aria-selected={mode === item}
                                onClick={() => setMode(item)}
                                className={cn(
                                    "min-h-9 rounded-lg px-4 text-xs font-extrabold transition-colors",
                                    mode === item
                                        ? "bg-[#17323b] text-white"
                                        : "text-[#607983] hover:bg-[#f2f7f8]",
                                )}
                            >
                                {item === "edit" ? "編輯" : "預覽"}
                            </button>
                        ))}
                    </div>
                    <p
                        className={cn(
                            "text-xs font-bold",
                            saveStatus === "error" ? "text-[#9b3f36]" : "text-[#607983]",
                        )}
                        role="status"
                        aria-live="polite"
                    >
                        {saveStatus === "saving" && "儲存中…"}
                        {saveStatus === "saved" && "已儲存在此裝置"}
                        {saveStatus === "error" && "無法儲存，內容仍保留在此頁"}
                        {saveStatus === "idle" && "輸入後會自動儲存"}
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {mode === "edit" ? (
                        <textarea
                            value={note}
                            onChange={(event) => onNoteChange(event.target.value)}
                            placeholder={"# 今天的亮點\n\n- 看見了什麼？\n- 當下有什麼感受？\n- 想為這一天記住什麼？"}
                            aria-label={`${day.city}旅遊筆記 Markdown 編輯器`}
                            className="min-h-[52dvh] w-full resize-y rounded-2xl border border-[#b8d1d8] bg-white p-4 font-mono text-sm leading-7 text-[#294852] outline-none placeholder:text-[#91a4aa] focus:border-[#126b8a] focus:ring-2 focus:ring-[#126b8a]/20"
                        />
                    ) : hasNote ? (
                        <article className="min-h-[52dvh] rounded-2xl border border-[#d6e3e6] bg-white p-5 text-sm leading-7 text-[#294852]">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ children }) => <h1 className="mb-4 text-2xl font-black text-[#17323b]">{children}</h1>,
                                    h2: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-black text-[#17323b]">{children}</h2>,
                                    h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-extrabold text-[#17323b]">{children}</h3>,
                                    p: ({ children }) => <p className="my-3">{children}</p>,
                                    ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
                                    ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
                                    blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-[#8fc0cc] bg-[#eaf5f7] px-4 py-2 text-[#506a73]">{children}</blockquote>,
                                    code: ({ children }) => <code className="rounded bg-[#e7eef0] px-1.5 py-0.5 font-mono text-xs text-[#17323b]">{children}</code>,
                                    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-bold text-[#126b8a] underline underline-offset-2">{children}</a>,
                                    hr: () => <hr className="my-6 border-[#d6e3e6]" />,
                                }}
                            >
                                {note}
                            </ReactMarkdown>
                        </article>
                    ) : (
                        <div className="flex min-h-[52dvh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#b8d1d8] bg-white px-6 text-center">
                            <NotebookPen className="size-8 text-[#8fc0cc]" />
                            <p className="mt-3 font-extrabold text-[#294852]">還沒有可以預覽的內容</p>
                            <p className="mt-1 text-sm text-[#607983]">切換到「編輯」開始記錄今天的旅程。</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DayItinerary({
    day,
    showPreparation,
    storageKey,
    preparationTitle,
    note,
    notesLoaded,
    noteSaveStatus,
    onNoteChange,
    onNoteDialogClose,
}: {
    day: ShimanamiDay;
    showPreparation: boolean;
    storageKey: string;
    preparationTitle: string;
    note: string;
    notesLoaded: boolean;
    noteSaveStatus: NoteSaveStatus;
    onNoteChange: (markdown: string) => void;
    onNoteDialogClose: () => void;
}) {
    const headingId = `${day.id}-heading`;

    return (
        <div className="space-y-5">
            <section aria-labelledby={headingId}>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="font-mono text-xs font-bold tracking-[0.14em] text-[#126b8a]">
                            {day.date.replaceAll("-", ".")} · {day.weekday}
                        </p>
                        <h2
                            id={headingId}
                            className="mt-1 text-3xl font-black tracking-[-0.035em] text-[#17323b]"
                        >
                            {day.city}
                        </h2>
                    </div>
                    <span className="font-mono text-4xl font-black text-[#c9dde2]">
                        {day.dayLabel}
                    </span>
                </div>
                <p className="mt-3 text-lg font-extrabold leading-snug text-[#294852]">
                    {day.theme}
                </p>
                {(day.weather || day.note) && (
                    <div
                        className={cn(
                            "mt-3 grid gap-3",
                            day.weather && day.note ? "grid-cols-[30%_minmax(0,1fr)]" : "grid-cols-1",
                        )}
                    >
                        {day.weather && <WeatherForecast weather={day.weather} />}
                        {day.note && (
                            <div className="flex h-full items-center rounded-2xl border border-[#eadca7] border-l-[#f2c94c] bg-[#fffaf0] px-3.5 py-3">
                                <p className="text-sm leading-6 text-[#607983]">{day.note}</p>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {day.cycling && <CyclingProgress cycling={day.cycling} />}
            {showPreparation && (
                <Checklist
                    items={PREPARATION_ITEMS}
                    storageKey={storageKey}
                    title={preparationTitle}
                />
            )}

            <DayNoteDialog
                day={day}
                note={note}
                loaded={notesLoaded}
                saveStatus={noteSaveStatus}
                onNoteChange={onNoteChange}
                onClose={onNoteDialogClose}
            />

            <section className="relative space-y-4 pl-8" aria-label={`${day.city} 行程時間線`}>
                <div
                    aria-hidden="true"
                    className="absolute bottom-5 left-[13px] top-5 w-[5px] rounded-full bg-[#126b8a]"
                />
                {day.events.map((event, index) => (
                    <div key={event.id} className="relative">
                        <span
                            aria-hidden="true"
                            className={cn(
                                "absolute -left-[27px] top-6 z-10 size-[15px] rounded-full border-[3px] border-[#f7faf8]",
                                index === 0 ? "bg-[#f2c94c]" : "bg-[#126b8a]",
                            )}
                        />
                        <EventCard event={event} />
                    </div>
                ))}
                <span
                    aria-hidden="true"
                    className="absolute -left-[1px] bottom-0 flex size-7 items-center justify-center rounded-full bg-[#17323b] text-white"
                >
                    <Flag className="size-3.5" />
                </span>
            </section>

            {day.contingencies && (
                <details className="group overflow-hidden rounded-[1.5rem] border border-[#efc1bb] bg-[#fff8f6]">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 font-extrabold text-[#7f342d] [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-full bg-[#ffe4df]">
                                <CloudRain className="size-4" />
                            </span>
                            雨天／體力備案
                        </span>
                        <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-[#f0d4d0] p-4">
                        {day.contingencies.map((item) => (
                            <div key={item} className="flex gap-2 text-sm leading-6 text-[#714c47]">
                                <CircleHelp className="mt-1 size-4 shrink-0" />
                                <p>{item}</p>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

export function ShimanamiTravelBook() {
    const trip = SHIMANAMI_TRIP;
    const { isAuthInitialized, isSignedIn, user } = useAuthState();
    const showUserHeader = isAuthInitialized && isSignedIn && Boolean(user);
    const storageKey = `${SHIMANAMI_TRAVEL_BOOK.id}-preparation`;
    const packingStorageKey = `${SHIMANAMI_TRAVEL_BOOK.id}-packing-v1`;
    const days = trip.days;
    const [effectiveIndex, setEffectiveIndex] = React.useState(() =>
        getEffectiveDayIndex(days, new Date(), trip.timezone),
    );
    const [selectedIndex, setSelectedIndex] = React.useState(effectiveIndex);
    const [manualSelection, setManualSelection] = React.useState(false);
    const [offline, setOffline] = React.useState(false);
    const [shareStatus, setShareStatus] = React.useState("");
    const [carouselHeight, setCarouselHeight] = React.useState<number>();
    const [notes, setNotes] = React.useState<Record<string, string>>({});
    const [notesLoaded, setNotesLoaded] = React.useState(false);
    const [noteSaveStatuses, setNoteSaveStatuses] = React.useState<Record<string, NoteSaveStatus>>({});
    const [carouselRef, carouselApi] = useEmblaCarousel({
        align: "start",
        containScroll: "trimSnaps",
        duration: 24,
        startIndex: effectiveIndex,
    });
    const dateStripRef = React.useRef<HTMLDivElement>(null);
    const shareStatusTimerRef = React.useRef<number | null>(null);
    const noteSaveTimersRef = React.useRef(new Map<string, number>());
    const pendingNotesRef = React.useRef(new Map<string, string>());
    const noteRevisionsRef = React.useRef(new Map<string, number>());
    const persistenceRequestedRef = React.useRef(false);

    React.useEffect(() => {
        let cancelled = false;

        getTravelNotes(
            SHIMANAMI_TRAVEL_BOOK.id,
            days.map((day) => day.id),
        )
            .then((storedNotes) => {
                if (cancelled) return;
                setNotes(storedNotes);
                setNoteSaveStatuses(
                    Object.fromEntries(
                        days.map((day) => [
                            day.id,
                            storedNotes[day.id]?.trim() ? "saved" : "idle",
                        ]),
                    ),
                );
            })
            .catch(() => {
                if (cancelled) return;
                setNoteSaveStatuses(
                    Object.fromEntries(days.map((day) => [day.id, "error"])),
                );
            })
            .finally(() => {
                if (!cancelled) setNotesLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, [days]);

    const persistNote = React.useCallback(
        async (dayId: string, markdown: string, revision: number) => {
            try {
                await saveTravelNote(SHIMANAMI_TRAVEL_BOOK.id, dayId, markdown);
                if (noteRevisionsRef.current.get(dayId) === revision) {
                    setNoteSaveStatuses((current) => ({ ...current, [dayId]: "saved" }));
                }

                if (!persistenceRequestedRef.current) {
                    persistenceRequestedRef.current = true;
                    void requestPersistentTravelStorage().catch(() => {
                        // Persistence is a best-effort browser capability; the note itself is saved.
                    });
                }
            } catch {
                if (noteRevisionsRef.current.get(dayId) === revision) {
                    setNoteSaveStatuses((current) => ({ ...current, [dayId]: "error" }));
                }
            }
        },
        [],
    );

    const flushNote = React.useCallback(
        (dayId: string) => {
            const timer = noteSaveTimersRef.current.get(dayId);
            if (timer) window.clearTimeout(timer);
            noteSaveTimersRef.current.delete(dayId);

            const markdown = pendingNotesRef.current.get(dayId);
            if (markdown === undefined) return;
            pendingNotesRef.current.delete(dayId);
            const revision = noteRevisionsRef.current.get(dayId) ?? 0;
            void persistNote(dayId, markdown, revision);
        },
        [persistNote],
    );

    const updateNote = React.useCallback(
        (dayId: string, markdown: string) => {
            setNotes((current) => ({ ...current, [dayId]: markdown }));
            setNoteSaveStatuses((current) => ({ ...current, [dayId]: "saving" }));
            pendingNotesRef.current.set(dayId, markdown);
            noteRevisionsRef.current.set(dayId, (noteRevisionsRef.current.get(dayId) ?? 0) + 1);

            const currentTimer = noteSaveTimersRef.current.get(dayId);
            if (currentTimer) window.clearTimeout(currentTimer);
            noteSaveTimersRef.current.set(
                dayId,
                window.setTimeout(() => flushNote(dayId), 300),
            );
        },
        [flushNote],
    );

    React.useEffect(() => {
        const timers = noteSaveTimersRef.current;
        const pending = pendingNotesRef.current;
        const revisions = noteRevisionsRef.current;

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            pending.forEach((markdown, dayId) => {
                void persistNote(dayId, markdown, revisions.get(dayId) ?? 0);
            });
            timers.clear();
            pending.clear();
        };
    }, [persistNote]);

    const refreshEffectiveDay = React.useCallback(() => {
        const nextIndex = getEffectiveDayIndex(days, new Date(), trip.timezone);
        setEffectiveIndex(nextIndex);
        if (!manualSelection) {
            setSelectedIndex(nextIndex);
        }
    }, [days, manualSelection, trip.timezone]);

    React.useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "visible") refreshEffectiveDay();
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
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        dateStripRef.current
            ?.querySelector<HTMLElement>(`[data-day-index="${selectedIndex}"]`)
            ?.scrollIntoView({
                behavior: reduceMotion ? "auto" : "smooth",
                inline: "center",
                block: "nearest",
            });
    }, [selectedIndex]);

    React.useEffect(() => {
        if (!carouselApi || carouselApi.selectedScrollSnap() === selectedIndex) {
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

    React.useEffect(() => {
        return () => {
            if (shareStatusTimerRef.current) {
                window.clearTimeout(shareStatusTimerRef.current);
            }
        };
    }, []);

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
        shareStatusTimerRef.current = window.setTimeout(() => {
            setShareStatus("");
        }, 2500);
    };

    const copyCurrentUrl = async () => {
        const url = window.location.href;

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            return;
        }

        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();

        if (!copied) {
            throw new Error("Unable to copy URL");
        }
    };

    const shareTravelBook = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: SHIMANAMI_TRAVEL_BOOK.metadata.title,
                    text: SHIMANAMI_TRAVEL_BOOK.metadata.description,
                    url: window.location.href,
                });
                showShareStatus("分享選單已開啟");
                return;
            }

            await copyCurrentUrl();
            showShareStatus("連結已複製");
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            try {
                await copyCurrentUrl();
                showShareStatus("連結已複製");
            } catch {
                showShareStatus("無法複製連結");
            }
        }
    };

    return (
        <main lang="zh-Hant" className="min-h-full bg-[#f7faf8] text-[#17323b]">
            {showUserHeader && user && (
                <AppHeader
                    user={user}
                    brandHref="/"
                    accountDisabledLabel="旅遊手冊中無法開啟帳戶選單"
                />
            )}
            <header className="relative overflow-hidden bg-[#126b8a] px-5 pb-7 pt-8 text-white">
                <div
                    aria-hidden="true"
                    className="absolute -right-14 -top-20 size-64 rounded-full border-[28px] border-white/10"
                />
                <div
                    aria-hidden="true"
                    className="absolute -bottom-10 left-1/3 h-24 w-64 rotate-[-8deg] rounded-[100%] border-t-4 border-dashed border-[#f2c94c]/70"
                />
                <div className="relative mx-auto max-w-xl">
                    <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-[#cce7ed]">
                            TRAVEL BOOK · {trip.year}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white/12 px-3 py-1 font-mono text-[10px] font-bold">
                                {trip.timezoneLabel}
                            </span>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="開啟背包清單"
                                        title="背包清單"
                                        className="size-9 rounded-full bg-white/12 text-white hover:bg-white/20 hover:text-white"
                                    >
                                        <PackageCheck className="size-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-[#f7faf8] p-0 sm:max-w-xl">
                                    <DialogHeader className="sr-only">
                                        <DialogTitle>40L／10kg 背包清單</DialogTitle>
                                        <DialogDescription>
                                            管理旅行用品、打包狀態與預估重量。
                                        </DialogDescription>
                                    </DialogHeader>
                                    <PackingChecklist storageKey={packingStorageKey} />
                                </DialogContent>
                            </Dialog>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={shareTravelBook}
                                aria-label="分享旅遊手冊"
                                title="分享旅遊手冊"
                                className="size-9 rounded-full bg-white/12 text-white hover:bg-white/20 hover:text-white"
                            >
                                <Share2 className="size-4" />
                            </Button>
                        </div>
                    </div>
                    <p
                        aria-live="polite"
                        className={cn(
                            "absolute right-0 top-11 rounded-full bg-[#17323b] px-3 py-1.5 text-xs font-bold shadow-lg transition-opacity",
                            shareStatus ? "opacity-100" : "pointer-events-none opacity-0",
                        )}
                    >
                        {shareStatus}
                    </p>
                    <h1 className="mt-5 max-w-sm text-[2.55rem] font-black leading-[0.98] tracking-[-0.05em]">
                        {trip.heroTitle}
                        <br />
                        <span className="text-[#f2c94c]">{trip.heroAccent}</span>
                    </h1>
                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#d9eef3]">
                        <MapPin className="size-4" />
                        {trip.routeSummary}
                    </div>
                </div>
            </header>

            <div
                className={cn(
                    "sticky z-20 border-b border-[#c8dce1] bg-[#f7faf8]/95 backdrop-blur-md",
                    showUserHeader ? "top-16" : "top-0",
                )}
            >
                <div
                    ref={dateStripRef}
                    className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label="旅程日期"
                >
                    {days.map((item, index) => (
                        <button
                            key={item.id}
                            data-day-index={index}
                            type="button"
                            onClick={() => selectDay(index)}
                            aria-pressed={index === selectedIndex}
                            className={cn(
                                "relative min-w-[64px] rounded-2xl border px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126b8a] focus-visible:ring-offset-2",
                                index === selectedIndex
                                    ? "border-[#17323b] bg-[#17323b] text-white"
                                    : "border-[#d6e3e6] bg-white text-[#506a73]",
                            )}
                        >
                            <span className="block font-mono text-[10px] font-bold">{item.dayLabel}</span>
                            <span className="mt-0.5 block text-sm font-black">
                                {formatMonthDay(item.date)}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-bold">
                                {item.weekday}
                            </span>
                            {index === effectiveIndex && (
                                <span
                                    className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-[#f7faf8] bg-[#f2c94c]"
                                    aria-label="目前旅程日"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-5">
                {offline && (
                    <div className="flex items-center gap-2 rounded-xl bg-[#fff1bf] px-3 py-2 text-xs font-bold text-[#795d00]">
                        <WifiOff className="size-4" />
                        離線閱讀中，外部地圖與即時資訊可能無法開啟。
                    </div>
                )}

                {(beforeTrip || afterTrip) && selectedIndex === effectiveIndex && (
                    <div className="flex items-start gap-3 rounded-2xl border border-[#bfd9df] bg-[#eaf5f7] p-4 text-sm text-[#285c6d]">
                        <Info className="mt-0.5 size-5 shrink-0" />
                        <p>
                            {beforeTrip
                                ? "旅程尚未開始，先顯示第一天，方便完成行前準備。"
                                : "旅程已結束，保留最後一天作為旅行記錄。"}
                        </p>
                    </div>
                )}

                {manualSelection && (
                    <Button
                        onClick={returnToToday}
                        className="h-11 w-full rounded-full bg-[#126b8a] font-bold text-white hover:bg-[#0e5973]"
                    >
                        <Navigation className="size-4" />
                        回到目前旅程日
                    </Button>
                )}

                <div
                    ref={carouselRef}
                    className="overflow-hidden touch-pan-y transition-[height] duration-300 ease-out motion-reduce:transition-none"
                    style={{ height: carouselHeight }}
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="每日行程"
                >
                    <div className="flex items-start">
                        {days.map((item, index) => (
                            <div
                                key={item.id}
                                className="min-w-0 flex-[0_0_100%]"
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${index + 1} / ${days.length}`}
                                aria-hidden={index !== selectedIndex}
                                inert={index !== selectedIndex}
                            >
                                <DayItinerary
                                    day={item}
                                    showPreparation={
                                        index === selectedIndex &&
                                        index < trip.preparationVisibleThroughDay
                                    }
                                    storageKey={storageKey}
                                    preparationTitle={trip.preparationTitle}
                                    note={notes[item.id] ?? ""}
                                    notesLoaded={notesLoaded}
                                    noteSaveStatus={noteSaveStatuses[item.id] ?? "idle"}
                                    onNoteChange={(markdown) => updateNote(item.id, markdown)}
                                    onNoteDialogClose={() => flushNote(item.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <nav className="grid grid-cols-2 gap-3" aria-label="前後日期">
                    <Button
                        variant="outline"
                        disabled={selectedIndex === 0}
                        onClick={() => selectDay(selectedIndex - 1)}
                        className="h-12 rounded-2xl border-[#b8d1d8] bg-white font-bold text-[#294852]"
                    >
                        <ChevronLeft className="size-4" />
                        前一天
                    </Button>
                    <Button
                        variant="outline"
                        disabled={selectedIndex === days.length - 1}
                        onClick={() => selectDay(selectedIndex + 1)}
                        className="h-12 rounded-2xl border-[#b8d1d8] bg-white font-bold text-[#294852]"
                    >
                        後一天
                        <ChevronRight className="size-4" />
                    </Button>
                </nav>

                <a
                    href={trip.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-14 items-center justify-between rounded-2xl border border-[#d6e3e6] bg-white px-4 text-sm font-bold text-[#506a73] transition-colors hover:bg-[#f2f7f8]"
                >
                    <span className="flex items-center gap-3">
                        <FileText className="size-5 text-[#126b8a]" />
                        查看原始行程文件
                    </span>
                    <ExternalLink className="size-4" />
                </a>

                <p className="flex items-center justify-center gap-2 pb-2 text-center text-[11px] font-medium text-[#789098]">
                    <Sun className="size-3.5" />
                    安全優先。交通與營業資訊請於出發前再次確認。
                </p>
            </div>
        </main>
    );
}
