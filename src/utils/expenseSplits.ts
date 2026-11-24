type SplitMethod =
    | { kind: "single"; email: string }
    | { kind: "equally"; participants: string[] }
    | { kind: "specific"; amounts: Record<string, string> };

export type ExpenseCalculation = {
    amount: string;
    exchangeRate: string;
    method: SplitMethod;
};

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

function allocateCents(totalCents: bigint, weights: [string, bigint][]) {
    const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0n);
    const allocations = weights.map(([email, weight]) => {
        const numerator = totalCents * weight;
        return {
            email,
            cents: numerator / totalWeight,
            remainder: numerator % totalWeight,
        };
    });

    allocations.sort((a, b) => {
        if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
        return a.email < b.email ? -1 : a.email > b.email ? 1 : 0;
    });

    const allocated = allocations.reduce((sum, share) => sum + share.cents, 0n);
    const remainderCents = Number(totalCents - allocated);
    return Object.fromEntries(
        allocations.map(({ email, cents }, index) => [
            email,
            (Number(cents) + (index < remainderCents ? 1 : 0)) / 100,
        ]),
    );
}

export function evaluateExpenseSplit({
    amount,
    exchangeRate,
    method,
}: {
    amount: string;
    exchangeRate: number | string;
    method: SplitMethod;
}): SplitResult {
    const total = readDecimal(amount);
    if (!total || total.units === 0n) {
        return { kind: "incomplete", summary: null };
    }

    const rate = readDecimal(String(exchangeRate));
    if (!rate || rate.units === 0n) {
        return { kind: "invalid-splits", summary: null };
    }

    const product = total.units * rate.units;
    const centsScale = total.scale + rate.scale - 2;
    const divisor = 10n ** BigInt(Math.max(centsScale, 0));
    const totalCents =
        centsScale > 0
            ? (product + divisor / 2n) / divisor
            : product * 10n ** BigInt(-centsScale);
    if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) {
        return { kind: "invalid-splits", summary: null };
    }

    if (method.kind === "single") {
        return {
            kind: "valid",
            summary: null,
            splits: allocateCents(totalCents, [[method.email, 1n]]),
        };
    }

    if (method.kind === "equally") {
        if (method.participants.length === 0) {
            return { kind: "no-participants", summary: null };
        }
        if (new Set(method.participants).size !== method.participants.length) {
            return { kind: "invalid-splits", summary: null };
        }

        const weights = method.participants.map((email): [string, bigint] => [email, 1n]);
        return { kind: "valid", summary: null, splits: allocateCents(totalCents, weights) };
    }

    const values = Object.entries(method.amounts).map(
        ([email, value]) => ({ email, amount: readDecimal(value || "0") }),
    );
    const scale = values.reduce(
        (largest, value) => Math.max(largest, value.amount?.scale ?? 0),
        Math.max(2, total.scale),
    );
    const totalUnits = total.units * 10n ** BigInt(scale - total.scale);
    let splitUnits = 0n;
    const weights: [string, bigint][] = [];
    for (const { email, amount } of values) {
        if (!amount) return { kind: "invalid-splits", summary: null };
        const units = amount.units * 10n ** BigInt(scale - amount.scale);
        if (units > 0n) weights.push([email, units]);
        splitUnits += units;
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

    return { kind: "valid", summary, splits: allocateCents(totalCents, weights) };
}
