package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

type AlertHistoryRepository interface {
	Create(ctx context.Context, alert *model.AlertHistory) error
	GetByID(ctx context.Context, id int64) (*model.AlertHistory, error)
	List(ctx context.Context, filters AlertHistoryFilters) ([]*model.AlertHistory, error)
	UpdateStatus(ctx context.Context, id int64, status string, notifiedAt *time.Time) error
	Acknowledge(ctx context.Context, id int64, acknowledgedBy string) error
	GetStats(ctx context.Context, from, to time.Time) (*AlertStats, error)
}

type AlertHistoryFilters struct {
	RuleID     *int64
	EntityType *string
	EntityID   *string
	Severity   *string
	Status     *string
	From       *time.Time
	To         *time.Time
	Limit      int
	Offset     int
}

type AlertStats struct {
	Total          int64            `json:"total"`
	BySeverity     map[string]int64 `json:"by_severity"`
	ByStatus       map[string]int64 `json:"by_status"`
	ByType         map[string]int64 `json:"by_type"`
	AveragePerHour float64          `json:"average_per_hour"`
}

type alertHistoryRepository struct {
	db *sql.DB
}

func NewAlertHistoryRepository(db *sql.DB) AlertHistoryRepository {
	return &alertHistoryRepository{db: db}
}

func (r *alertHistoryRepository) Create(ctx context.Context, alert *model.AlertHistory) error {
	query := `
		INSERT INTO alert.alert_history 
		(rule_id, alert_type, severity, entity_type, entity_id, title, message, metadata, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		alert.RuleID, alert.AlertType, alert.Severity, alert.EntityType,
		alert.EntityID, alert.Title, alert.Message, alert.Metadata, alert.Status,
	).Scan(&alert.ID, &alert.CreatedAt)
}

func (r *alertHistoryRepository) GetByID(ctx context.Context, id int64) (*model.AlertHistory, error) {
	query := `
		SELECT id, rule_id, alert_type, severity, entity_type, entity_id, 
		       title, message, metadata, status, notified_at, acknowledged_at, 
		       acknowledged_by, created_at
		FROM alert.alert_history
		WHERE id = $1
	`

	alert := &model.AlertHistory{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&alert.ID, &alert.RuleID, &alert.AlertType, &alert.Severity,
		&alert.EntityType, &alert.EntityID, &alert.Title, &alert.Message,
		&alert.Metadata, &alert.Status, &alert.NotifiedAt, &alert.AcknowledgedAt,
		&alert.AcknowledgedBy, &alert.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("alert not found: %d", id)
	}

	return alert, err
}

func (r *alertHistoryRepository) List(ctx context.Context, filters AlertHistoryFilters) ([]*model.AlertHistory, error) {
	query := `
		SELECT id, rule_id, alert_type, severity, entity_type, entity_id, 
		       title, message, metadata, status, notified_at, acknowledged_at, 
		       acknowledged_by, created_at
		FROM alert.alert_history
		WHERE 1=1
	`

	args := []any{}
	argIndex := 1

	if filters.RuleID != nil {
		query += fmt.Sprintf(" AND rule_id = $%d", argIndex)
		args = append(args, *filters.RuleID)
		argIndex++
	}

	if filters.EntityType != nil {
		query += fmt.Sprintf(" AND entity_type = $%d", argIndex)
		args = append(args, *filters.EntityType)
		argIndex++
	}

	if filters.EntityID != nil {
		query += fmt.Sprintf(" AND entity_id = $%d", argIndex)
		args = append(args, *filters.EntityID)
		argIndex++
	}

	if filters.Severity != nil {
		query += fmt.Sprintf(" AND severity = $%d", argIndex)
		args = append(args, *filters.Severity)
		argIndex++
	}

	if filters.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, *filters.Status)
		argIndex++
	}

	if filters.From != nil {
		query += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, *filters.From)
		argIndex++
	}

	if filters.To != nil {
		query += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, *filters.To)
		argIndex++
	}

	query += " ORDER BY created_at DESC"

	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, filters.Limit)
		argIndex++
	}

	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, filters.Offset)
		argIndex++
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []*model.AlertHistory
	for rows.Next() {
		alert := &model.AlertHistory{}
		err := rows.Scan(
			&alert.ID, &alert.RuleID, &alert.AlertType, &alert.Severity,
			&alert.EntityType, &alert.EntityID, &alert.Title, &alert.Message,
			&alert.Metadata, &alert.Status, &alert.NotifiedAt, &alert.AcknowledgedAt,
			&alert.AcknowledgedBy, &alert.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		alerts = append(alerts, alert)
	}

	return alerts, rows.Err()
}

func (r *alertHistoryRepository) UpdateStatus(ctx context.Context, id int64, status string, notifiedAt *time.Time) error {
	query := `
		UPDATE alert.alert_history
		SET status = $1, notified_at = $2
		WHERE id = $3
	`

	result, err := r.db.ExecContext(ctx, query, status, notifiedAt, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("alert not found: %d", id)
	}

	return nil
}

func (r *alertHistoryRepository) Acknowledge(ctx context.Context, id int64, acknowledgedBy string) error {
	query := `
		UPDATE alert.alert_history
		SET status = $1, acknowledged_at = $2, acknowledged_by = $3
		WHERE id = $4
	`

	now := time.Now()
	result, err := r.db.ExecContext(ctx, query, model.AlertStatusAcknowledged, now, acknowledgedBy, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("alert not found: %d", id)
	}

	return nil
}

func (r *alertHistoryRepository) GetStats(ctx context.Context, from, to time.Time) (*AlertStats, error) {
	stats := &AlertStats{
		BySeverity: make(map[string]int64),
		ByStatus:   make(map[string]int64),
		ByType:     make(map[string]int64),
	}

	// Total count
	query := `SELECT COUNT(*) FROM alert.alert_history WHERE created_at BETWEEN $1 AND $2`
	err := r.db.QueryRowContext(ctx, query, from, to).Scan(&stats.Total)
	if err != nil {
		return nil, err
	}

	// By severity
	query = `
		SELECT severity, COUNT(*) 
		FROM alert.alert_history 
		WHERE created_at BETWEEN $1 AND $2 
		GROUP BY severity
	`
	rows, err := r.db.QueryContext(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var severity string
		var count int64
		if err := rows.Scan(&severity, &count); err != nil {
			return nil, err
		}
		stats.BySeverity[severity] = count
	}

	// By status
	query = `
		SELECT status, COUNT(*) 
		FROM alert.alert_history 
		WHERE created_at BETWEEN $1 AND $2 
		GROUP BY status
	`
	rows, err = r.db.QueryContext(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.ByStatus[status] = count
	}

	// By type
	query = `
		SELECT alert_type, COUNT(*) 
		FROM alert.alert_history 
		WHERE created_at BETWEEN $1 AND $2 
		GROUP BY alert_type
	`
	rows, err = r.db.QueryContext(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var alertType string
		var count int64
		if err := rows.Scan(&alertType, &count); err != nil {
			return nil, err
		}
		stats.ByType[alertType] = count
	}

	// Average per hour
	hours := to.Sub(from).Hours()
	if hours > 0 {
		stats.AveragePerHour = float64(stats.Total) / hours
	}

	return stats, nil
}
