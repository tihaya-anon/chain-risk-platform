package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// ReceivedAlert stores received webhook payloads
type ReceivedAlert struct {
	Timestamp time.Time              `json:"timestamp"`
	Headers   map[string]string      `json:"headers"`
	Body      map[string]interface{} `json:"body"`
}

var (
	alerts []ReceivedAlert
	mu     sync.RWMutex
)

func main() {
	port := flag.Int("port", 9999, "Server port")
	flag.Parse()

	http.HandleFunc("/webhook", handleWebhook)
	http.HandleFunc("/received", handleReceived)
	http.HandleFunc("/clear", handleClear)
	http.HandleFunc("/health", handleHealth)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Webhook mock server starting on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	alert := ReceivedAlert{
		Timestamp: time.Now(),
		Headers:   headers,
		Body:      body,
	}

	mu.Lock()
	alerts = append(alerts, alert)
	count := len(alerts)
	mu.Unlock()

	log.Printf("Received alert #%d: %v", count, body["title"])
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "received"})
}

func handleReceived(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":  len(alerts),
		"alerts": alerts,
	})
}

func handleClear(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	alerts = nil
	mu.Unlock()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}
