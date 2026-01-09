package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

// AlertSubscriptionRepository defines subscription repository operations
type AlertSubscriptionRepository interface {
	Create(ctx context.Context, sub *model.AlertSubscription) error
	GetByID(ctx context.Context, id int64) (*model.AlertSubscription, error)
	ListByUserID(ctx context.Context, userID string) ([]*model.AlertSubscription, error)
	ListByRuleID(ctx context.Context, ruleID *int64) ([]*model.AlertSubscription, error)
	ListEnabled(ctx context.Context) ([]*model.AlertSubscription, error)
	Update(ctx context.Context, sub *model.AlertSubscription) error
	Delete(ctx context.Context, id int64) error
	SetEnabled(ctx context.Context, id int64, enabled bool) error
}

type alertSubscriptionRepository struct {
	db *sql.DB
}

// NewAlertSubscriptionRepository creates a new subscription repository
func NewAlertSubscriptionRepository(db *sql.DB) AlertSubscriptionRepository {
	return &alertSubscriptionRepository{db: db}
}

func (r *alertSubscriptionRepository) Create(ctx context.Context, sub *model.AlertSubscription) error {
	query := `
		INSERT INTO alert.alert_subscriptions (user_id, rule_id, channel_type, channel_config, enabled)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		sub.UserID, sub.RuleID, sub.ChannelType, sub.ChannelConfig, sub.Enabled,
	).Scan(&sub.ID, &sub.CreatedAt, &sub.UpdatedAt)
}

func (r *alertSubscriptionRepository) GetByID(ctx context.Context, id int64) (*model.AlertSubscription, error) {
	query := `
		SELECT id, user_id, rule_id, channel_type, channel_config, enabled, created_at, updated_at
		FROM alert.alert_subscriptions
		WHERE id = $1
	`

	sub := &model.AlertSubscription{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&sub.ID, &sub.UserID, &sub.RuleID, &sub.ChannelType,
		&sub.ChannelConfig, &sub.Enabled, &sub.CreatedAt, &sub.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("subscription not found: %d", id)
	}

	return sub, err
}

func (r *alertSubscriptionRepository) ListByUserID(ctx context.Context, userID string) ([]*model.AlertSubscription, error) {
	query := `
		SELECT id, user_id, rule_id, channel_type, channel_config, enabled, created_at, updated_at
		FROM alert.alert_subscriptions
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanRows(rows)
}

func (r *alertSubscriptionRepository) ListByRuleID(ctx context.Context, ruleID *int64) ([]*model.AlertSubscription, error) {
	var query string
	var args []interface{}

	if ruleID != nil {
		query = `
			SELECT id, user_id, rule_id, channel_type, channel_config, enabled, created_at, updated_at
			FROM alert.alert_subscriptions
			WHERE rule_id = $1 AND enabled = true
			ORDER BY created_at DESC
		`
		args = []interface{}{*ruleID}
	} else {
		// Get subscriptions without specific rule (global subscriptions)
		query = `
			SELECT id, user_id, rule_id, channel_type, channel_config, enabled, created_at, updated_at
			FROM alert.alert_subscriptions
			WHERE rule_id IS NULL AND enabled = true
			ORDER BY created_at DESC
		`
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanRows(rows)
}

func (r *alertSubscriptionRepository) ListEnabled(ctx context.Context) ([]*model.AlertSubscription, error) {
	query := `
		SELECT id, user_id, rule_id, channel_type, channel_config, enabled, created_at, updated_at
		FROM alert.alert_subscriptions
		WHERE enabled = true
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanRows(rows)
}

func (r *alertSubscriptionRepository) Update(ctx context.Context, sub *model.AlertSubscription) error {
	query := `
		UPDATE alert.alert_subscriptions
		SET user_id = $1, rule_id = $2, channel_type = $3, channel_config = $4, enabled = $5
		WHERE id = $6
		RETURNING updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		sub.UserID, sub.RuleID, sub.ChannelType, sub.ChannelConfig, sub.Enabled, sub.ID,
	).Scan(&sub.UpdatedAt)
}

func (r *alertSubscriptionRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM alert.alert_subscriptions WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("subscription not found: %d", id)
	}

	return nil
}

func (r *alertSubscriptionRepository) SetEnabled(ctx context.Context, id int64, enabled bool) error {
	query := `UPDATE alert.alert_subscriptions SET enabled = $1 WHERE id = $2`
	result, err := r.db.ExecContext(ctx, query, enabled, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("subscription not found: %d", id)
	}

	return nil
}

func (r *alertSubscriptionRepository) scanRows(rows *sql.Rows) ([]*model.AlertSubscription, error) {
	var subs []*model.AlertSubscription
	for rows.Next() {
		sub := &model.AlertSubscription{}
		err := rows.Scan(
			&sub.ID, &sub.UserID, &sub.RuleID, &sub.ChannelType,
			&sub.ChannelConfig, &sub.Enabled, &sub.CreatedAt, &sub.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}
