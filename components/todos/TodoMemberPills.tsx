"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import type { TodoMemberOption } from "@/src/utils/todoCopy";

export interface TodoMemberPillsProps {
    members: readonly TodoMemberOption[];
    selectedEmail: string;
    onSelect: (email: string) => void;
}

export function TodoMemberPills({
    members,
    selectedEmail,
    onSelect,
}: TodoMemberPillsProps) {
    const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    if (members.length === 0) {
        return null;
    }

    const selectedIndex = Math.max(
        0,
        members.findIndex((member) => member.email === selectedEmail),
    );

    const moveSelection = (nextIndex: number) => {
        const target = members[nextIndex];
        if (!target) {
            return;
        }
        onSelect(target.email);
        const button = buttonRefs.current.get(target.email);
        button?.focus();
        button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        index: number,
    ) => {
        if (members.length <= 1) {
            return;
        }

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            moveSelection((index + 1) % members.length);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            moveSelection((index - 1 + members.length) % members.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            moveSelection(0);
        } else if (event.key === "End") {
            event.preventDefault();
            moveSelection(members.length - 1);
        }
    };

    return (
        <div className="relative -mx-4 min-w-0">
            <div
                role="radiogroup"
                aria-label="選擇要檢視的待辦清單"
                className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto px-4 py-1.5"
            >
                {members.map((member, index) => {
                    const isSelected = member.email === selectedEmail;
                    const isFocusable = index === selectedIndex;

                    return (
                        <button
                            key={member.email}
                            ref={(node) => {
                                if (node) {
                                    buttonRefs.current.set(member.email, node);
                                } else {
                                    buttonRefs.current.delete(member.email);
                                }
                            }}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={
                                member.isMe
                                    ? `我（${member.displayName}）`
                                    : undefined
                            }
                            tabIndex={isFocusable ? 0 : -1}
                            onClick={() => onSelect(member.email)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={cn(
                                "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
                                isSelected
                                    ? "border border-transparent bg-primary font-semibold text-gray-950 shadow-xs ocean:text-white"
                                    : "border border-border bg-surface font-medium text-text-main shadow-2xs hover:bg-background/80",
                            )}
                        >
                            {member.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
