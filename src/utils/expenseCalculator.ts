type Fraction = { numerator: bigint; denominator: bigint };

type CalculatorResult =
    | { kind: "amount"; amount: string }
    | { kind: "empty" | "incomplete" | "divide-by-zero" | "invalid-amount" };

export const MAX_CALCULATOR_EXPRESSION_LENGTH = 128;

function readOperand(operand: string): Fraction | null {
    // The existing amount input can seed the calculator with scientific notation.
    const match = /^(-?)(\d*)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(operand);
    if (!match || !(match[2] || match[3]) || !Number.isFinite(Number(operand))) {
        return null;
    }
    const fraction = match[3] ?? "";
    const exponent = Number(match[4] ?? 0);
    if (Math.abs(exponent) > 450) return null;

    const numerator = BigInt(match[1] + match[2] + fraction);
    const scale = fraction.length - exponent;
    return scale < 0
        ? { numerator: numerator * 10n ** BigInt(-scale), denominator: 1n }
        : { numerator, denominator: 10n ** BigInt(scale) };
}

function add(left: Fraction, right: Fraction): Fraction {
    return {
        numerator: left.numerator * right.denominator + right.numerator * left.denominator,
        denominator: left.denominator * right.denominator,
    };
}

function formatAmount({ numerator, denominator }: Fraction): string {
    // Reduce before checking whether the decimal terminates. A reduced
    // denominator with only factors of 2 and 5 has an exact decimal form.
    let divisor = numerator;
    let remainder = denominator;
    while (remainder !== 0n) {
        [divisor, remainder] = [remainder, divisor % remainder];
    }
    let factors = denominator / divisor;
    let twos = 0;
    let fives = 0;
    while (factors % 2n === 0n) {
        factors /= 2n;
        twos++;
    }
    while (factors % 5n === 0n) {
        factors /= 5n;
        fives++;
    }

    const scale = factors === 1n ? Math.max(twos, fives) : 2;
    const scaled = numerator * 10n ** BigInt(scale);
    let units = scaled / denominator;
    if (2n * (scaled % denominator) >= denominator) units++;
    if (scale === 0) return units.toString();

    const digits = units.toString().padStart(scale + 1, "0");
    const fractionalDigits = digits.slice(-scale).replace(/0+$/, "");
    const integerDigits = digits.slice(0, -scale);
    return fractionalDigits ? `${integerDigits}.${fractionalDigits}` : integerDigits;
}

export function calculateExpenseAmount(expression: string): CalculatorResult {
    if (!expression) return { kind: "empty" };
    if (expression.length > MAX_CALCULATOR_EXPRESSION_LENGTH) {
        return { kind: "invalid-amount" };
    }

    // A plus sign can also appear in the exponent of the seeded amount.
    const parts = expression.replace(/e\+/gi, "e").split(/([+−×÷])/u);
    let term = readOperand(parts[0]);
    if (!term) return { kind: "incomplete" };
    let total: Fraction = { numerator: 0n, denominator: 1n };

    for (let index = 1; index < parts.length; index += 2) {
        const operator = parts[index];
        const operand = readOperand(parts[index + 1]);
        if (!operand) return { kind: "incomplete" };

        if (operator === "×") {
            term = {
                numerator: term.numerator * operand.numerator,
                denominator: term.denominator * operand.denominator,
            };
        } else if (operator === "÷") {
            if (operand.numerator === 0n) return { kind: "divide-by-zero" };
            const sign = operand.numerator < 0n ? -1n : 1n;
            term = {
                numerator: term.numerator * operand.denominator * sign,
                denominator: term.denominator * operand.numerator * sign,
            };
        } else {
            total = add(total, term);
            term = {
                ...operand,
                numerator: operator === "−" ? -operand.numerator : operand.numerator,
            };
        }
    }

    const result = add(total, term);
    if (result.numerator <= 0n) return { kind: "invalid-amount" };
    const amount = formatAmount(result);
    const numericAmount = Number(amount);
    return numericAmount > 0 && Number.isFinite(numericAmount)
        ? { kind: "amount", amount }
        : { kind: "invalid-amount" };
}
