"use client";

import React from "react";
import { TodosPageContent } from "@/components/todos/TodosPageContent";

const TodosPage = () => {
    return (
        <div className="flex flex-col gap-5 p-4 mx-auto">
            <TodosPageContent />
        </div>
    );
};

export default TodosPage;
