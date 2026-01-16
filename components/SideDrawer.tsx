"use client";

import React from "react";
import { LogOut } from "lucide-react";
import { useAuth, useAuthActions } from "../src/stores/AuthStore";
import { AppConfig } from "../src/types";
import { useUI } from "../src/stores/UIStore";

export const SideDrawer: React.FC = () => {
    const { signOut } = useAuthActions();
    const { user } = useAuth();
    // isDrawerOpen and closeDrawer will now control the checkbox state
    const { isDrawerOpen, closeDrawer, theme, setTheme } = useUI();

    const handleThemeChange = (newTheme: AppConfig["theme"]) => {
        setTheme(newTheme);
    };

    if (!user) {
        return null;
    }

    return (
        /* drawer-end puts the sidebar on the right */
        <div className="drawer drawer-end">
            {/* Using checkbox to CONTROL drawer state */}
            <input
                id="main-drawer"
                type="checkbox"
                className="drawer-toggle"
                checked={isDrawerOpen}
                onChange={(e) => !e.target.checked && closeDrawer()}
            />

            <div className="drawer-content">
                {/* Your main app content/routes usually go here. 
                    If this component is just the sidebar wrapper, 
                    you can leave this empty or wrap your page.
                */}
            </div>

            <div className="drawer-side z-50">
                <label
                    htmlFor="main-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                    onClick={closeDrawer}
                ></label>

                <div className="menu p-4 w-80 min-h-full bg-base-100 text-base-content">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">
                            帳戶與設定
                        </h2>
                        {/* daisyUI doesn't strictly need a close button if you use the overlay, 
                but we can keep it for UX */}
                        <button
                            onClick={closeDrawer}
                            className="btn btn-sm btn-circle btn-ghost"
                        >
                            ✕
                        </button>
                    </div>

                    {/* User Profile */}
                    <div className="flex items-center gap-4 mb-8 px-2">
                        <div className="avatar">
                            <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                <img src={user.picture} alt={user.name} />
                            </div>
                        </div>
                        <div>
                            <p className="font-bold">{user.name}</p>
                            <p className="text-xs opacity-60">{user.email}</p>
                        </div>
                    </div>

                    {/* Settings Section */}
                    <div className="flex-grow">
                        <div className="form-control w-full">
                            {/* <label className="label">
                                <span className="label-text">Theme</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                value={theme}
                                onChange={(e) =>
                                    handleThemeChange(
                                        e.target.value as AppConfig["theme"]
                                    )
                                }
                            >
                                <option value="classic">
                                    Classic (System)
                                </option>
                                <option value="forest">
                                    Forest (Dark Green)
                                </option>
                                <option value="ocean">
                                    Ocean (Light Teal)
                                </option>
                            </select> */}
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        type="button"
                        onClick={() => {
                            signOut();
                            closeDrawer();
                        }}
                        className="btn btn-primary btn-block gap-2 mt-4"
                    >
                        <LogOut size={20} />
                        Log out
                    </button>
                </div>
            </div>
        </div>
    );
};
