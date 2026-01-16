"use client";

import React, { useState } from "react";
import {
    FileText,
    Table,
    ExternalLink,
    Plus,
} from "lucide-react"; // 使用 lucide-react 作為圖示庫

const PlanPage = () => {
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
        <div className="flex flex-col gap-4 p-4 mx-auto min-h-screen pb-20">
            {/* External Resources Section */}
            <section>
                <h2 className="text-xl font-bold mb-4">外部資源</h2>
                <div className="grid grid-cols-1 gap-4">
                    {/* Google Sheets CTA */}
                    <a
                        href="https://sheets.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="card bg-green-50 border border-green-200 shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                        <div className="card-body p-5 flex-row items-center gap-4">
                            <div className="bg-green-600 p-3 rounded-xl text-white">
                                <Table size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-green-900 text-lg">
                                    預算明細
                                </h3>
                                <p className="text-green-700 text-sm">
                                    Google Sheets
                                </p>
                            </div>
                            <ExternalLink
                                size={20}
                                className="text-green-400"
                            />
                        </div>
                    </a>

                    {/* Google Docs CTA */}
                    <a
                        href="https://docs.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="card bg-blue-50 border border-blue-200 shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                        <div className="card-body p-5 flex-row items-center gap-4">
                            <div className="bg-blue-500 p-3 rounded-xl text-white">
                                <FileText size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-blue-900 text-lg">
                                    詳細行程規劃
                                </h3>
                                <p className="text-blue-700 text-sm">
                                    Google Docs
                                </p>
                            </div>
                            <ExternalLink size={20} className="text-blue-400" />
                        </div>
                    </a>
                </div>
            </section>

            {/* Todo List Section */}
            <section className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        待辦事項
                    </h2>
                    <button className="btn btn-circle btn-sm btn-ghost">
                        <Plus size={20} />
                    </button>
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
