import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("signed-in shell locks document scroll and only <main> scrolls", () => {
    const layout = read("components/Layout.tsx");
    assert.match(layout, /grid h-dvh[^"]*overflow-hidden[^"]*overscroll-none/);
    assert.match(
        layout,
        /<main className="[^"]*min-h-0[^"]*overflow-auto[^"]*overscroll-y-contain/,
    );

    const appShell = read("components/AppShell.tsx");
    assert.match(appShell, /"relative h-dvh /);
    assert.match(appShell, /overflow-hidden overscroll-none/);
    assert.equal(appShell.includes("min-h-dvh"), false);

    assert.match(
        read("app/globals.css"),
        /html,\s*body\s*\{\s*overscroll-behavior:\s*none;/,
    );
});

test("viewport-fit=cover is set for the app and the offline page", () => {
    assert.match(read("app/layout.tsx"), /viewportFit:\s*"cover"/);
    assert.match(read("public/offline.html"), /viewport-fit=cover/);
});

test("header height and sticky offsets share --app-header-offset", () => {
    const css = read("app/globals.css");
    assert.match(css, /--app-header-height:\s*4rem/);
    assert.match(
        css,
        /--app-header-offset:\s*calc\(\s*var\(--app-header-height\)\s*\+\s*env\(safe-area-inset-top,\s*0px\)\s*\)/,
    );

    const header = read("components/AppHeader.tsx");
    assert.match(header, /h-\(--app-header-offset\)/);
    assert.match(header, /pt-\[env\(safe-area-inset-top,0px\)\]/);
    assert.equal(/\bh-16\b/.test(header), false);

    for (const path of [
        "components/travel-books/shimanami/ShimanamiTravelBook.tsx",
        "components/travel-books/hokkaido/HokkaidoTravelBook.tsx",
    ]) {
        const source = read(path);
        assert.match(source, /"top-\(--app-header-offset\)"/, path);
        assert.match(source, /top-0 pt-\[env\(safe-area-inset-top,0px\)\]/, path);
        assert.equal(source.includes("top-16"), false, path);
        assert.match(source, /pt-\[calc\([\d.]+rem\+env\(safe-area-inset-top,0px\)\)\]/, path);
        assert.equal(source.includes("max-h-[calc(100dvh-2rem)]"), false, path);
    }
});

test("overlays and entry screens keep clear of the top and bottom insets", () => {
    assert.match(
        read("components/SideDrawer.tsx"),
        /pt-\[calc\(1rem\+env\(safe-area-inset-top,0px\)\)\][^"]*pb-\[calc\(1rem\+env\(safe-area-inset-bottom,0px\)\)\]/,
    );
    assert.match(
        read("components/ui/toast.tsx"),
        /sm:top-\[calc\(1rem\+env\(safe-area-inset-top,0px\)\)\]/,
    );
    for (const path of [
        "components/LoginView.tsx",
        "components/StartupLoading.tsx",
        "app/select-sheet/page.tsx",
    ]) {
        const source = read(path);
        assert.match(source, /env\(safe-area-inset-top,0px\)/, path);
        assert.match(source, /env\(safe-area-inset-bottom,0px\)/, path);
    }
});
