-- Enable RLS on AI & Shop Settings tables
ALTER TABLE IF EXISTS shop_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shop_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shop_slogans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_question_stats ENABLE ROW LEVEL SECURITY;

-- 1. Policies for shop_faqs
DROP POLICY IF EXISTS "Users can view own faqs" ON shop_faqs;
DROP POLICY IF EXISTS "Users can manage own faqs" ON shop_faqs;
CREATE POLICY "Users can manage own faqs" ON shop_faqs
    FOR ALL
    USING (shop_id IN (SELECT id FROM shops WHERE user_id::text = auth.uid()::text));

-- 2. Policies for shop_quick_replies
DROP POLICY IF EXISTS "Users can view own quick_replies" ON shop_quick_replies;
DROP POLICY IF EXISTS "Users can manage own quick_replies" ON shop_quick_replies;
CREATE POLICY "Users can manage own quick_replies" ON shop_quick_replies
    FOR ALL
    USING (shop_id IN (SELECT id FROM shops WHERE user_id::text = auth.uid()::text));

-- 3. Policies for shop_slogans
DROP POLICY IF EXISTS "Users can view own slogans" ON shop_slogans;
DROP POLICY IF EXISTS "Users can manage own slogans" ON shop_slogans;
CREATE POLICY "Users can manage own slogans" ON shop_slogans
    FOR ALL
    USING (shop_id IN (SELECT id FROM shops WHERE user_id::text = auth.uid()::text));

-- 4. Policies for ai_conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON ai_conversations;
CREATE POLICY "Users can manage own conversations" ON ai_conversations
    FOR ALL
    USING (shop_id IN (SELECT id FROM shops WHERE user_id::text = auth.uid()::text));

-- 5. Policies for ai_question_stats
DROP POLICY IF EXISTS "Users can view own stats" ON ai_question_stats;
DROP POLICY IF EXISTS "Users can manage own stats" ON ai_question_stats;
CREATE POLICY "Users can manage own stats" ON ai_question_stats
    FOR ALL
    USING (shop_id IN (SELECT id FROM shops WHERE user_id::text = auth.uid()::text));
