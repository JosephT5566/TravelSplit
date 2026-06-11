"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { User } from "@/src/types";

interface AppHeaderProps {
    user: User;
    brandHref?: string;
    onAccountClick?: () => void;
    accountDisabledLabel?: string;
    className?: string;
}

export function AppHeader({
    user,
    brandHref,
    onAccountClick,
    accountDisabledLabel,
    className,
}: AppHeaderProps) {
    const [imageFailed, setImageFailed] = React.useState(false);
    const accountDisabled = !onAccountClick;
    const initials =
        user.name
            .trim()
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "?";

    React.useEffect(() => {
        setImageFailed(false);
    }, [user.picture]);

    const brand = <span className="text-xl font-bold text-primary">TripSplit</span>;

    return (
        <header
            className={cn(
                "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4 shadow-sm transition-colors",
                className,
            )}
        >
            {brandHref ? (
                <Link
                    href={brandHref}
                    className="flex min-h-11 items-center rounded-lg pr-2 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label="返回 TripSplit 主頁"
                >
                    {brand}
                </Link>
            ) : (
                <h1>{brand}</h1>
            )}

            <button
                type="button"
                onClick={onAccountClick}
                disabled={accountDisabled}
                aria-label={
                    accountDisabled
                        ? accountDisabledLabel ?? `${user.name} 的帳戶選單已停用`
                        : `開啟 ${user.name} 的帳戶選單`
                }
                title={accountDisabled ? accountDisabledLabel : undefined}
                className={cn(
                    "relative flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    accountDisabled
                        ? "cursor-not-allowed opacity-70"
                        : "transition-transform hover:scale-105 active:scale-95",
                )}
            >
                <span aria-hidden="true">{initials}</span>
                {user.picture && !imageFailed && (
                    <img
                        src={user.picture}
                        alt=""
                        onError={() => setImageFailed(true)}
                        className="absolute inset-0 size-full object-cover"
                        width={36}
                        height={36}
                    />
                )}
            </button>
        </header>
    );
}

