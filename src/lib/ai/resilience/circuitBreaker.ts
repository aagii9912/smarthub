/**
 * Circuit Breaker - API resilience pattern for OpenAI
 * Prevents cascade failures and provides graceful degradation
 */

import { logger } from '@/lib/utils/logger';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    failureThreshold: number;     // Number of failures before opening
    successThreshold: number;     // Successes needed to close from half-open
    timeout: number;              // Time in ms before trying again (half-open)
    monitoringPeriod: number;     // Time window for counting failures
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,         // 30 seconds
    monitoringPeriod: 60000 // 1 minute
};

/**
 * Failure record
 */
interface FailureRecord {
    timestamp: number;
    error: string;
}

/**
 * Circuit breaker state
 */
interface BreakerState {
    state: CircuitState;
    failures: FailureRecord[];
    successCount: number;
    lastFailureTime: number;
    lastStateChange: number;
}

/**
 * Circuit breakers for different services
 */
const breakers: Map<string, BreakerState> = new Map();

/**
 * Get or create breaker state
 */
function getBreakerState(name: string): BreakerState {
    if (!breakers.has(name)) {
        breakers.set(name, {
            state: 'closed',
            failures: [],
            successCount: 0,
            lastFailureTime: 0,
            lastStateChange: Date.now()
        });
    }
    return breakers.get(name)!;
}

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
    private name: string;
    private config: CircuitBreakerConfig;

    constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
        this.name = name;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get current state
     */
    getState(): CircuitState {
        return this.checkAndUpdateState();
    }

    /**
     * Check and possibly transition state
     */
    private checkAndUpdateState(): CircuitState {
        const breaker = getBreakerState(this.name);
        const now = Date.now();

        // If open, check if timeout has passed
        if (breaker.state === 'open') {
            if (now - breaker.lastFailureTime >= this.config.timeout) {
                this.transitionTo('half-open');
            }
        }

        // Clean old failures outside monitoring period
        breaker.failures = breaker.failures.filter(
            f => now - f.timestamp < this.config.monitoringPeriod
        );

        return breaker.state;
    }

    /**
     * Transition to a new state
     */
    private transitionTo(newState: CircuitState): void {
        const breaker = getBreakerState(this.name);
        const oldState = breaker.state;

        breaker.state = newState;
        breaker.lastStateChange = Date.now();

        if (newState === 'half-open') {
            breaker.successCount = 0;
        }

        if (newState === 'closed') {
            breaker.failures = [];
            breaker.successCount = 0;
        }

        logger.info(`Circuit breaker "${this.name}" transitioned: ${oldState} → ${newState}`);
    }

    /**
     * Record a successful call
     */
    recordSuccess(): void {
        const breaker = getBreakerState(this.name);

        if (breaker.state === 'half-open') {
            breaker.successCount++;

            if (breaker.successCount >= this.config.successThreshold) {
                this.transitionTo('closed');
            }
        }
    }

    /**
     * Record a failed call
     */
    recordFailure(error: Error | string): void {
        const breaker = getBreakerState(this.name);
        const now = Date.now();

        // Add failure record
        breaker.failures.push({
            timestamp: now,
            error: typeof error === 'string' ? error : error.message
        });
        breaker.lastFailureTime = now;

        // Clean old failures
        breaker.failures = breaker.failures.filter(
            f => now - f.timestamp < this.config.monitoringPeriod
        );

        // Check if we should open the circuit
        if (breaker.state === 'closed' &&
            breaker.failures.length >= this.config.failureThreshold) {
            this.transitionTo('open');
        }

        // If half-open and failure, go back to open
        if (breaker.state === 'half-open') {
            this.transitionTo('open');
        }
    }

    /**
     * Check if circuit is allowing requests
     */
    isAllowed(): boolean {
        const state = this.checkAndUpdateState();
        return state !== 'open';
    }

    /**
     * Execute with circuit breaker protection
     */
    async execute<T>(
        operation: () => Promise<T>,
        fallback?: () => T | Promise<T>
    ): Promise<T> {
        const state = this.checkAndUpdateState();

        if (state === 'open') {
            logger.warn(`Circuit breaker "${this.name}" is OPEN, request blocked`);

            if (fallback) {
                return fallback();
            }

            throw new CircuitOpenError(
                `Circuit breaker "${this.name}" is open. Service temporarily unavailable.`
            );
        }

        try {
            const result = await operation();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure(error instanceof Error ? error : String(error));
            throw error;
        }
    }

    /**
     * Get circuit statistics
     */
    getStats(): {
        name: string;
        state: CircuitState;
        failureCount: number;
        successCount: number;
        lastFailure: Date | null;
        lastStateChange: Date;
    } {
        const breaker = getBreakerState(this.name);
        this.checkAndUpdateState();

        return {
            name: this.name,
            state: breaker.state,
            failureCount: breaker.failures.length,
            successCount: breaker.successCount,
            lastFailure: breaker.lastFailureTime ? new Date(breaker.lastFailureTime) : null,
            lastStateChange: new Date(breaker.lastStateChange)
        };
    }

    /**
     * Force reset the circuit
     */
    reset(): void {
        const breaker = getBreakerState(this.name);
        breaker.state = 'closed';
        breaker.failures = [];
        breaker.successCount = 0;
        breaker.lastStateChange = Date.now();

        logger.info(`Circuit breaker "${this.name}" manually reset`);
    }
}

/**
 * Custom error for open circuit
 */
export class CircuitOpenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

/**
 * Pre-configured circuit breakers
 */
export const openAIBreaker = new CircuitBreaker('openai', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,        // 1 minute
    monitoringPeriod: 120000  // 2 minutes
});

export const qpayBreaker = new CircuitBreaker('qpay', {
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 30000,
    monitoringPeriod: 60000
});

export const supabaseBreaker = new CircuitBreaker('supabase', {
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 15000,
    monitoringPeriod: 60000
});

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitStats(): Array<ReturnType<CircuitBreaker['getStats']>> {
    return [
        openAIBreaker.getStats(),
        qpayBreaker.getStats(),
        supabaseBreaker.getStats()
    ];
}
