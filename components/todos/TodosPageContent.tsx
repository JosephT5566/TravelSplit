"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";
import { useAuthState } from "@/src/stores/AuthStore";
import { useConfig } from "@/src/stores/ConfigStore";
import { buildMemberOptions } from "@/src/utils/todoCopy";
import { TodoCopyButton } from "./TodoCopyButton";
import { TodoList, type ReadOnlyTopActionContext } from "./TodoList";
import { TodoMemberPills } from "./TodoMemberPills";

function TodosSheetView({
    sheetId,
    myEmail,
}: {
    sheetId: string;
    myEmail: string;
}) {
    const { sheetConfig } = useConfig();
    const [viewedEmail, setViewedEmail] = useState(myEmail);
    const [liveAnnouncement, setLiveAnnouncement] = useState("");

    const members = useMemo(
        () => buildMemberOptions(sheetConfig.users, myEmail),
        [sheetConfig.users, myEmail],
    );

    const activeMember = useMemo(
        () =>
            members.find((member) => member.email === viewedEmail) ??
            members[0],
        [members, viewedEmail],
    );

    const effectiveViewedEmail = activeMember?.email ?? myEmail;
    const isViewingMe = effectiveViewedEmail === myEmail;

    const handleSelectMember = useCallback(
        (email: string) => {
            setViewedEmail(email);
            if (email === effectiveViewedEmail) {
                return;
            }
            const target = members.find((member) => member.email === email);
            if (!target || target.isMe) {
                setLiveAnnouncement("已切回我的清單");
            } else {
                setLiveAnnouncement(
                    `已切換至 ${target.displayName} 的清單（唯讀）`,
                );
            }
        },
        [members, effectiveViewedEmail],
    );

    const handleBackToMine = useCallback(() => {
        handleSelectMember(myEmail);
    }, [handleSelectMember, myEmail]);

    const renderReadOnlyTopAction = useCallback(
        ({ items }: ReadOnlyTopActionContext) => (
            <TodoCopyButton
                sheetId={sheetId}
                myEmail={myEmail}
                ownerName={activeMember?.displayName ?? ""}
                sourceItems={items}
            />
        ),
        [activeMember?.displayName, myEmail, sheetId],
    );

    return (
        <>
            <p className="sr-only" role="status" aria-live="polite">
                {liveAnnouncement}
            </p>
            <TodoList
                sheetId={sheetId}
                ownerEmail={effectiveViewedEmail}
                ownerName={activeMember?.displayName}
                canEdit={isViewingMe}
                onBackToMine={isViewingMe ? undefined : handleBackToMine}
                memberBar={
                    members.length > 0 ? (
                        <TodoMemberPills
                            members={members}
                            selectedEmail={effectiveViewedEmail}
                            onSelect={handleSelectMember}
                        />
                    ) : null
                }
                readOnlyTopAction={
                    isViewingMe ? undefined : renderReadOnlyTopAction
                }
            />
        </>
    );
}

export function TodosPageContent() {
    const { user } = useAuthState();
    const sheetId = useSelectedSheetId();

    if (!user || !sheetId) {
        return null;
    }

    return (
        <TodosSheetView
            key={JSON.stringify([sheetId, user.email])}
            sheetId={sheetId}
            myEmail={user.email}
        />
    );
}
