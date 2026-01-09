package framework

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// AssertDatabaseCount checks record count in a table
func (e *TestEnv) AssertDatabaseCount(ctx context.Context, schema, table string, minCount int) error {
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s.%s", schema, table)
	if err := e.DB.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return fmt.Errorf("count query failed: %w", err)
	}
	if count < minCount {
		return fmt.Errorf("expected at least %d records in %s.%s, got %d", minCount, schema, table, count)
	}
	return nil
}

// AssertRedisKeyExists checks if a Redis key exists
func (e *TestEnv) AssertRedisKeyExists(ctx context.Context, key string) error {
	exists, err := e.Redis.Exists(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("redis exists check failed: %w", err)
	}
	if exists == 0 {
		return fmt.Errorf("redis key %s does not exist", key)
	}
	return nil
}

// AssertNeo4jNodeCount checks node count with label
func (e *TestEnv) AssertNeo4jNodeCount(ctx context.Context, label string, minCount int) error {
	session := e.Neo4j.NewSession(ctx, Neo4jSessionConfig())
	defer session.Close(ctx)

	result, err := session.Run(ctx, fmt.Sprintf("MATCH (n:%s) RETURN COUNT(n) as count", label), nil)
	if err != nil {
		return fmt.Errorf("neo4j query failed: %w", err)
	}

	if result.Next(ctx) {
		record := result.Record()
		count, _ := record.Get("count")
		if c, ok := count.(int64); ok && int(c) >= minCount {
			return nil
		}
		return fmt.Errorf("expected at least %d nodes with label %s, got %v", minCount, label, count)
	}
	return fmt.Errorf("no result from neo4j")
}

// AssertKafkaTopicExists checks if topic exists
func (e *TestEnv) AssertKafkaTopicExists(topic string) error {
	if e.Kafka == nil {
		return fmt.Errorf("kafka not connected")
	}
	topics, err := e.Kafka.ListTopics()
	if err != nil {
		return fmt.Errorf("list topics: %w", err)
	}
	if _, exists := topics[topic]; !exists {
		return fmt.Errorf("topic %s does not exist", topic)
	}
	return nil
}

// AssertHTTPEndpoint checks HTTP endpoint returns expected status
func (e *TestEnv) AssertHTTPEndpoint(ctx context.Context, method, url string, expectedStatus int) error {
	var req *http.Request
	var err error

	switch strings.ToUpper(method) {
	case "GET":
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	case "POST":
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	case "PUT":
		req, err = http.NewRequestWithContext(ctx, http.MethodPut, url, nil)
	case "DELETE":
		req, err = http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	default:
		req, err = http.NewRequestWithContext(ctx, method, url, nil)
	}

	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	resp, err := e.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != expectedStatus {
		return fmt.Errorf("expected status %d, got %d", expectedStatus, resp.StatusCode)
	}
	return nil
}

// AssertHTTPStatus is an alias for AssertHTTPEndpoint with GET method
func (e *TestEnv) AssertHTTPStatus(ctx context.Context, url string, expectedStatus int) error {
	return e.AssertHTTPEndpoint(ctx, "GET", url, expectedStatus)
}

// AssertJSONResponse checks JSON response contains expected field
func (e *TestEnv) AssertJSONResponse(ctx context.Context, url string, field string) (interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := e.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse json: %w", err)
	}

	value, exists := result[field]
	if !exists {
		return nil, fmt.Errorf("field %s not found in response", field)
	}
	return value, nil
}

// AssertRiskScore checks risk score is within range
func (e *TestEnv) AssertRiskScore(ctx context.Context, address string, minScore, maxScore float64) error {
	url := fmt.Sprintf("%s/api/v1/risk/%s", e.Config.RiskServiceURL, address)

	value, err := e.AssertJSONResponse(ctx, url, "score")
	if err != nil {
		return err
	}

	score, ok := value.(float64)
	if !ok {
		return fmt.Errorf("score is not a number: %v", value)
	}

	if score < minScore || score > maxScore {
		return fmt.Errorf("score %.4f not in range [%.4f, %.4f]", score, minScore, maxScore)
	}
	return nil
}
