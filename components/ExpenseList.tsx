import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Expense } from "../src/types";
import {
    differenceInDays,
    startOfDay,
    addDays,
    format,
} from "date-fns";
import { Plus, RefreshCw } from "lucide-react";
import { useAuthState } from "@/src/stores/AuthStore";
import { useConfig } from "@/src/stores/ConfigStore";
import useEmblaCarousel from "embla-carousel-react";
import { DayView } from "./DayView";
import { DateNavigator } from "./DateNavigator";
import classNames from "classnames";

interface Props {
    expenses: Expense[];
    onOpenExpenseForm: (expense?: Expense) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    onCurrentDateChange: (date: Date) => void;
}

export const ExpenseList: React.FC<Props> = ({
    expenses,
    onOpenExpenseForm,
    onRefresh,
    isRefreshing,
    onCurrentDateChange,
}) => {
    const { user } = useAuthState();
    const { sheetConfig } = useConfig();

    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: false,
        align: "center",
    });
    const [selectedIndex, setSelectedIndex] = useState(0);

    const allDates = useMemo(() => {
        if (!sheetConfig?.startDate) {
            return [];
        }
        const start = startOfDay(new Date(sheetConfig.startDate));
        const end = startOfDay(
            sheetConfig.endDate ? new Date(sheetConfig.endDate) : new Date()
        );
        const dates: Date[] = [];
        let currentDate = start;
        while (currentDate <= end) {
            dates.push(new Date(currentDate));
            currentDate = addDays(currentDate, 1);
        }
        return dates;
    }, [sheetConfig?.startDate]);

    const currentEmblaDate = useMemo(() => {
        return allDates[selectedIndex] || new Date();
    }, [allDates, selectedIndex]);

    useEffect(() => {
        onCurrentDateChange(currentEmblaDate);
    }, [currentEmblaDate, onCurrentDateChange]);

    const goToDate = useCallback(
        (date: Date) => {
            if (!emblaApi || !sheetConfig?.startDate) {
                return;
            }
            const startDate = startOfDay(new Date(sheetConfig.startDate));
            const targetDate = startOfDay(date);
            const diff = differenceInDays(targetDate, startDate);
            if (diff >= 0 && diff < allDates.length) {
                emblaApi.scrollTo(diff);
            }
        },
        [emblaApi, allDates, sheetConfig?.startDate]
    );

    useEffect(() => {
        if (!emblaApi) {
            return;
        }

        const onSelect = () => {
            setSelectedIndex(emblaApi.selectedScrollSnap());
        };

        emblaApi.on("select", onSelect);
        return () => {
            emblaApi.off("select", onSelect);
        };
    }, [emblaApi]);

    // Initial scroll to today's date
    useEffect(() => {
        if (allDates.length > 0 && emblaApi) {
            goToDate(new Date());
        }
    }, [allDates, emblaApi, goToDate]);

    return (
        <div className="overflow-x-hidden">
            <DateNavigator
                currentDate={currentEmblaDate}
                goToDate={goToDate}
                minDateStr={
                    sheetConfig?.startDate
                        ? format(new Date(sheetConfig.startDate), "yyyy-MM-dd")
                        : undefined
                }
                maxDateStr={
                    sheetConfig?.endDate
                        ? format(new Date(sheetConfig.endDate), "yyyy-MM-dd")
                        : format(new Date(), "yyyy-MM-dd")
                }
                expenses={expenses}
                user={user}
            />

            <div className="flex justify-end m-4 mb-2 px-2 gap-2">
                <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="text-sm flex items-center gap-1 text-primary font-medium bg-surface border border-border px-3 py-1.5 rounded-full hover:bg-background disabled:opacity-50"
                >
                    <RefreshCw
                        size={14}
                        className={isRefreshing ? "animate-spin" : ""}
                    />
                    Refresh
                </button>
            </div>

            <div className="embla overflow-hidden" ref={emblaRef}>
                <div className="embla__container flex">
                    {allDates.map((date, index) => (
                        <div
                            className={classNames(
                                "embla__slide",
                                "min-w-0 px-2 flex-[0_0_80%] first:ml-[10%] last:mr-[10%]"
                            )}
                            key={index}
                        >
                            <DayView
                                date={date}
                                expenses={expenses}
                                onOpenExpenseForm={onOpenExpenseForm}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <button
                onClick={() => onOpenExpenseForm()}
                className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-fg rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-transform hover:scale-105 active:scale-95 z-40"
                aria-label="Add Expense"
            >
                <Plus size={28} />
            </button>
        </div>
    );
};
