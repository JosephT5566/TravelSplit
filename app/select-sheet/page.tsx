"use client";

import React from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, Table2 } from "lucide-react";
import { api } from "@/services/api";
import { EXPENSES_KEY, SHEET_CONFIG_KEY } from "@/services/cacheKeys";
import { createIDBPersister } from "@/services/persister";
import { Button } from "@/components/ui/button";
import { SheetConfig } from "@/src/types";
import {
    getAvailableSheetIds,
    saveSelectedSheetId,
} from "@/src/utils/sheetSelection";
import { useSelectedSheetId } from "@/src/hooks/useSelectedSheetId";

const formatSheetId = (sheetId: string) => {
    if (sheetId.length <= 12) {
        return sheetId;
    }

    return `${sheetId.slice(0, 6)}...${sheetId.slice(-6)}`;
};

const getSheetTitle = (sheetConfig: SheetConfig | undefined, index: number) => {
    if (sheetConfig?.tripName) {
        return sheetConfig.tripName;
    }

    if (sheetConfig?.startDate || sheetConfig?.endDate) {
        return [sheetConfig.startDate, sheetConfig.endDate]
            .filter(Boolean)
            .join(" - ");
    }

    return `Google Sheet ${index + 1}`;
};

export default function SelectSheetPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const sheetIds = getAvailableSheetIds();
    const selectedSheetId = useSelectedSheetId();
    const [selectingSheetId, setSelectingSheetId] = React.useState<
        string | null
    >(null);
    const [selectionError, setSelectionError] = React.useState<string | null>(
        null,
    );

    const sheetQueries = useQueries({
        queries: sheetIds.map((sheetId) => ({
            queryKey: [SHEET_CONFIG_KEY, sheetId],
            queryFn: () => api.getSheetConfig(sheetId),
            enabled: sheetIds.length > 1,
        })),
    });

    const handleSelectSheet = async (sheetId: string) => {
        if (sheetId === selectedSheetId) {
            router.replace("/");
            return;
        }

        setSelectingSheetId(sheetId);
        setSelectionError(null);

        try {
            const sheetConfigQueryKey = [SHEET_CONFIG_KEY, sheetId];
            const sheetConfig =
                queryClient.getQueryData<SheetConfig>(sheetConfigQueryKey) ??
                (await queryClient.fetchQuery({
                    queryKey: sheetConfigQueryKey,
                    queryFn: () => api.getSheetConfig(sheetId),
                }));

            saveSelectedSheetId(sheetId);
            queryClient.setQueryData(sheetConfigQueryKey, sheetConfig);
            queryClient.removeQueries({ queryKey: [SHEET_CONFIG_KEY, null] });
            queryClient.removeQueries({ queryKey: [EXPENSES_KEY] });
            await persistQueryClientSave({
                queryClient,
                persister: createIDBPersister(),
            });

            router.replace("/");
        } catch (error) {
            setSelectionError(
                error instanceof Error
                    ? error.message
                    : "Unable to load the selected sheet setting.",
            );
        } finally {
            setSelectingSheetId(null);
        }
    };

    return (
        <main className="min-h-dvh bg-background px-4 py-8 text-text-main">
            <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col justify-center gap-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-primary">
                        Select Trip Sheet
                    </h1>
                    <p className="text-sm text-text-muted">
                        Available Google Sheets
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {sheetIds.map((sheetId, index) => {
                        const query = sheetQueries[index];
                        const sheetConfig = query?.data;
                        const isSelected = selectedSheetId === sheetId;

                        return (
                            <Button
                                key={sheetId}
                                variant="outline"
                                type="button"
                                onClick={() => handleSelectSheet(sheetId)}
                                disabled={selectingSheetId !== null}
                                className={`h-auto w-full justify-start rounded-lg bg-surface p-4 text-left shadow-sm hover:border-primary hover:bg-surface hover:shadow-md disabled:opacity-100 ${
                                    isSelected
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-border"
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                                        <Table2 size={22} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <h2 className="truncate text-lg font-semibold">
                                                {query?.isLoading
                                                    ? "Loading sheet..."
                                                    : getSheetTitle(
                                                          sheetConfig,
                                                          index,
                                                      )}
                                            </h2>
                                            {isSelected && (
                                                <CheckCircle2
                                                    size={20}
                                                    className="shrink-0 text-primary"
                                                />
                                            )}
                                            {selectingSheetId === sheetId && (
                                                <RefreshCw
                                                    size={20}
                                                    className="shrink-0 animate-spin text-primary"
                                                />
                                            )}
                                        </div>
                                        <p className="mt-1 font-mono text-xs text-text-muted">
                                            {formatSheetId(sheetId)}
                                        </p>
                                        {query?.isError && (
                                            <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                                                <AlertTriangle size={16} />
                                                Unable to load sheet setting.
                                            </div>
                                        )}
                                        {query?.isFetching && !query.isLoading && (
                                            <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
                                                <RefreshCw
                                                    size={16}
                                                    className="animate-spin"
                                                />
                                                Refreshing setting
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Button>
                        );
                    })}
                </div>

                {sheetIds.length === 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Missing NEXT_PUBLIC_SHEET_ID env variable.
                    </div>
                )}

                {selectionError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {selectionError}
                    </div>
                )}
            </div>
        </main>
    );
}
