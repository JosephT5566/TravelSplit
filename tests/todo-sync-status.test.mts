import assert from "node:assert/strict";
import { test } from "node:test";
import {
    advanceSyncAnnouncementState,
    createInitialSyncAnnouncementState,
    deriveSyncStatus,
    formatTodoSyncTime,
    getSyncStatusAnnouncement,
    TODO_BACK_ONLINE_ANNOUNCEMENT,
    TODO_IDB_UNAVAILABLE_WARNING,
} from "../src/utils/todoSyncStatus.ts";

function localTime(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
): number {
    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

test("formatTodoSyncTime formats local 24h HH:mm today, 昨天 HH:mm yesterday (across month/year), and M/D HH:mm earlier", () => {
    const now = localTime(2026, 11, 28, 18, 30);

    // Today
    assert.equal(formatTodoSyncTime(localTime(2026, 11, 28, 0, 0), now), "00:00");
    assert.equal(formatTodoSyncTime(localTime(2026, 11, 28, 9, 5), now), "09:05");
    assert.equal(formatTodoSyncTime(localTime(2026, 11, 28, 18, 20), now), "18:20");
    assert.equal(formatTodoSyncTime(localTime(2026, 11, 28, 23, 59), now), "23:59");

    // Yesterday
    assert.equal(
        formatTodoSyncTime(localTime(2026, 11, 27, 23, 59), now),
        "昨天 23:59",
    );
    assert.equal(
        formatTodoSyncTime(localTime(2026, 11, 27, 0, 5), now),
        "昨天 00:05",
    );

    // Earlier (unpadded M/D, zero-padded HH:mm)
    assert.equal(
        formatTodoSyncTime(localTime(2026, 11, 26, 18, 20), now),
        "11/26 18:20",
    );
    assert.equal(
        formatTodoSyncTime(localTime(2026, 3, 5, 8, 3), now),
        "3/5 08:03",
    );

    // Yesterday across month boundary (Mar 1 -> Feb 28 in non-leap year 2026)
    const marchFirst = localTime(2026, 3, 1, 10, 0);
    assert.equal(
        formatTodoSyncTime(localTime(2026, 2, 28, 21, 15), marchFirst),
        "昨天 21:15",
    );
    assert.equal(
        formatTodoSyncTime(localTime(2026, 2, 27, 21, 15), marchFirst),
        "2/27 21:15",
    );

    // Yesterday across year boundary (Jan 1 -> Dec 31 previous year)
    const newYearsDay = localTime(2027, 1, 1, 1, 0);
    assert.equal(
        formatTodoSyncTime(localTime(2026, 12, 31, 23, 45), newYearsDay),
        "昨天 23:45",
    );
    assert.equal(
        formatTodoSyncTime(localTime(2026, 12, 30, 12, 0), newYearsDay),
        "12/30 12:00",
    );

    // Invalid timestamp
    assert.equal(formatTodoSyncTime(Number.NaN, now), "");
});

test("deriveSyncStatus follows exact spec §4 priority table where each row beats every lower row", () => {
    const now = localTime(2026, 11, 28, 18, 30);
    const savedAt = localTime(2026, 11, 28, 18, 25);
    const refreshedAt = localTime(2026, 11, 28, 18, 20);

    // 1. failed beats auth-expired, offline, inflight, pending, refreshing, saved, refreshed
    const s1 = deriveSyncStatus({
        entries: [
            { id: "a", status: "failed" },
            { id: "a", status: "failed" }, // duplicate id counted once
            { id: "b", status: "failed" },
            { id: "c", status: "pending" },
            { id: "d", status: "dropped" },
        ],
        authExpired: true,
        isOnline: false,
        isFlushing: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s1.kind, "failed");
    assert.equal(s1.tone, "failed");
    assert.equal(s1.text, "同步失敗 · 2 項（點擊重試）");
    assert.equal(s1.action, "retry");
    assert.equal(s1.count, 2);

    // 2. auth-expired beats offline, inflight, pending, refreshing, saved, refreshed
    const s2 = deriveSyncStatus({
        entries: [{ id: "c", status: "pending" }],
        authExpired: true,
        isOnline: false,
        isFlushing: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s2.kind, "auth-expired");
    assert.equal(s2.tone, "failed");
    assert.equal(s2.text, "登入已過期，登入後會繼續同步");
    assert.equal(s2.action, "sign-in");

    // 3. offline-with-changes beats offline-no-changes, inflight, pending, refreshing, saved, refreshed
    const s3 = deriveSyncStatus({
        entries: [
            { id: "p1", status: "pending" },
            { id: "p2", status: "inflight" },
            { id: "p1", status: "pending" }, // duplicate id counted once
            { id: "d1", status: "dropped" }, // dropped ignored
        ],
        isOnline: false,
        isFlushing: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s3.kind, "offline-pending");
    assert.equal(s3.tone, "offline");
    assert.equal(s3.text, "離線，2 項變更會在連線後同步");
    assert.equal(s3.action, null);
    assert.equal(s3.count, 2);

    // 3b. offline-no-changes beats inflight, refreshing, saved, refreshed (uses latest of saved/refreshed)
    const s3b = deriveSyncStatus({
        entries: [{ id: "d1", status: "dropped" }],
        isOnline: false,
        isFlushing: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s3b.kind, "offline-idle");
    assert.equal(s3b.tone, "offline");
    assert.equal(s3b.text, "離線 · 顯示 18:25 的資料");
    assert.equal(s3b.action, null);

    // Offline-idle with yesterday timestamp & no timestamp (dataUpdatedAt = 0)
    const s3bYesterday = deriveSyncStatus({
        entries: [],
        isOnline: false,
        lastRefreshedAt: localTime(2026, 11, 27, 22, 10),
        now,
    });
    assert.equal(s3bYesterday.text, "離線 · 顯示 昨天 22:10 的資料");

    const s3bNoTs = deriveSyncStatus({
        entries: [],
        isOnline: false,
        lastRefreshedAt: 0,
        lastSavedAt: null,
        now,
    });
    assert.equal(s3bNoTs.text, "離線");

    // 4. inflight beats pending, refreshing, saved, refreshed
    const s4 = deriveSyncStatus({
        entries: [{ id: "p1", status: "pending" }],
        isOnline: true,
        isFlushing: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s4.kind, "inflight");
    assert.equal(s4.tone, "syncing");
    assert.equal(s4.text, "儲存中…");
    assert.equal(s4.action, null);

    // Also enters inflight via entry status === "inflight" even if isFlushing omitted
    const s4ByEntry = deriveSyncStatus({
        entries: [{ id: "p1", status: "inflight" }],
        isOnline: true,
        now,
    });
    assert.equal(s4ByEntry.kind, "inflight");
    assert.equal(s4ByEntry.text, "儲存中…");

    // 5. pending beats refreshing, saved, refreshed
    const s5 = deriveSyncStatus({
        entries: [
            { id: "p1", status: "pending" },
            { id: "p2", status: "pending" },
            { id: "p3", status: "pending" },
        ],
        isOnline: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s5.kind, "pending");
    assert.equal(s5.tone, "pending");
    assert.equal(s5.text, "3 項尚未同步");
    assert.equal(s5.action, "sync-now");
    assert.equal(s5.count, 3);

    // 5b. pending with backoff countdown when all pending entries are backing off
    const s5Backoff = deriveSyncStatus({
        entries: [
            { id: "p1", status: "pending", nextAttemptAt: now + 14_200 },
            { id: "p2", status: "pending", nextAttemptAt: now + 45_000 },
        ],
        isOnline: true,
        now,
    });
    assert.equal(s5Backoff.kind, "pending");
    assert.equal(s5Backoff.text, "2 項尚未同步（15 秒後重試）");
    assert.equal(s5Backoff.retryInSeconds, 15);
    assert.equal(s5Backoff.action, "sync-now");

    // If a fresh edit has no nextAttemptAt, do NOT show backoff countdown
    const s5Mixed = deriveSyncStatus({
        entries: [
            { id: "p1", status: "pending", nextAttemptAt: now + 14_200 },
            { id: "p2", status: "pending" },
        ],
        isOnline: true,
        now,
    });
    assert.equal(s5Mixed.text, "2 項尚未同步");
    assert.equal(s5Mixed.retryInSeconds, undefined);

    // 6. refreshing beats saved, refreshed
    const s6 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        isRefreshing: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s6.kind, "refreshing");
    assert.equal(s6.tone, "syncing");
    assert.equal(s6.text, "更新中…");
    assert.equal(s6.action, null);

    // 7. saved beats refreshed when lastSavedAt > lastRefreshedAt
    const s7 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        now,
    });
    assert.equal(s7.kind, "saved");
    assert.equal(s7.tone, "ok");
    assert.equal(s7.text, "已儲存 · 18:25");
    assert.equal(s7.action, null);

    // 8. refreshed when lastRefreshedAt >= lastSavedAt (or lastSavedAt absent)
    const s8 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: refreshedAt,
        lastRefreshedAt: savedAt,
        now,
    });
    assert.equal(s8.kind, "refreshed");
    assert.equal(s8.tone, "ok");
    assert.equal(s8.text, "已更新 · 18:25");
    assert.equal(s8.action, null);

    // Idle when neither timestamp is available (or TanStack Query 0)
    const idle = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: null,
        lastRefreshedAt: 0,
        now,
    });
    assert.equal(idle.kind, "idle");
    assert.equal(idle.text, "");
});

test("deriveSyncStatus surfaces IndexedDB-unavailable warning and supports read-only teammate mode", () => {
    const now = localTime(2026, 11, 28, 18, 30);
    const refreshedAt = localTime(2026, 11, 28, 18, 10);
    const savedAt = localTime(2026, 11, 28, 18, 25);

    assert.equal(
        TODO_IDB_UNAVAILABLE_WARNING,
        "此裝置無法離線保存，請保持頁面開啟",
    );

    const withWarning = deriveSyncStatus({
        entries: [{ id: "p1", status: "pending" }],
        isOnline: true,
        idbUnavailable: true,
        now,
    });
    assert.equal(withWarning.text, "1 項尚未同步");
    assert.equal(withWarning.warning, "此裝置無法離線保存，請保持頁面開啟");

    // Read-only teammate list ONLY renders "已更新 · HH:mm" and suppresses outbox/warning/actions
    const readOnly = deriveSyncStatus({
        entries: [{ id: "f1", status: "failed" }],
        isOnline: false,
        isFlushing: true,
        isRefreshing: true,
        authExpired: true,
        idbUnavailable: true,
        lastSavedAt: savedAt,
        lastRefreshedAt: refreshedAt,
        readOnly: true,
        now,
    });
    assert.equal(readOnly.kind, "refreshed");
    assert.equal(readOnly.tone, "ok");
    assert.equal(readOnly.text, "已更新 · 18:10");
    assert.equal(readOnly.action, null);
    assert.equal(readOnly.warning, undefined);

    const readOnlyEmpty = deriveSyncStatus({
        isOnline: true,
        lastRefreshedAt: 0,
        readOnly: true,
        now,
    });
    assert.equal(readOnlyEmpty.kind, "idle");
    assert.equal(readOnlyEmpty.text, "");
});

test("getSyncStatusAnnouncement fires only on meaningful transitions (saved, refreshed, offline, failed alert, back-online)", () => {
    const t1 = localTime(2026, 11, 28, 18, 20);
    const t2 = localTime(2026, 11, 28, 18, 21);

    // saved -> pending (silent) -> inflight (silent) -> saved with newer ts (announced) -> same ts (silent)
    assert.equal(
        getSyncStatusAnnouncement({
            kind: "pending",
            text: "1 項尚未同步",
            isOnline: true,
            lastSavedAt: t1,
            previous: { kind: "saved", isOnline: true, lastSavedAt: t1 },
        }),
        undefined,
    );

    assert.equal(
        getSyncStatusAnnouncement({
            kind: "inflight",
            text: "儲存中…",
            isOnline: true,
            lastSavedAt: t1,
            previous: { kind: "pending", isOnline: true, lastSavedAt: t1 },
        }),
        undefined,
    );

    assert.deepEqual(
        getSyncStatusAnnouncement({
            kind: "saved",
            text: "已儲存 · 18:21",
            isOnline: true,
            lastSavedAt: t2,
            previous: { kind: "inflight", isOnline: true, lastSavedAt: t1 },
        }),
        {
            role: "status",
            politeness: "polite",
            text: "已儲存 · 18:21",
        },
    );

    assert.equal(
        getSyncStatusAnnouncement({
            kind: "saved",
            text: "已儲存 · 18:21",
            isOnline: true,
            lastSavedAt: t2,
            previous: { kind: "saved", isOnline: true, lastSavedAt: t2 },
        }),
        undefined,
    );

    // Going offline announces once; editing while already offline does not spam announcements.
    assert.deepEqual(
        getSyncStatusAnnouncement({
            kind: "offline-idle",
            text: "離線 · 顯示 18:21 的資料",
            isOnline: false,
            lastSavedAt: t2,
            previous: { kind: "saved", isOnline: true, lastSavedAt: t2 },
        }),
        {
            role: "status",
            politeness: "polite",
            text: "離線 · 顯示 18:21 的資料",
        },
    );

    assert.equal(
        getSyncStatusAnnouncement({
            kind: "offline-pending",
            text: "離線，1 項變更會在連線後同步",
            isOnline: false,
            lastSavedAt: t2,
            previous: { kind: "offline-idle", isOnline: false, lastSavedAt: t2 },
        }),
        undefined,
    );

    // Coming back online announces back-online even when immediately transitioning into inflight.
    assert.deepEqual(
        getSyncStatusAnnouncement({
            kind: "inflight",
            text: "儲存中…",
            isOnline: true,
            lastSavedAt: t2,
            previous: {
                kind: "offline-pending",
                isOnline: false,
                lastSavedAt: t2,
            },
        }),
        {
            role: "status",
            politeness: "polite",
            text: TODO_BACK_ONLINE_ANNOUNCEMENT,
        },
    );

    // Entering failed announces alert once; unchanged failed stays quiet; changed count alerts again.
    assert.deepEqual(
        getSyncStatusAnnouncement({
            kind: "failed",
            text: "同步失敗 · 1 項（點擊重試）",
            isOnline: true,
            previous: { kind: "inflight", isOnline: true },
        }),
        {
            role: "alert",
            politeness: "assertive",
            text: "同步失敗 · 1 項（點擊重試）",
        },
    );

    assert.equal(
        getSyncStatusAnnouncement({
            kind: "failed",
            text: "同步失敗 · 1 項（點擊重試）",
            isOnline: true,
            previous: {
                kind: "failed",
                isOnline: true,
                text: "同步失敗 · 1 項（點擊重試）",
            },
        }),
        undefined,
    );

    assert.deepEqual(
        getSyncStatusAnnouncement({
            kind: "failed",
            text: "同步失敗 · 2 項（點擊重試）",
            isOnline: true,
            previous: {
                kind: "failed",
                isOnline: true,
                text: "同步失敗 · 1 項（點擊重試）",
            },
        }),
        {
            role: "alert",
            politeness: "assertive",
            text: "同步失敗 · 2 項（點擊重試）",
        },
    );

    // refreshing (silent) -> refreshed with newer timestamp (announced)
    assert.equal(
        getSyncStatusAnnouncement({
            kind: "refreshing",
            text: "更新中…",
            isOnline: true,
            lastRefreshedAt: t1,
            previous: { kind: "refreshed", isOnline: true, lastRefreshedAt: t1 },
        }),
        undefined,
    );

    assert.deepEqual(
        getSyncStatusAnnouncement({
            kind: "refreshed",
            text: "已更新 · 18:21",
            isOnline: true,
            lastRefreshedAt: t2,
            previous: { kind: "refreshing", isOnline: true, lastRefreshedAt: t1 },
        }),
        {
            role: "status",
            politeness: "polite",
            text: "已更新 · 18:21",
        },
    );
});

test("advanceSyncAnnouncementState clears politeText on entering pending/inflight/refreshing and de-duplicates live-region transitions", () => {
    const now = localTime(2026, 11, 28, 18, 30);
    const t1 = localTime(2026, 11, 28, 18, 20);
    const t2 = localTime(2026, 11, 28, 18, 21);

    // Cold load: idle -> refreshed announces once
    let state = createInitialSyncAnnouncementState({
        initiallyIdle: true,
        isOnline: true,
    });
    const refreshedStatus = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: refreshedStatus,
        isOnline: true,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "已更新 · 18:20");
    assert.equal(state.alertText, "");

    // Entering pending clears politeText silently so a subsequent same-minute save/refresh updates DOM;
    // repeated pending edits & inflight stay silent (empty).
    const pending1 = deriveSyncStatus({
        entries: [{ id: "a", status: "pending" }],
        isOnline: true,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: pending1,
        isOnline: true,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "");
    assert.equal(state.alertText, "");

    const pending2 = deriveSyncStatus({
        entries: [
            { id: "a", status: "pending" },
            { id: "b", status: "pending" },
        ],
        isOnline: true,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: pending2,
        isOnline: true,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "");

    const inflight = deriveSyncStatus({
        entries: [{ id: "a", status: "inflight" }],
        isOnline: true,
        isFlushing: true,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: inflight,
        isOnline: true,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "");

    // inflight -> saved announces via polite region
    const saved = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: saved,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "已儲存 · 18:21");
    assert.equal(state.alertText, "");

    // Online -> offline announces once; editing while offline stays silent
    const offlineIdle = deriveSyncStatus({
        entries: [],
        isOnline: false,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: offlineIdle,
        isOnline: false,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "離線 · 顯示 18:21 的資料");

    const offlinePending = deriveSyncStatus({
        entries: [{ id: "c", status: "pending" }],
        isOnline: false,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: offlinePending,
        isOnline: false,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, "離線 · 顯示 18:21 的資料");

    // Back online announces 已恢復連線 even while immediately inflight
    state = advanceSyncAnnouncementState(state, {
        status: inflight,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state.politeText, TODO_BACK_ONLINE_ANNOUNCEMENT);

    // Failure announces once via alertText; re-rendering same failure is a no-op
    const failed1 = deriveSyncStatus({
        entries: [{ id: "c", status: "failed" }],
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: failed1,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state.alertText, "同步失敗 · 1 項（點擊重試）");
    assert.equal(state.politeText, TODO_BACK_ONLINE_ANNOUNCEMENT);

    const sameFailedRef = state;
    state = advanceSyncAnnouncementState(state, {
        status: failed1,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state, sameFailedRef);

    // Retrying clears alertText and politeText so subsequent failure or save announces again
    state = advanceSyncAnnouncementState(state, {
        status: inflight,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(state.alertText, "");
    assert.equal(state.politeText, "");

    // Dropped notice announces once via polite region
    state = advanceSyncAnnouncementState(state, {
        status: saved,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
        droppedNotice: "1 項已在其他裝置刪除，已移除你的變更",
    });
    assert.equal(
        state.politeText,
        "已儲存 · 18:21，1 項已在其他裝置刪除，已移除你的變更",
    );

    // Warm-cache mount seeds silently (unless mounted directly into failed)
    const warmStart = createInitialSyncAnnouncementState({
        initiallyIdle: false,
        isOnline: true,
    });
    const warmSaved = advanceSyncAnnouncementState(warmStart, {
        status: saved,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(warmSaved.politeText, "");
    assert.equal(warmSaved.alertText, "");

    const warmFailed = advanceSyncAnnouncementState(warmStart, {
        status: failed1,
        isOnline: true,
        lastSavedAt: t2,
        lastRefreshedAt: t1,
    });
    assert.equal(warmFailed.alertText, "同步失敗 · 1 項（點擊重試）");
});

test("advanceSyncAnnouncementState announces repeated saves and repeated refreshes within the same minute", () => {
    const save1At = new Date(2026, 10, 28, 18, 20, 5).getTime();
    const save2At = new Date(2026, 10, 28, 18, 20, 20).getTime();
    const refresh1At = new Date(2026, 10, 28, 18, 20, 25).getTime();
    const refresh2At = new Date(2026, 10, 28, 18, 20, 45).getTime();
    const now = new Date(2026, 10, 28, 18, 20, 50).getTime();

    // Two saves in the same minute (18:20)
    let state = createInitialSyncAnnouncementState({
        initiallyIdle: true,
        isOnline: true,
    });
    const saved1 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: save1At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: saved1,
        isOnline: true,
        lastSavedAt: save1At,
    });
    assert.equal(state.politeText, "已儲存 · 18:20");

    // Second edit enters pending -> politeText clears to "" so the next save mutates the live region
    const pending = deriveSyncStatus({
        entries: [{ id: "t1", status: "pending" }],
        isOnline: true,
        lastSavedAt: save1At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: pending,
        isOnline: true,
        lastSavedAt: save1At,
    });
    assert.equal(state.politeText, "");

    const inflight = deriveSyncStatus({
        entries: [{ id: "t1", status: "inflight" }],
        isOnline: true,
        isFlushing: true,
        lastSavedAt: save1At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: inflight,
        isOnline: true,
        lastSavedAt: save1At,
    });
    assert.equal(state.politeText, "");

    const saved2 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: save2At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: saved2,
        isOnline: true,
        lastSavedAt: save2At,
    });
    assert.equal(state.politeText, "已儲存 · 18:20");

    // Two refreshes in the same minute (18:20)
    const refreshing1 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        isRefreshing: true,
        lastSavedAt: save2At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: refreshing1,
        isOnline: true,
        lastSavedAt: save2At,
    });
    assert.equal(state.politeText, "");

    const refreshed1 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh1At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: refreshed1,
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh1At,
    });
    assert.equal(state.politeText, "已更新 · 18:20");

    const refreshing2 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        isRefreshing: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh1At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: refreshing2,
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh1At,
    });
    assert.equal(state.politeText, "");

    const refreshed2 = deriveSyncStatus({
        entries: [],
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh2At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: refreshed2,
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh2At,
    });
    assert.equal(state.politeText, "已更新 · 18:20");

    // Coming back online into pending keeps 已恢復連線 across pending -> inflight before saved replaces it
    const offlinePending = deriveSyncStatus({
        entries: [{ id: "t2", status: "pending" }],
        isOnline: false,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh2At,
        now,
    });
    state = advanceSyncAnnouncementState(state, {
        status: offlinePending,
        isOnline: false,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh2At,
    });
    assert.equal(state.politeText, "離線，1 項變更會在連線後同步");

    state = advanceSyncAnnouncementState(state, {
        status: pending,
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh2At,
    });
    assert.equal(state.politeText, TODO_BACK_ONLINE_ANNOUNCEMENT);

    state = advanceSyncAnnouncementState(state, {
        status: inflight,
        isOnline: true,
        lastSavedAt: save2At,
        lastRefreshedAt: refresh2At,
    });
    assert.equal(state.politeText, TODO_BACK_ONLINE_ANNOUNCEMENT);
});
