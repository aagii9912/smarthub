'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import type { BusinessType } from '@/lib/constants/business-types';

const STORAGE_KEY = 'syncly_onboarding_state';
const EXPIRY_HOURS = 24; // State expires after 24 hours

interface OnboardingState {
    step: number;
    businessType?: BusinessType | null;
    shopData: {
        name?: string;
        owner_name?: string;
        phone?: string;
    };
    fbConnected: boolean;
    igConnected: boolean;
    productsAdded: boolean;
    aiConfigured: boolean;
    operationsConfigured: boolean;
    timestamp: number;
}

const defaultState: OnboardingState = {
    step: 0,
    businessType: null,
    shopData: {},
    fbConnected: false,
    igConnected: false,
    productsAdded: false,
    aiConfigured: false,
    operationsConfigured: false,
    timestamp: Date.now()
};

export function useOnboardingState() {
    const [state, setState] = useState<OnboardingState>(defaultState);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasExistingState, setHasExistingState] = useState(false);

    // Load state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: OnboardingState = JSON.parse(stored);

                // Check if state is expired
                const hoursElapsed = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
                if (hoursElapsed < EXPIRY_HOURS) {
                    // Backwards-compat: older state may not have new fields
                    setState({
                        ...defaultState,
                        ...parsed,
                        operationsConfigured: parsed.operationsConfigured ?? false,
                        businessType: parsed.businessType ?? null,
                    });
                    setHasExistingState(parsed.step > 0);
                } else {
                    // Clear expired state
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (err) {
            logger.error('Error loading onboarding state:', { error: err });
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Save state to localStorage
    const saveState = useCallback((updates: Partial<OnboardingState>) => {
        setState(prev => {
            const newState = {
                ...prev,
                ...updates,
                timestamp: Date.now()
            };

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            } catch (err) {
                logger.error('Error saving onboarding state:', { error: err });
            }

            return newState;
        });
    }, []);

    // Update step
    const setStep = useCallback((step: number) => {
        saveState({ step });
    }, [saveState]);

    // Update business type
    const setBusinessType = useCallback((type: BusinessType | null) => {
        saveState({ businessType: type });
    }, [saveState]);

    // Clear type-specific data when user changes business type mid-wizard.
    // Keeps general data (name, FB/IG, AI, bank) — clears products/operations flags
    // and the type itself if requested.
    const clearTypeSpecificData = useCallback(() => {
        saveState({
            productsAdded: false,
            operationsConfigured: false,
        });
    }, [saveState]);

    // Update shop data
    const updateShopData = useCallback((data: Partial<OnboardingState['shopData']>) => {
        setState(prev => {
            const newState = {
                ...prev,
                shopData: { ...prev.shopData, ...data },
                timestamp: Date.now()
            };

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            } catch (err) {
                logger.error('Error saving onboarding state:', { error: err });
            }

            return newState;
        });
    }, []);

    // Mark step as complete
    const markComplete = useCallback((key: 'fbConnected' | 'igConnected' | 'productsAdded' | 'aiConfigured' | 'operationsConfigured') => {
        saveState({ [key]: true });
    }, [saveState]);

    // Clear all state (start fresh)
    const clearState = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            logger.error('Error clearing onboarding state:', { error: err });
        }
        setState(defaultState);
        setHasExistingState(false);
    }, []);

    // Continue from saved state
    const continueFromSaved = useCallback(() => {
        // State is already loaded, just acknowledge
        setHasExistingState(false);
    }, []);

    return {
        // State
        step: state.step,
        businessType: state.businessType ?? null,
        shopData: state.shopData,
        fbConnected: state.fbConnected,
        igConnected: state.igConnected,
        productsAdded: state.productsAdded,
        aiConfigured: state.aiConfigured,
        operationsConfigured: state.operationsConfigured,

        // Meta
        isLoaded,
        hasExistingState,

        // Actions
        setStep,
        setBusinessType,
        clearTypeSpecificData,
        updateShopData,
        markComplete,
        saveState,
        clearState,
        continueFromSaved
    };
}
