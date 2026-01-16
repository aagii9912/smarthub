import { beforeAll, vi } from 'vitest'

// Mock environment variables
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key'
  process.env.OPENAI_API_KEY = 'mock-openai-key'
})

// Mock generic logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}))
