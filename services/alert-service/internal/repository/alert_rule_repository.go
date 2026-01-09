package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/chain-risk-platform/alert-service/internal/model"
	_ "github.com/lib/pq"
)

type AlertRuleRepository interface {
	Create(ctx context.Context, rule *model.AlertRule) error
	GetByID(ctx context.Context, id int64) (*model.AlertRule, error)
	List(ctx context.Context, enabled *bool) ([]*model.AlertRule, error)
	Update(ctx context.Context, rule *model.AlertRule) error
	Delete(ctx context.Context, id int64) error
	SetEnabled(ctx context.Context, id int64, enabled bool) error
}

type alertRuleRepository struct {
	db *sql.DB
}

func NewAlertRuleRepository(db *sql.DB) AlertRuleRepository {
	return &alertRuleRepository{db: db}
}

func (r *alertRuleRepository) Create(ctx context.Context, rule *model.AlertRule) error {
	query := `
		INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		rule.Name, rule.Description, rule.RuleType, rule.Conditions, rule.Severity, rule.Enabled,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
}

func (r *alertRuleRepository) GetByID(ctx context.Context, id int64) (*model.AlertRule, error) {
	query := `
		SELECT id, name, description, rule_type, conditions, severity, enabled, created_at, updated_at
		FROM alert.alert_rules
		WHERE id = $1
	`

	rule := &model.AlertRule{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&rule.ID, &rule.Name, &rule.Description, &rule.RuleType,
		&rule.Conditions, &rule.Severity, &rule.Enabled,
		&rule.CreatedAt, &rule.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("alert rule not found: %d", id)
	}

	return rule, err
}

func (r *alertRuleRepository) List(ctx context.Context, enabled *bool) ([]*model.AlertRule, error) {
	query := `
		SELECT id, name, description, rule_type, conditions, severity, enabled, created_at, updated_at
		FROM alert.alert_rules
	`

	args := []interface{}{}
	if enabled != nil {
		query += " WHERE enabled = $1"
		args = append(args, *enabled)
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []*model.AlertRule
	for rows.Next() {
		rule := &model.AlertRule{}
		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Description, &rule.RuleType,
			&rule.Conditions, &rule.Severity, &rule.Enabled,
			&rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, rows.Err()
}

func (r *alertRuleRepository) Update(ctx context.Context, rule *model.AlertRule) error {
	query := `
		UPDATE alert.alert_rules
		SET name = $1, description = $2, rule_type = $3, conditions = $4, severity = $5, enabled = $6
		WHERE id = $7
		RETURNING updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		rule.Name, rule.Description, rule.RuleType, rule.Conditions, rule.Severity, rule.Enabled, rule.ID,
	).Scan(&rule.UpdatedAt)
}

func (r *alertRuleRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM alert.alert_rules WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("alert rule not found: %d", id)
	}

	return nil
}

func (r *alertRuleRepository) SetEnabled(ctx context.Context, id int64, enabled bool) error {
	query := `UPDATE alert.alert_rules SET enabled = $1 WHERE id = $2`
	result, err := r.db.ExecContext(ctx, query, enabled, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("alert rule not found: %d", id)
	}

	return nil
}
