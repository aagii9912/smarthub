'use client';

import { useState, useEffect } from 'react';

export function useMobile() {
    const [isMobile, setIsMobile] = useState(false);
    const [screenWidth, setScreenWidth] = useState(0);
    const [isPortrait, setIsPortrait] = useState(true);

    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            setScreenWidth(width);
            setIsPortrait(window.innerHeight > window.innerWidth);
        };

        // Initial check
        checkMobile();

        // Listen for resize events
        window.addEventListener('resize', checkMobile);
        window.addEventListener('orientationchange', checkMobile);

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('orientationchange', checkMobile);
        };
    }, []);

    return {
        isMobile,
        isTablet: screenWidth >= 768 && screenWidth < 1024,
        isDesktop: screenWidth >= 1024,
        screenWidth,
        isPortrait,
        isLandscape: !isPortrait,
        breakpoint: isMobile ? 'mobile' : screenWidth < 1024 ? 'tablet' : 'desktop',
    };
}

export function useSafeArea() {
    const [safeArea, setSafeArea] = useState({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    });

    useEffect(() => {
        const computeSafeArea = () => {
            const getEnv = (name: string) => {
                const value = getComputedStyle(document.documentElement)
                    .getPropertyValue(`--safe-area-inset-${name}`);
                return parseInt(value) || 0;
            };

            setSafeArea({
                top: getEnv('top'),
                right: getEnv('right'),
                bottom: getEnv('bottom'),
                left: getEnv('left'),
            });
        };

        computeSafeArea();
        window.addEventListener('resize', computeSafeArea);
        window.addEventListener('orientationchange', computeSafeArea);

        return () => {
            window.removeEventListener('resize', computeSafeArea);
            window.removeEventListener('orientationchange', computeSafeArea);
        };
    }, []);

    return safeArea;
}

export function useIsTouchDevice() {
    const [isTouch, setIsTouch] = useState(false);

    useEffect(() => {
        const checkTouch = () => {
            const hasTouch = 'ontouchstart' in window ||
                navigator.maxTouchPoints > 0 ||
                // msMaxTouchPoints is vendor specific
                (navigator as unknown as { msMaxTouchPoints: number }).msMaxTouchPoints > 0;

            setIsTouch(!!hasTouch);
        };

        checkTouch();
    }, []);

    return isTouch;
}
