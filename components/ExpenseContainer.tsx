import React from "react";
import classNames from "classnames";

interface Props {
    children: React.ReactNode;
}

const ExpenseContainer: React.FC<Props> = ({ children }) => {
    return (
        <div
            className={classNames(
                "bg-surface min-h-[70vh] shadow-2xl flex flex-col overflow-auto animate-in slide-in-from-bottom-8 fade-in duration-200",
                "w-full sm:w-160",
                "fixed bottom-0 sm:top-1/2 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2",
                "max-h-[90vh] sm:max-h-[85vh]",
                "rounded-t-3xl sm:rounded-2xl"
            )}
        >
            {children}
        </div>
    );
};

export default ExpenseContainer;
