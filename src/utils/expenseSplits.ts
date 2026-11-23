type SplitMethod =
    | { kind: "myself"; email: string }
    | { kind: "equally"; participants: string[] }
    | { kind: "specific"; amounts: Record<string, string> };

type SplitResult = {
    summary: string | null;
} & (
    | { kind: "valid"; splits: Record<string, number> }
    | { kind: "incomplete" }
    | { kind: "mismatch"; difference: string; direction: "under" | "over" }
    | { kind: "no-participants" }
    | { kind: "invalid-splits" }
);

function readDecimal(input: string) {
    // Number inputs can also emit scientific notation.
    const match = /^(\d*)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(input);
    if (!match || !(match[1] || match[2]) || !Number.isFinite(Number(input))) {
        return null;
    }

    const fraction = match[2] ?? "";
    const units = BigInt(match[1] + fraction);
    if (units === 0n) return { units, scale: 0 };
    // A nonzero entry must be representable in the numeric API payload.
    if (Number(input) === 0) return null;
    return { units, scale: fraction.length - Number(match[3] ?? 0) };
}

function formatDecimal(units: bigint, scale: number) {
    const digits = units.toString().padStart(scale + 1, "0");
    const fraction = digits.slice(-scale).replace(/0+$/, "").padEnd(2, "0");
    return `${digits.slice(0, -scale)}.${fraction}`;
}

export function evaluateExpenseSplit({
    amount,
    exchangeRate,
    method,
}: {
    amount: string;
    exchangeRate: number;
    method: SplitMethod;
}): SplitResult {
    const total = readDecimal(amount);
    if (!total || total.units === 0n) {
        return { kind: "incomplete", summary: null };
    }

    const baseAmount = Number(amount) * exchangeRate;
    if (method.kind === "myself") {
        return {
            kind: "valid",
            summary: null,
            splits: { [method.email]: Number(baseAmount.toFixed(3)) },
        };
    }

    if (method.kind === "equally") {
        if (method.participants.length === 0) {
            return { kind: "no-participants", summary: null };
        }

        const totalInCents = Math.round(baseAmount * 100);
        const participantCount = method.participants.length;
        const splitInCents = Math.floor(totalInCents / participantCount);
        const remainderCents = totalInCents - splitInCents * participantCount;
        return {
            kind: "valid",
            summary: null,
            splits: Object.fromEntries(
                method.participants.map((participant, index) => [
                    participant,
                    (splitInCents + (index < remainderCents ? 1 : 0)) / 100,
                ]),
            ),
        };
    }

    const values = Object.values(method.amounts).map(
        (value) => readDecimal(value || "0"),
    );
    const scale = values.reduce(
        (largest, value) => Math.max(largest, value?.scale ?? 0),
        Math.max(2, total.scale),
    );
    const totalUnits = total.units * 10n ** BigInt(scale - total.scale);
    let splitUnits = 0n;
    for (const value of values) {
        if (!value) return { kind: "invalid-splits", summary: null };
        splitUnits += value.units * 10n ** BigInt(scale - value.scale);
    }

    const summary = formatDecimal(splitUnits, scale);
    if (splitUnits !== totalUnits) {
        const over = splitUnits > totalUnits;
        const difference = over ? splitUnits - totalUnits : totalUnits - splitUnits;
        return {
            kind: "mismatch",
            summary,
            difference: formatDecimal(difference, scale),
            direction: over ? "over" : "under",
        };
    }

    const splits: Record<string, number> = {};
    for (const [user, value] of Object.entries(method.amounts)) {
        const baseShare = Math.round(Number(value) * exchangeRate * 100) / 100;
        if (Number.isFinite(baseShare) && baseShare > 0) splits[user] = baseShare;
    }
    return Object.keys(splits).length
        ? { kind: "valid", summary, splits }
        : { kind: "invalid-splits", summary };
}
