import { LoaderCircle } from "lucide-react";

type StartupLoadingProps = {
    value: string;
    detail: string;
};

export function StartupLoading({ value, detail }: StartupLoadingProps) {
    return (
        <main
            className="flex min-h-dvh items-center justify-center bg-background px-6 text-text-main"
            aria-busy="true"
            aria-live="polite"
        >
            <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 text-center shadow-lg">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LoaderCircle className="size-6 animate-spin" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Loading TripSplit
                </p>
                <h1 className="mt-2 text-xl font-semibold">
                    Waiting for {value}
                </h1>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                    {detail}
                </p>
            </div>
        </main>
    );
}
