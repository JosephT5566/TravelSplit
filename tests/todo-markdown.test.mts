import assert from "node:assert/strict";
import { test } from "node:test";
import {
    copyTextToClipboard,
    type ClipboardDocumentLike,
    type ClipboardTextareaLike,
} from "../src/utils/clipboard.ts";
import {
    escapeMarkdownText,
    formatTodosAsMarkdown,
} from "../src/utils/todoMarkdown.ts";

test("escapeMarkdownText backslash-escapes each Markdown special character while preserving Chinese text", () => {
    const specials = ["\\", "`", "*", "_", "[", "]", "#", "<", ">", "~", "|"];
    for (const ch of specials) {
        assert.equal(escapeMarkdownText(ch), `\\${ch}`);
    }

    assert.equal(
        escapeMarkdownText("行動電源與 Type-C 快充線（含線材）"),
        "行動電源與 Type-C 快充線（含線材）",
    );
    assert.equal(
        escapeMarkdownText("\\ ` * _ [ ] # < > ~ |"),
        "\\\\ \\` \\* \\_ \\[ \\] \\# \\< \\> \\~ \\|",
    );
    assert.equal(
        escapeMarkdownText("# 標題 [連結](url) *粗體* _斜體_ `code` ~del~ a|b <tag>"),
        "\\# 標題 \\[連結\\](url) \\*粗體\\* \\_斜體\\_ \\`code\\` \\~del\\~ a\\|b \\<tag\\>",
    );
    assert.equal(escapeMarkdownText("第一行\n第二行\r\n第三行"), "第一行 第二行 第三行");
});

test("formatTodosAsMarkdown formats grouped task list in UI order with 未分類 last and checked state preserved", () => {
    const items = [
        // Oldest item overall is uncategorized, yet 未分類 must appear last.
        {
            text: "記得帶雨衣",
            checked: false,
            category: "",
            createdAt: "2026-11-27T00:30:00.000Z",
        },
        {
            text: "護照影本",
            checked: false,
            category: "證件",
            createdAt: "2026-11-27T02:00:00.000Z",
        },
        {
            text: "轉接頭",
            checked: false,
            category: "行李",
            createdAt: "2026-11-27T01:30:00.000Z",
        },
        {
            text: "行動電源",
            checked: true,
            category: "行李",
            createdAt: "2026-11-27T01:00:00.000Z",
        },
        {
            text: "保暖襪",
            checked: true,
            category: "行李",
            createdAt: "2026-11-27T01:45:00.000Z",
        },
    ];

    const markdown = formatTodosAsMarkdown(items, { ownerDisplayName: "小安" });

    assert.equal(
        markdown,
        [
            "## 小安 的待辦清單",
            "",
            "### 行李",
            "- [x] 行動電源",
            "- [ ] 轉接頭",
            "- [x] 保暖襪",
            "",
            "### 證件",
            "- [ ] 護照影本",
            "",
            "### 未分類",
            "- [ ] 記得帶雨衣",
            "",
        ].join("\n"),
    );
});

test("formatTodosAsMarkdown omits ### 未分類 when all items are uncategorized", () => {
    const items = [
        {
            text: "第二項",
            checked: true,
            category: "未分類",
            createdAt: "2026-11-27T02:00:00.000Z",
        },
        {
            text: "第一項",
            checked: false,
            createdAt: "2026-11-27T01:00:00.000Z",
        },
        {
            text: "第三項",
            checked: false,
            category: "   ",
            createdAt: "2026-11-27T03:00:00.000Z",
        },
    ];

    const markdown = formatTodosAsMarkdown(items, { ownerDisplayName: "小安" });

    assert.equal(markdown.includes("### 未分類"), false);
    assert.equal(
        markdown,
        [
            "## 小安 的待辦清單",
            "",
            "- [ ] 第一項",
            "- [x] 第二項",
            "- [ ] 第三項",
            "",
        ].join("\n"),
    );
});

test("formatTodosAsMarkdown handles empty list and escapes special chars in owner name, category, and item text", () => {
    assert.equal(
        formatTodosAsMarkdown([], { ownerDisplayName: "小安" }),
        "## 小安 的待辦清單\n",
    );
    assert.equal(
        formatTodosAsMarkdown([], { ownerDisplayName: "   " }),
        "## 我 的待辦清單\n",
    );

    const items = [
        {
            text: "# 確認 [飯店](https://example.test) *2晚* _含早餐_ `A1` ~舊~ a|b <note>",
            checked: false,
            category: "行程 [Day 1] *重點*",
            createdAt: "2026-11-27T01:00:00.000Z",
        },
    ];

    const markdown = formatTodosAsMarkdown(items, {
        ownerDisplayName: "A*B_[1]#",
    });

    assert.equal(
        markdown,
        [
            "## A\\*B\\_\\[1\\]\\# 的待辦清單",
            "",
            "### 行程 \\[Day 1\\] \\*重點\\*",
            "- [ ] \\# 確認 \\[飯店\\](https://example.test) \\*2晚\\* \\_含早餐\\_ \\`A1\\` \\~舊\\~ a\\|b \\<note\\>",
            "",
        ].join("\n"),
    );
});

test("formatTodosAsMarkdown exports a teammate's list with the teammate's display name", () => {
    const teammateItems = [
        {
            text: "確認民宿自助入住密碼",
            checked: false,
            category: "",
            createdAt: "2026-11-27T03:00:00.000Z",
        },
        {
            text: "暖暖包（貼式 20 片）",
            checked: true,
            category: "行李",
            createdAt: "2026-11-27T01:00:00.000Z",
        },
        {
            text: "防風防水手套與毛帽",
            checked: false,
            category: "行李",
            createdAt: "2026-11-27T02:00:00.000Z",
        },
    ];

    const markdown = formatTodosAsMarkdown(teammateItems, {
        ownerDisplayName: "小美",
    });

    assert.equal(
        markdown,
        [
            "## 小美 的待辦清單",
            "",
            "### 行李",
            "- [x] 暖暖包（貼式 20 片）",
            "- [ ] 防風防水手套與毛帽",
            "",
            "### 未分類",
            "- [ ] 確認民宿自助入住密碼",
            "",
        ].join("\n"),
    );
});

function createMockDocument(execResult: boolean | Error) {
    const events: string[] = [];
    let appended: ClipboardTextareaLike | null = null;
    let removed = false;
    let readonlyAttr: string | null = null;
    let selected = false;
    let copiedValue = "";

    const doc: ClipboardDocumentLike = {
        createElement(tagName: string): ClipboardTextareaLike {
            events.push(`create:${tagName}`);
            const node: ClipboardTextareaLike = {
                value: "",
                style: {},
                setAttribute(name: string, value: string) {
                    if (name === "readonly") {
                        readonlyAttr = value;
                    }
                },
                select() {
                    selected = true;
                    copiedValue = node.value;
                    events.push("select");
                },
                setSelectionRange() {
                    events.push("setSelectionRange");
                },
                remove() {
                    removed = true;
                    events.push("remove");
                },
            };
            return node;
        },
        body: {
            appendChild(node: ClipboardTextareaLike) {
                appended = node;
                events.push("appendChild");
                return node;
            },
        },
        execCommand(commandId: string) {
            events.push(`execCommand:${commandId}`);
            if (execResult instanceof Error) {
                throw execResult;
            }
            return execResult;
        },
    };

    return {
        doc,
        getState: () => ({
            events,
            appended,
            removed,
            readonlyAttr,
            selected,
            copiedValue,
        }),
    };
}

test("copyTextToClipboard uses navigator.clipboard.writeText when available", async () => {
    const written: string[] = [];
    const mock = createMockDocument(true);

    const result = await copyTextToClipboard("## 小安 的待辦清單\n", {
        navigator: {
            clipboard: {
                async writeText(text: string) {
                    written.push(text);
                },
            },
        },
        document: mock.doc,
    });

    assert.equal(result, "ok");
    assert.deepEqual(written, ["## 小安 的待辦清單\n"]);
    assert.deepEqual(mock.getState().events, []);
});

test("copyTextToClipboard falls back to hidden readonly textarea + execCommand when writeText rejects", async () => {
    const mock = createMockDocument(true);

    const result = await copyTextToClipboard("hello markdown", {
        navigator: {
            clipboard: {
                async writeText() {
                    throw new Error("Permission denied");
                },
            },
        },
        document: mock.doc,
    });

    assert.equal(result, "ok");
    const state = mock.getState();
    assert.equal(state.readonlyAttr, "");
    assert.equal(state.selected, true);
    assert.equal(state.copiedValue, "hello markdown");
    assert.equal(state.removed, true);
    assert.ok(state.events.includes("execCommand:copy"));
});

test("copyTextToClipboard returns failed when both clipboard API and execCommand fail or throw", async () => {
    const mockFalse = createMockDocument(false);
    const resultFalse = await copyTextToClipboard("hello", {
        navigator: {
            clipboard: {
                async writeText() {
                    throw new Error("NotAllowedError");
                },
            },
        },
        document: mockFalse.doc,
    });
    assert.equal(resultFalse, "failed");
    assert.equal(mockFalse.getState().removed, true);

    const mockThrow = createMockDocument(new Error("execCommand error"));
    const resultThrow = await copyTextToClipboard("hello", {
        navigator: {
            clipboard: {
                async writeText() {
                    throw new Error("NotAllowedError");
                },
            },
        },
        document: mockThrow.doc,
    });
    assert.equal(resultThrow, "failed");
    assert.equal(mockThrow.getState().removed, true);
});

test("copyTextToClipboard handles missing navigator.clipboard API", async () => {
    const mockOk = createMockDocument(true);
    const okResult = await copyTextToClipboard("fallback only", {
        navigator: {},
        document: mockOk.doc,
    });
    assert.equal(okResult, "ok");
    assert.equal(mockOk.getState().copiedValue, "fallback only");
    assert.equal(mockOk.getState().removed, true);

    const noDomResult = await copyTextToClipboard("no dom", {
        navigator: undefined,
        document: undefined,
    });
    assert.equal(noDomResult, "failed");
});
