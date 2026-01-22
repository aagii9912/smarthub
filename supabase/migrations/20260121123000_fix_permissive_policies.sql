-- Fix "RLS Policy Always True" Warnings
-- We replace "true" (public) checks with "auth.role() = 'authenticated'" or stricter rules.

-- 1. ab_experiments (Was allowing EVERYONE to do EVERYTHING)
DROP POLICY IF EXISTS "Admins can manage experiments" ON ab_experiments;

-- New Policy: Only allow viewing active experiments (for running tests)
DROP POLICY IF EXISTS "Anyone can view active experiments" ON ab_experiments;
CREATE POLICY "Anyone can view active experiments" 
ON ab_experiments FOR SELECT 
USING (is_active = true);

-- Note: Management (Insert/Update/Delete) is now restricted to Service Role (Backend) only.


-- 2. ai_analytics (Was allowing INSERT by anyone)
DROP POLICY IF EXISTS "System can insert analytics" ON ai_analytics;

DROP POLICY IF EXISTS "Authenticated users can insert analytics" ON ai_analytics;
CREATE POLICY "Authenticated users can insert analytics" 
ON ai_analytics FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');


-- 3. conversion_funnel
DROP POLICY IF EXISTS "System can insert funnel data" ON conversion_funnel;

DROP POLICY IF EXISTS "Authenticated users can insert funnel data" ON conversion_funnel;
CREATE POLICY "Authenticated users can insert funnel data" 
ON conversion_funnel FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');


-- 4. ab_experiment_results
DROP POLICY IF EXISTS "System can insert experiment results" ON ab_experiment_results;

DROP POLICY IF EXISTS "Authenticated users can insert experiment results" ON ab_experiment_results;
CREATE POLICY "Authenticated users can insert experiment results" 
ON ab_experiment_results FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
