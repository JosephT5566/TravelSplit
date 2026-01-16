"use client";

import React, { useState } from "react";
import { FileText, Table, ExternalLink, Sparkle } from "lucide-react"; // 使用 lucide-react 作為圖示庫
import { useConfig } from "../../src/stores/ConfigStore";
import _isEmpty from "lodash/isEmpty";

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

const PlanPage = () => {
    const { sheetConfig } = useConfig();
    const { resources } = sheetConfig;
    const [todos, setTodos] = useState([
        { id: 1, text: "辦理日幣換匯", completed: false },
        { id: 2, text: "確認護照效期 (需 6 個月以上)", completed: true },
        { id: 3, text: "下載離線地圖", completed: false },
    ]);

    const toggleTodo = (id) => {
        setTodos(
            todos.map((t) =>
                t.id === id ? { ...t, completed: !t.completed } : t
            )
        );
    };

    return (
        <div className="flex flex-col gap-5 p-4 mx-auto min-h-screen pb-20">
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

            {/* Todo List Section */}
            <section className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        待辦事項
                    </h2>
                </div>

                <div className="flex flex-col gap-2">
                    {todos.map((todo) => (
                        <div
                            key={todo.id}
                            className="card bg-base-200 shadow-sm transition-all active:scale-95"
                        >
                            <div className="card-body p-2 flex-row items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary"
                                    checked={todo.completed}
                                    onChange={() => toggleTodo(todo.id)}
                                />
                                <span
                                    className={`flex-1 ${
                                        todo.completed
                                            ? "line-through opacity-50"
                                            : ""
                                    }`}
                                >
                                    {todo.text}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default PlanPage;
