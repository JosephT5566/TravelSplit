import React, { useState, useEffect, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

// Services & Types
import { api, getMockExpenses } from "./services/api";
import { storage } from "./services/storage";
import { AppConfig, Expense, User, ApiState } from "./types";

// Components
import { Layout } from "./components/Layout";
import { ExpenseForm } from "./components/ExpenseForm";

// Pages
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ListPage } from "./pages/ListPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SearchPage } from "./pages/SearchPage";

const DEMO_USER: User = { email: "demo@tripsplit.app", name: "Demo User" };

export default function App() {
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

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            try {
                const storedConfig = await storage.getConfig();
                const storedUser = await storage.getUser();
                const storedExpenses = await storage.getExpenses();

                if (storedConfig) setConfig(storedConfig);
                if (storedUser) setUser(storedUser);
                if (storedExpenses) setExpenses(storedExpenses);
            } catch (e) {
                console.error("Failed to load storage", e);
            } finally {
                setIsInitialized(true);
            }
        };
        init();
    }, []);

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
        // Demo Mode Logic
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

        // Normal Logic
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
        setUser(undefined);
        setExpenses([]);
        window.location.hash = "/login";
    };

    const handleLogin = async (newUser: User) => {
        await storage.saveUser(newUser);
        setUser(newUser);
    };

    const handleSaveExpense = async (expense: Expense) => {
        // Optimistic update
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

        // Sync Logic
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

    // --- Render ---
    if (!isInitialized) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const isDemo = user?.email === DEMO_USER.email;

    return (
        <HashRouter>
            <div className="min-h-screen bg-background text-text-main font-sans transition-colors duration-300">
                <Routes>
                    {/* Public Routes */}
                    <Route
                        path="/login"
                        element={
                            user ? (
                                <Navigate to="/" />
                            ) : (
                                <Login
                                    onLogin={handleLogin}
                                    config={config}
                                    demoUser={DEMO_USER}
                                />
                            )
                        }
                    />

                    <Route
                        path="/settings"
                        element={
                            <SettingsPage
                                config={config}
                                onSave={handleSaveConfig}
                                onLogout={handleLogout}
                            />
                        }
                    />

                    <Route
                        path="/search"
                        element={
                            user ? (
                                <SearchPage
                                    expenses={expenses}
                                    onEdit={openEditForm}
                                    onDelete={handleDeleteExpense}
                                />
                            ) : (
                                <Navigate to="/login" />
                            )
                        }
                    />

                    {/* Protected Routes (wrapped in Layout) */}
                    <Route
                        path="/"
                        element={
                            !user ? (
                                <Navigate to="/login" />
                            ) : (
                                <Layout
                                    user={user}
                                    isDemo={isDemo}
                                    apiState={apiState}
                                    onAddClick={() => {
                                        setEditingExpense(null);
                                        setShowForm(true);
                                    }}
                                />
                            )
                        }
                    >
                        <Route
                            index
                            element={
                                <Dashboard
                                    expenses={expenses}
                                    apiState={apiState}
                                    onRefresh={refreshExpenses}
                                    baseCurrency={config?.baseCurrency || "TWD"}
                                />
                            }
                        />
                        <Route
                            path="list"
                            element={
                                <ListPage
                                    expenses={expenses}
                                    currentDate={currentDate}
                                    onDateChange={setCurrentDate}
                                    onEdit={openEditForm}
                                    onDelete={handleDeleteExpense}
                                    baseCurrency={config?.baseCurrency || "TWD"}
                                />
                            }
                        />
                    </Route>
                </Routes>

                {/* Global Modal */}
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
        </HashRouter>
    );
}
