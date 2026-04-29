-- ============================================
-- Payment Audit Logs
-- Tracks every payment state change for order payments
-- Created: 2026-04-15
-- ============================================

CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

    -- Audit fields
    action TEXT NOT NULL,           -- 'created', 'status_changed', 'paid', 'failed', 'expired', 'refunded'
    old_status TEXT,
    new_status TEXT,
    amount DECIMAL(12,2),
    payment_method TEXT,

    -- Context
    actor TEXT NOT NULL DEFAULT 'system',  -- 'system', 'webhook', 'pay_page_poll', 'shop_owner', 'admin'
    actor_id TEXT,                          -- user ID or system identifier
    ip_address TEXT,

    -- Details
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_payment ON payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_shop ON payment_audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_order ON payment_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON payment_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON payment_audit_logs(action);

-- ============================================
-- Trigger: Auto-log payment status changes
-- Fires on INSERT and UPDATE of payments table
-- Only logs order payments (payment_type = 'order')
-- ============================================
CREATE OR REPLACE FUNCTION log_payment_audit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only audit order payments (type 2)
    IF COALESCE(NEW.payment_type, 'order') != 'order' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO payment_audit_logs (
            payment_id, shop_id, order_id,
            action, new_status, amount, payment_method,
            actor, metadata
        ) VALUES (
            NEW.id, NEW.shop_id, NEW.order_id,
            'created', NEW.status::TEXT, NEW.amount, NEW.payment_method,
            'system',
            jsonb_build_object(
                'qpay_invoice_id', NEW.qpay_invoice_id,
                'payment_type', NEW.payment_type
            )
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO payment_audit_logs (
            payment_id, shop_id, order_id,
            action, old_status, new_status, amount, payment_method,
            actor, metadata
        ) VALUES (
            NEW.id, NEW.shop_id, NEW.order_id,
            CASE
                WHEN NEW.status::TEXT = 'paid' THEN 'paid'
                WHEN NEW.status::TEXT = 'failed' THEN 'failed'
                WHEN NEW.status::TEXT = 'expired' THEN 'expired'
                WHEN NEW.status::TEXT = 'refunded' THEN 'refunded'
                ELSE 'status_changed'
            END,
            OLD.status::TEXT, NEW.status::TEXT,
            NEW.amount, NEW.payment_method,
            'system',
            jsonb_build_object(
                'qpay_transaction_id', NEW.qpay_transaction_id,
                'paid_at', NEW.paid_at
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_payment_audit ON payments;

-- Create trigger (AFTER to not block the original operation)
CREATE TRIGGER trigger_payment_audit
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION log_payment_audit();

-- RLS policies
ALTER TABLE payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Shop owners can read their own audit logs
DROP POLICY IF EXISTS "Shop owners can view own audit logs" ON payment_audit_logs;
CREATE POLICY "Shop owners can view own audit logs"
    ON payment_audit_logs
    FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE user_id = auth.uid()::TEXT
        )
    );

-- Service role has full access (for triggers and API)
DROP POLICY IF EXISTS "Service role full access to audit logs" ON payment_audit_logs;
CREATE POLICY "Service role full access to audit logs"
    ON payment_audit_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE payment_audit_logs IS 'Audit trail for order payment lifecycle (created → pending → paid/failed/expired)';
COMMENT ON COLUMN payment_audit_logs.action IS 'created, paid, failed, expired, refunded, status_changed';
COMMENT ON COLUMN payment_audit_logs.actor IS 'system (trigger), webhook, pay_page_poll, shop_owner, admin';

SELECT 'Payment audit logs table and trigger created ✅' as result;
