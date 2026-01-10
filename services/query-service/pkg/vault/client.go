package vault

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

// Client provides Vault secret management.
type Client struct {
	addr      string
	enabled   bool
	roleID    string
	secretID  string
	token     string
	tokenExp  time.Time
	cache     map[string]cacheEntry
	cacheTTL  time.Duration
	mu        sync.RWMutex
	httpClient *http.Client
}

type cacheEntry struct {
	data   map[string]string
	expiry time.Time
}

// Config holds Vault client configuration.
type Config struct {
	Addr     string
	Enabled  bool
	RoleID   string
	SecretID string
	Token    string
}

// NewClient creates a new Vault client.
func NewClient() *Client {
	return &Client{
		addr:      getEnv("VAULT_ADDR", "http://localhost:18200"),
		enabled:   getEnv("VAULT_ENABLED", "false") == "true",
		roleID:    os.Getenv("VAULT_APPROLE_ROLE_ID"),
		secretID:  os.Getenv("VAULT_APPROLE_SECRET_ID"),
		token:     os.Getenv("VAULT_TOKEN"),
		cache:     make(map[string]cacheEntry),
		cacheTTL:  5 * time.Minute,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// IsEnabled returns whether Vault is enabled.
func (c *Client) IsEnabled() bool {
	return c.enabled
}

func (c *Client) authenticate() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.token != "" && time.Now().Before(c.tokenExp) {
		return nil
	}

	// Try static token first
	if staticToken := os.Getenv("VAULT_TOKEN"); staticToken != "" {
		c.token = staticToken
		c.tokenExp = time.Now().Add(time.Hour)
		return nil
	}

	if c.roleID == "" || c.secretID == "" {
		return fmt.Errorf("Vault AppRole credentials not configured")
	}

	payload := fmt.Sprintf(`{"role_id":"%s","secret_id":"%s"}`, c.roleID, c.secretID)
	req, err := http.NewRequest("POST", c.addr+"/v1/auth/approle/login", 
		jsonReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("vault auth request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("vault auth failed with status: %d", resp.StatusCode)
	}

	var result struct {
		Auth struct {
			ClientToken   string `json:"client_token"`
			LeaseDuration int    `json:"lease_duration"`
		} `json:"auth"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode vault auth response: %w", err)
	}

	c.token = result.Auth.ClientToken
	ttl := time.Duration(result.Auth.LeaseDuration-60) * time.Second
	c.tokenExp = time.Now().Add(ttl)

	return nil
}

// GetSecret retrieves a secret from Vault.
func (c *Client) GetSecret(path string) (map[string]string, error) {
	if !c.enabled {
		return nil, fmt.Errorf("vault is not enabled")
	}

	// Check cache
	c.mu.RLock()
	if entry, ok := c.cache[path]; ok && time.Now().Before(entry.expiry) {
		c.mu.RUnlock()
		return entry.data, nil
	}
	c.mu.RUnlock()

	if err := c.authenticate(); err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", c.addr+"/v1/secret/data/"+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("vault get secret request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vault get secret failed with status: %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Data map[string]string `json:"data"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode vault secret response: %w", err)
	}

	// Cache the secret
	c.mu.Lock()
	c.cache[path] = cacheEntry{
		data:   result.Data.Data,
		expiry: time.Now().Add(c.cacheTTL),
	}
	c.mu.Unlock()

	return result.Data.Data, nil
}

// DatabaseSecrets holds PostgreSQL credentials.
type DatabaseSecrets struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
}

// GetDatabaseSecrets retrieves PostgreSQL credentials.
func (c *Client) GetDatabaseSecrets() (*DatabaseSecrets, error) {
	if !c.enabled {
		return &DatabaseSecrets{
			Host:     getEnv("POSTGRES_HOST", "localhost"),
			Port:     getEnv("POSTGRES_PORT", "15432"),
			User:     getEnv("POSTGRES_USER", "chainrisk"),
			Password: getEnv("POSTGRES_PASSWORD", "chainrisk123"),
			Database: getEnv("POSTGRES_DB", "chainrisk"),
		}, nil
	}

	secrets, err := c.GetSecret("chainrisk/database/postgres")
	if err != nil {
		return nil, err
	}

	return &DatabaseSecrets{
		Host:     secrets["host"],
		Port:     secrets["port"],
		User:     secrets["user"],
		Password: secrets["password"],
		Database: secrets["database"],
	}, nil
}

// RedisSecrets holds Redis credentials.
type RedisSecrets struct {
	Host     string
	Port     string
	Password string
}

// GetRedisSecrets retrieves Redis credentials.
func (c *Client) GetRedisSecrets() (*RedisSecrets, error) {
	if !c.enabled {
		return &RedisSecrets{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "16379"),
			Password: os.Getenv("REDIS_PASSWORD"),
		}, nil
	}

	secrets, err := c.GetSecret("chainrisk/database/redis")
	if err != nil {
		return nil, err
	}

	return &RedisSecrets{
		Host:     secrets["host"],
		Port:     secrets["port"],
		Password: secrets["password"],
	}, nil
}

// Neo4jSecrets holds Neo4j credentials.
type Neo4jSecrets struct {
	URI      string
	User     string
	Password string
}

// GetNeo4jSecrets retrieves Neo4j credentials.
func (c *Client) GetNeo4jSecrets() (*Neo4jSecrets, error) {
	if !c.enabled {
		return &Neo4jSecrets{
			URI:      getEnv("NEO4J_URI", "bolt://localhost:17687"),
			User:     getEnv("NEO4J_USER", "neo4j"),
			Password: getEnv("NEO4J_PASSWORD", "chainrisk123"),
		}, nil
	}

	secrets, err := c.GetSecret("chainrisk/database/neo4j")
	if err != nil {
		return nil, err
	}

	return &Neo4jSecrets{
		URI:      secrets["uri"],
		User:     secrets["user"],
		Password: secrets["password"],
	}, nil
}

// GetAPIKey retrieves an API key for a service.
func (c *Client) GetAPIKey(service string) (string, error) {
	if !c.enabled {
		envKey := fmt.Sprintf("%s_API_KEY", service)
		return os.Getenv(envKey), nil
	}

	secrets, err := c.GetSecret(fmt.Sprintf("chainrisk/api/%s", service))
	if err != nil {
		return "", err
	}

	return secrets["key"], nil
}

// ClearCache clears the secret cache.
func (c *Client) ClearCache() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]cacheEntry)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

type stringReader struct {
	s string
	i int
}

func (r *stringReader) Read(p []byte) (n int, err error) {
	if r.i >= len(r.s) {
		return 0, fmt.Errorf("EOF")
	}
	n = copy(p, r.s[r.i:])
	r.i += n
	return
}

func jsonReader(s string) *stringReader {
	return &stringReader{s: s}
}

// Singleton
var (
	defaultClient *Client
	clientOnce    sync.Once
)

// GetClient returns the singleton Vault client.
func GetClient() *Client {
	clientOnce.Do(func() {
		defaultClient = NewClient()
	})
	return defaultClient
}
