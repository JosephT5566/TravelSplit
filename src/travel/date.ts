export function getDateInTimeZone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(
        parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
}

export function getEffectiveDayIndex<T extends { date: string }>(
    days: readonly T[],
    now: Date,
    timeZone: string,
) {
    const currentDate = getDateInTimeZone(now, timeZone);
    const exactIndex = days.findIndex((day) => day.date === currentDate);

    if (exactIndex >= 0) {
        return exactIndex;
    }

    return currentDate < days[0].date ? 0 : days.length - 1;
}
