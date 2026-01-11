"use client";

import { useState, useCallback, useEffect } from 'react';
import { User } from '../types';

const USER_STORAGE_KEY = 'tripsplit_user';

type UseLocalStorageUser = {
    user: User | null;
    saveUser: (user: User) => void;
    clearUser: () => void;
    isInitialized: boolean;
}

export function useLocalStorageUser(): UseLocalStorageUser {
    const [user, setUser] = useState<User | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // This effect runs only on the client, after the initial render.
        try {
            const item = window.localStorage.getItem(USER_STORAGE_KEY);
            setUser(item ? JSON.parse(item) : null);
        } catch (error) {
            console.error("Failed to parse user from localStorage", error);
            setUser(null);
        }
        setIsInitialized(true);
    }, []);

    const saveUser = useCallback((newUser: User) => {
        try {
            window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
            setUser(newUser);
        } catch (error) {
            console.error("Failed to save user to localStorage", error);
        }
    }, []);

    const clearUser = useCallback(() => {
        try {
            window.localStorage.removeItem(USER_STORAGE_KEY);
            setUser(null);
        } catch (error) {
            console.error("Failed to clear user from localStorage", error);
        }
    }, []);

    return { user, saveUser, clearUser, isInitialized };
}
