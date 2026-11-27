"use client";

import React from "react";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";
import { useAuthState } from "@/src/stores/AuthStore";
import { TodoList } from "./TodoList";

export function TodosPageContent() {
    const { user } = useAuthState();
    const sheetId = useSelectedSheetId();

    if (!user || !sheetId) {
        return null;
    }

    return (
        <TodoList
            key={JSON.stringify([sheetId, user.email])}
            sheetId={sheetId}
            ownerEmail={user.email}
            canEdit
        />
    );
}
