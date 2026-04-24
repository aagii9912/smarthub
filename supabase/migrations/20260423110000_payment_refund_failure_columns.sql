-- ============================================
-- Payment refund & failure metadata columns
-- Allows capturing refund amount / reason / actor plus failure code / reason
-- so the audit trail shows WHY a payment failed or was refunded.
-- ============================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;

COMMENT ON COLUMN payments.refund_amount IS 'Refunded amount (may be partial <= amount)';
COMMENT ON COLUMN payments.refunded_at IS 'Timestamp when the refund was executed';
COMMENT ON COLUMN payments.refund_reason IS 'Human readable reason captured at refund time';
COMMENT ON COLUMN payments.failure_code IS 'Short machine code for the failure e.g. QPAY_TIMEOUT, INSUFFICIENT_FUNDS';
COMMENT ON COLUMN payments.failure_reason IS 'Human readable description of the failure cause';

SELECT 'Payment refund/failure metadata columns added ✅' as result;
