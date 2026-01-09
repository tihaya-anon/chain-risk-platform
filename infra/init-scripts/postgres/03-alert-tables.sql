-- Alert Service Tables
-- This script creates tables for alert rules, alert history, and alert subscriptions

-- ============================================
-- Alert Rules Table
-- ============================================
CREATE TABLE IF NOT EXISTS alert.alert_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,  -- 'risk_score', 'transaction_value', 'tag_match', 'graph_pattern', 'velocity', 'cluster_risk'
    conditions JSONB NOT NULL,       -- Rule conditions (flexible JSON structure)
    severity VARCHAR(20) NOT NULL,   -- 'low', 'medium', 'high', 'critical'
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for alert_rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert.alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert.alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_severity ON alert.alert_rules(severity);

-- Comments
COMMENT ON TABLE alert.alert_rules IS 'Alert rule definitions';
COMMENT ON COLUMN alert.alert_rules.rule_type IS 'Type of alert rule: risk_score, transaction_value, tag_match, graph_pattern, velocity, cluster_risk';
COMMENT ON COLUMN alert.alert_rules.conditions IS 'JSON object containing rule-specific conditions';
COMMENT ON COLUMN alert.alert_rules.severity IS 'Alert severity level: low, medium, high, critical';

-- ============================================
-- Alert History Table
-- ============================================
CREATE TABLE IF NOT EXISTS alert.alert_history (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES alert.alert_rules(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- 'address', 'transaction', 'cluster'
    entity_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,                    -- Additional context (scores, values, etc.)
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'acknowledged'
    notified_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for alert_history
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert.alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_entity ON alert.alert_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert.alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert.alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert.alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert.alert_history(alert_type);

-- Comments
COMMENT ON TABLE alert.alert_history IS 'Historical record of all triggered alerts';
COMMENT ON COLUMN alert.alert_history.entity_type IS 'Type of entity that triggered the alert';
COMMENT ON COLUMN alert.alert_history.entity_id IS 'Identifier of the entity (address, tx hash, cluster id)';
COMMENT ON COLUMN alert.alert_history.metadata IS 'Additional context data in JSON format';
COMMENT ON COLUMN alert.alert_history.status IS 'Alert notification status: pending, sent, failed, acknowledged';

-- ============================================
-- Alert Subscriptions Table
-- ============================================
CREATE TABLE IF NOT EXISTS alert.alert_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    rule_id BIGINT REFERENCES alert.alert_rules(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,  -- 'email', 'webhook', 'slack', 'telegram'
    channel_config JSONB NOT NULL,      -- Channel-specific configuration
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for alert_subscriptions
CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert.alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_rule ON alert.alert_subscriptions(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_channel ON alert.alert_subscriptions(channel_type);
CREATE INDEX IF NOT EXISTS idx_alert_subs_enabled ON alert.alert_subscriptions(enabled);

-- Comments
COMMENT ON TABLE alert.alert_subscriptions IS 'User subscriptions to alert rules with notification channels';
COMMENT ON COLUMN alert.alert_subscriptions.channel_type IS 'Notification channel: email, webhook, slack, telegram';
COMMENT ON COLUMN alert.alert_subscriptions.channel_config IS 'Channel-specific configuration (email address, webhook URL, etc.)';

-- ============================================
-- Insert Default Alert Rules
-- ============================================

-- High Risk Address Alert
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES (
    'High Risk Address Detected',
    'Alert when an address has a risk score above 80',
    'risk_score',
    '{"threshold": 80, "operator": ">=", "window": "5m"}'::jsonb,
    'high',
    true
) ON CONFLICT DO NOTHING;

-- Large Transaction Alert
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES (
    'Large Transaction Alert',
    'Alert when a transaction value exceeds $1M USD',
    'transaction_value',
    '{"threshold": 1000000, "operator": ">", "currency": "USD"}'::jsonb,
    'medium',
    true
) ON CONFLICT DO NOTHING;

-- Sanctioned Address Interaction
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES (
    'Sanctioned Address Interaction',
    'Alert when interaction with sanctioned or OFAC addresses detected',
    'tag_match',
    '{"tags": ["Sanctioned", "OFAC"], "match_type": "any"}'::jsonb,
    'critical',
    true
) ON CONFLICT DO NOTHING;

-- Mixer Usage Alert
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES (
    'Mixer Usage Detected',
    'Alert when mixer or Tornado Cash usage detected',
    'tag_match',
    '{"tags": ["Mixer", "Tornado Cash"], "match_type": "any"}'::jsonb,
    'high',
    true
) ON CONFLICT DO NOTHING;

-- High Velocity Transactions
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES (
    'High Transaction Velocity',
    'Alert when transaction count exceeds 100 in 1 hour',
    'velocity',
    '{"count": 100, "window": "1h"}'::jsonb,
    'medium',
    true
) ON CONFLICT DO NOTHING;

-- Critical Risk Score
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES (
    'Critical Risk Score',
    'Alert when risk score reaches critical level (>= 90)',
    'risk_score',
    '{"threshold": 90, "operator": ">=", "window": "1m"}'::jsonb,
    'critical',
    true
) ON CONFLICT DO NOTHING;

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION alert.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for alert_rules
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert.alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON alert.alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION alert.update_updated_at_column();

-- Trigger for alert_subscriptions
DROP TRIGGER IF EXISTS update_alert_subscriptions_updated_at ON alert.alert_subscriptions;
CREATE TRIGGER update_alert_subscriptions_updated_at
    BEFORE UPDATE ON alert.alert_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION alert.update_updated_at_column();

-- ============================================
-- Grant Permissions
-- ============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA alert TO chainrisk;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA alert TO chainrisk;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA alert TO chainrisk;
