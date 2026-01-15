-- ============================================
-- AI Features Enhancement Migration
-- Version: 013_ai_features.sql
-- Features: FAQ, Quick Replies, Slogans, AI Stats
-- ============================================

-- ============================================
-- 1. SHOP_FAQS TABLE
-- Түгээмэл асуултууд
-- ============================================
CREATE TABLE IF NOT EXISTS shop_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50), -- 'general', 'products', 'delivery', 'payment', etc.
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_shop_faqs_shop ON shop_faqs(shop_id, is_active);

-- ============================================
-- 2. SHOP_QUICK_REPLIES TABLE
-- Хурдан хариултууд (trigger → response)
-- ============================================
CREATE TABLE IF NOT EXISTS shop_quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Display name for UI
    trigger_words TEXT[] NOT NULL, -- Array of trigger words: {"үнэ", "хэд вэ", "price"}
    response TEXT NOT NULL,
    is_exact_match BOOLEAN DEFAULT false, -- true = exact match, false = contains
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_quick_replies_shop ON shop_quick_replies(shop_id, is_active);

-- ============================================
-- 3. SHOP_SLOGANS TABLE
-- Тусгай хэллэгүүд
-- ============================================
CREATE TABLE IF NOT EXISTS shop_slogans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    slogan TEXT NOT NULL,
    usage_context VARCHAR(50) DEFAULT 'any', -- 'greeting', 'closing', 'promotion', 'any'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_slogans_shop ON shop_slogans(shop_id, is_active);

-- ============================================
-- 4. AI_CONVERSATIONS TABLE
-- AI ярианы бүртгэл (статистикийн хувьд)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    session_id VARCHAR(100), -- For grouping messages in same session
    message_count INTEGER DEFAULT 0,
    customer_messages INTEGER DEFAULT 0,
    ai_messages INTEGER DEFAULT 0,
    topics TEXT[], -- Detected topics: {'products', 'pricing', 'delivery'}
    questions JSONB DEFAULT '[]', -- [{question, timestamp}]
    sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'
    converted_to_order BOOLEAN DEFAULT false,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_shop ON ai_conversations(shop_id, started_at);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer ON ai_conversations(customer_id);

-- ============================================
-- 5. AI_QUESTION_STATS TABLE
-- Түгээмэл асуултуудын статистик
-- ============================================
CREATE TABLE IF NOT EXISTS ai_question_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    question_pattern TEXT NOT NULL, -- Normalized question pattern
    sample_question TEXT, -- Example of actual question
    category VARCHAR(50), -- 'pricing', 'availability', 'delivery', 'product_info', etc.
    count INTEGER DEFAULT 1,
    last_asked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, question_pattern)
);

CREATE INDEX IF NOT EXISTS idx_ai_question_stats_shop ON ai_question_stats(shop_id, count DESC);

-- ============================================
-- 6. UPDATE SHOPS TABLE
-- AI статистикийн талбарууд
-- ============================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_total_conversations INTEGER DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_total_messages INTEGER DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_conversion_rate DECIMAL(5,2) DEFAULT 0; -- %
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ai_avg_response_time INTEGER DEFAULT 0; -- ms

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to increment question stats
CREATE OR REPLACE FUNCTION increment_question_stat(
    p_shop_id UUID,
    p_question TEXT,
    p_category VARCHAR(50) DEFAULT 'general'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pattern TEXT;
BEGIN
    -- Normalize question (lowercase, remove punctuation)
    v_pattern := LOWER(REGEXP_REPLACE(p_question, '[^\w\s]', '', 'g'));
    v_pattern := TRIM(REGEXP_REPLACE(v_pattern, '\s+', ' ', 'g'));
    
    -- Truncate to first 100 chars for pattern
    v_pattern := LEFT(v_pattern, 100);
    
    INSERT INTO ai_question_stats (shop_id, question_pattern, sample_question, category, count, last_asked_at)
    VALUES (p_shop_id, v_pattern, p_question, p_category, 1, NOW())
    ON CONFLICT (shop_id, question_pattern) 
    DO UPDATE SET 
        count = ai_question_stats.count + 1,
        last_asked_at = NOW();
END;
$$;

-- Function to update shop AI stats
CREATE OR REPLACE FUNCTION update_shop_ai_stats(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_convos INTEGER;
    v_total_messages INTEGER;
    v_converted INTEGER;
    v_conversion_rate DECIMAL(5,2);
BEGIN
    SELECT 
        COUNT(*),
        COALESCE(SUM(message_count), 0),
        COUNT(*) FILTER (WHERE converted_to_order = true)
    INTO v_total_convos, v_total_messages, v_converted
    FROM ai_conversations
    WHERE shop_id = p_shop_id;
    
    v_conversion_rate := CASE 
        WHEN v_total_convos > 0 THEN (v_converted::DECIMAL / v_total_convos * 100)
        ELSE 0 
    END;
    
    UPDATE shops SET 
        ai_total_conversations = v_total_convos,
        ai_total_messages = v_total_messages,
        ai_conversion_rate = v_conversion_rate
    WHERE id = p_shop_id;
END;
$$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'AI Features tables created successfully! ✅' as result;
