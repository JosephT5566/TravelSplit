"use client";

import React from "react";
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
        </div>
    );
};

export default PlanPage;
