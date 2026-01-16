"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FileText, Table, ExternalLink, Sparkle, EyeOff } from "lucide-react";
import { useConfig } from "../../src/stores/ConfigStore";
import { useAuth } from "../../src/stores/AuthStore";
import _isEmpty from "lodash/isEmpty";
import { TRAVEL_CHECKLIST, ChecklistCategory } from "../../src/utils/const";

const RESOURCE_STYLES = {
    google_doc: {
        icon: <FileText size={24} />,
        color: "#4285F4",
        label: "Google Docs",
    },
    google_sheet: {
        icon: <Table size={24} />,
        color: "#34A853",
        label: "Google Sheets",
    },
};

const LOCAL_STORAGE_KEY = "checklist-item-states";

const PlanPage = () => {
    const { sheetConfig } = useConfig();
    const { user } = useAuth();
    const { resources } = sheetConfig;
    const [itemStates, setItemStates] = useState<{
        [key: string]: { completed?: boolean; hidden?: boolean };
    }>({});

    // Load state from localStorage on initial client-side render
    useEffect(() => {
        const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedState) {
            setItemStates(JSON.parse(savedState));
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (Object.keys(itemStates).length > 0) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(itemStates));
        }
    }, [itemStates]);

    const userChecklist = useMemo(() => {
        if (!user?.email) {
            return [];
        }
        return TRAVEL_CHECKLIST.map((category, categoryIndex) => ({
            ...category,
            items: category.items
                .filter(
                    (item) => !item.users || item.users.includes(user.email)
                )
                .map((item, itemIndex) => ({
                    ...item,
                    id: `${categoryIndex}-${itemIndex}`,
                })),
        })).filter((category) => category.items.length > 0);
    }, [user?.email]);

    const toggleTodo = (itemId: string) => {
        setItemStates((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                completed: !(prev[itemId]?.completed || false),
            },
        }));
    };

    const hideItem = (itemId: string) => {
        setItemStates((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                hidden: true,
            },
        }));
    };

    return (
        <div className="flex flex-col gap-5 p-4 mx-auto pb-20">
            {/* External Resources Section */}
            {!_isEmpty(resources) && (
                <section>
                    <h2 className="text-xl font-bold mb-4">外部資源</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {resources?.map((resource) => {
                            const { icon, color, label } = RESOURCE_STYLES[
                                resource.type || ""
                            ] || {
                                icon: <Sparkle size={24} />,
                                color: "#71717b",
                                label: "",
                            };

                            return (
                                <a
                                    key={resource.url}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`card border shadow-md hover:shadow-lg transition-all active:scale-95`}
                                    style={{
                                        background: `${color}40`,
                                        borderColor: color,
                                    }}
                                >
                                    <div className="card-body p-3 flex-row items-center gap-4">
                                        <div
                                            className={`p-3 rounded-xl text-white bg-${color}`}
                                            style={{ backgroundColor: color }}
                                        >
                                            {icon}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg">
                                                {resource.title}
                                            </h3>
                                            {!_isEmpty(label) && (
                                                <p className="text-sm">
                                                    {label}
                                                </p>
                                            )}
                                        </div>
                                        <ExternalLink
                                            size={20}
                                            style={{ color: color }}
                                        />
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Checklist Section */}
            <section className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        行李清單
                    </h2>
                </div>

                <div className="flex flex-col gap-4">
                    {userChecklist.map((category) => (
                        <div
                            key={category.category}
                            className="collapse collapse-arrow bg-base-200"
                        >
                            <input type="checkbox" defaultChecked />
                            <div className="collapse-title text-xl font-medium">
                                {category.category}
                            </div>
                            <div className="collapse-content">
                                <div className="flex flex-col gap-2">
                                    {category.items
                                        .filter(
                                            (item) =>
                                                !itemStates[item.id]?.hidden
                                        )
                                        .map((item) => (
                                            <div
                                                key={item.id}
                                                className="card bg-base-100 shadow-sm transition-all active:scale-95"
                                            >
                                                <div className="card-body p-2 flex-row items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={item.id}
                                                        className="checkbox checkbox-primary"
                                                        checked={
                                                            itemStates[item.id]
                                                                ?.completed ||
                                                            false
                                                        }
                                                        onChange={() =>
                                                            toggleTodo(item.id)
                                                        }
                                                    />
                                                    <label
                                                        htmlFor={item.id}
                                                        className={`flex-1 ${
                                                            itemStates[item.id]
                                                                ?.completed
                                                                ? "line-through opacity-50"
                                                                : ""
                                                        }`}
                                                    >
                                                        {item.text}
                                                    </label>
                                                    <button
                                                        onClick={() =>
                                                            hideItem(item.id)
                                                        }
                                                        className="btn btn-xs btn-ghost"
                                                    >
                                                        <EyeOff size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default PlanPage;
