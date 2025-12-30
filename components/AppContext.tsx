"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    createContext,
    useContext,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "../src/stores/AuthStore";
import {
    getIsSignedIn,
    getProfile,
    initGsiOnce,
    renderGoogleButton,
} from "../src/utils/auth";

// Services & Types
import { api, getMockExpenses } from "../services/api";
import { storage } from "../services/storage";
import { AppConfig, Expense, User, ApiState } from "../../types";

// Components
import { ExpenseForm } from "./ExpenseForm";
import { Layout } from "./Layout";

const DEMO_USER: User = { email: "demo@tripsplit.app", name: "Demo User" };

interface AppContextType {
    config?: AppConfig;
    user?: User;
    expenses: Expense[];
    apiState: ApiState;
    isInitialized: boolean;
    isDemo: boolean;
    googleButtonRef: React.RefObject<HTMLDivElement | null>;
    currentDate: Date;
    refreshExpenses: () => Promise<void>;
    handleSaveConfig: (newConfig: AppConfig) => Promise<void>;
    handleLogout: () => Promise<void>;
    handleLogin: (newUser: User) => Promise<void>;
    openEditForm: (e: Expense) => void;
    handleDeleteExpense: (id: string) => Promise<void>;
    setCurrentDate: (date: Date) => void;
    setShowForm: (show: boolean) => void;
    setEditingExpense: (expense: Expense | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { setSignIn, signOut: clearAuthState } = useAuthActions();
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const [config, setConfig] = useState<AppConfig | undefined>();
    const [user, setUser] = useState<User | undefined>();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [apiState, setApiState] = useState<ApiState>({
        isLoading: false,
        error: null,
        lastUpdated: null,
    });

    // UI State
    const [showForm, setShowForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    const router = useRouter();
    const pathname = usePathname();

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            try {
                const storedConfig = await storage.getConfig();
                const storedUser = await storage.getUser();
                const storedExpenses = await storage.getExpenses();

                if (storedConfig) setConfig(storedConfig);
                if (storedUser) {
                    setUser(storedUser);
                    setSignIn();
                }
                if (storedExpenses) setExpenses(storedExpenses);
            } catch (e) {
                console.error("Failed to load storage", e);
            } finally {
                setIsInitialized(true);
            }
        };
        init();
    }, [setSignIn]);

    // Check Google sign-in status and render button if signed out
    useEffect(() => {
        const ensureAuthState = async () => {
            const signedIn = getIsSignedIn();
            if (signedIn) {
                const profile = getProfile();
                if (profile?.email) {
                    setSignIn(profile);
                    const mappedUser = {
                        email: profile.email,
                        name: profile.name || profile.email,
                        picture: profile.picture,
                    };
                    setUser(mappedUser);
                    await storage.saveUser(mappedUser);
                }
                return;
            }

            try {
                initGsiOnce({
                    onSignedIn: () => {
                        const profileAfter = getProfile();
                        if (profileAfter?.email) {
                            setSignIn(profileAfter);
                            const mappedUser = {
                                email: profileAfter.email,
                                name: profileAfter.name || profileAfter.email,
                                picture: profileAfter.picture,
                            };
                            setUser(mappedUser);
                            storage.saveUser(mappedUser);
                            router.push("/");
                        }
                    },
                    onError: (e) => console.error(e),
                });
                if (googleButtonRef.current && window.google?.accounts?.id) {
                    renderGoogleButton(googleButtonRef.current);
                }
            } catch (err) {
                console.error("Failed to initialize Google sign-in", err);
            }
        };

        if (isInitialized && !user) {
            ensureAuthState();
        }
    }, [setSignIn, isInitialized, user, router]);

    // --- Theme Logic ---
    useEffect(() => {
        if (config?.theme) {
            document.documentElement.setAttribute("data-theme", config.theme);
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
    }, [config?.theme]);

    // --- API / Logic ---
    const refreshExpenses = useCallback(async () => {
        if (user?.email === DEMO_USER.email) {
            if (expenses.length === 0) {
                const mocks = getMockExpenses();
                setExpenses(mocks);
                await storage.saveExpenses(mocks);
            }
            setApiState((prev) => ({
                ...prev,
                isLoading: false,
                lastUpdated: Date.now(),
            }));
            return;
        }

        if (!config?.gasUrl || !user) return;

        setApiState((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
            const data = await api.fetchExpenses(config.gasUrl, user.email);
            setExpenses(data);
            await storage.saveExpenses(data);
            setApiState((prev) => ({
                ...prev,
                isLoading: false,
                lastUpdated: Date.now(),
            }));
        } catch (err: any) {
            setApiState((prev) => ({
                ...prev,
                isLoading: false,
                error: err.message,
            }));
            console.error(err);
        }
    }, [config, user, expenses.length]);

    // Initial fetch
    useEffect(() => {
        if (user && isInitialized) {
            if (user.email === DEMO_USER.email || (config && config.gasUrl)) {
                refreshExpenses();
            }
        }
    }, [user, config, isInitialized, refreshExpenses]);

    // --- Actions ---
    const handleSaveConfig = async (newConfig: AppConfig) => {
        await storage.saveConfig(newConfig);
        setConfig(newConfig);
        alert("Configuration saved.");
    };

    const handleLogout = async () => {
        await storage.clearUser();
        clearAuthState();
        setUser(undefined);
        setExpenses([]);
        router.push("/login");
    };

    const handleLogin = async (newUser: User) => {
        await storage.saveUser(newUser);
        setSignIn();
        setUser(newUser);
        router.push("/");
    };

    const handleSaveExpense = async (expense: Expense) => {
        const isEdit = !!editingExpense;
        let newExpenses;
        if (isEdit) {
            newExpenses = expenses.map((e) =>
                e.id === expense.id ? expense : e
            );
        } else {
            newExpenses = [expense, ...expenses];
        }

        setExpenses(newExpenses);
        setShowForm(false);
        setEditingExpense(null);
        await storage.saveExpenses(newExpenses);

        if (user?.email === DEMO_USER.email) return;
        if (!config?.gasUrl || !user) return;

        try {
            await api.syncTransaction(
                config.gasUrl,
                user.email,
                isEdit ? "edit" : "add",
                expense
            );
        } catch (err) {
            alert(
                "Failed to sync with Google Sheets. Data is local only for now."
            );
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!window.confirm("Delete this expense?")) return;

        const expenseToDelete = expenses.find((e) => e.id === id);
        if (!expenseToDelete) return;

        const newExpenses = expenses.filter((e) => e.id !== id);
        setExpenses(newExpenses);
        await storage.saveExpenses(newExpenses);

        if (user?.email === DEMO_USER.email) return;
        if (!config?.gasUrl || !user) return;

        try {
            await api.syncTransaction(
                config.gasUrl,
                user.email,
                "delete",
                expenseToDelete
            );
        } catch (err) {
            console.error(err);
        }
    };

    const openEditForm = (e: Expense) => {
        setEditingExpense(e);
        setShowForm(true);
    };

    // --- Route Protection ---
    useEffect(() => {
        if (!isInitialized) return;
        const isPublicPage = ["/login"].includes(pathname);

        if (!user && !isPublicPage) {
            router.push("/login");
        }
        if (user && isPublicPage) {
            router.push("/");
        }
    }, [isInitialized, user, pathname, router]);


    // --- Render ---
    if (!isInitialized) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const isDemo = user?.email === DEMO_USER.email;

    const contextValue = {
        config,
        user,
        expenses,
        apiState,
        isInitialized,
        isDemo,
        googleButtonRef,
        currentDate,
        refreshExpenses,
        handleSaveConfig,
        handleLogout,
        handleLogin,
        openEditForm,
        handleDeleteExpense,
        setCurrentDate,
        setShowForm,
        setEditingExpense,
    };
    
    const isPublicPage = ["/login"].includes(pathname);

    return (
        <AppContext.Provider value={contextValue}>
            <div className="min-h-screen bg-background text-text-main font-sans transition-colors duration-300">
                
                {!isPublicPage && user ? (
                    <Layout
                        user={user}
                        isDemo={isDemo}
                        apiState={apiState}
                        onAddClick={() => {
                            setEditingExpense(null);
                            setShowForm(true);
                        }}
                    >
                        {children}
                    </Layout>
                ) : (
                    children
                )}

                {showForm && user && (
                    <ExpenseForm
                        initialData={editingExpense}
                        defaultDate={currentDate}
                        currentUser={user}
                        onSave={handleSaveExpense}
                        onCancel={() => {
                            setShowForm(false);
                            setEditingExpense(null);
                        }}
                    />
                )}
            </div>
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
}
