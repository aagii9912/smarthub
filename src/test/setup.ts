import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
vi.stubEnv('FACEBOOK_PAGE_ACCESS_TOKEN', 'test-fb-token');
vi.stubEnv('FACEBOOK_VERIFY_TOKEN', 'test-verify-token');

// Mock fetch globally
global.fetch = vi.fn();

// Mock console methods to reduce noise in test output
vi.spyOn(console, 'log').mockImplementation(() => { });
vi.spyOn(console, 'debug').mockImplementation(() => { });
vi.spyOn(console, 'info').mockImplementation(() => { });
