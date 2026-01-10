'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const PULL_THRESHOLD = 80; // Distance to trigger refresh
    const MAX_PULL = 120; // Maximum pull distance

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (disabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container) return;

        // Only start pull if scrolled to top
        if (container.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isPulling || disabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) {
            setIsPulling(false);
            setPullDistance(0);
            return;
        }

        const currentY = e.touches[0].clientY;
        const distance = currentY - touchStartY.current;

        if (distance > 0) {
            // Prevent default scroll behavior when pulling
            e.preventDefault();

            // Apply resistance curve
            const resistance = 0.5;
            const adjustedDistance = Math.min(distance * resistance, MAX_PULL);
            setPullDistance(adjustedDistance);
        }
    }, [isPulling, disabled, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling || disabled) return;

        setIsPulling(false);

        if (pullDistance >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } catch (error) {
                console.error('Refresh failed:', error);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, disabled, onRefresh, PULL_THRESHOLD]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
    const rotation = pullProgress * 360;

    return (
        <div ref={containerRef} className="h-full overflow-y-auto smooth-scroll">
            {/* Pull indicator */}
            <div
                className="flex justify-center items-center transition-all duration-200 ease-out"
                style={{
                    height: isRefreshing ? '60px' : `${pullDistance}px`,
                    opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
                }}
            >
                <div className="flex flex-col items-center gap-1">
                    <RefreshCw
                        className={`w-5 h-5 text-primary ${isRefreshing ? 'refresh-spinning' : ''}`}
                        style={{
                            transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
                            transition: isRefreshing ? 'none' : 'transform 0.1s ease-out',
                        }}
                    />
                    <span className="text-xs text-muted-foreground">
                        {isRefreshing ? 'Шинэчилж байна...' : pullProgress >= 1 ? 'Суллаад шинэчлэх' : 'Татаад шинэчлэх'}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${isRefreshing ? '0px' : pullDistance > 0 ? `${pullDistance}px` : '0px'})`,
                    transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                }}
            >
                {children}
            </div>
        </div>
    );
}
