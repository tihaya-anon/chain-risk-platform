package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/chainrisk/load-generator/internal/config"
	"github.com/chainrisk/load-generator/internal/generator"
	"github.com/chainrisk/load-generator/internal/metrics"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "load-generator",
	Short: "API load generator for Chain Risk Platform",
	Long:  `Generates configurable load patterns for capacity testing and USL fitting.`,
}

var runCmd = &cobra.Command{
	Use:   "run [scenario-file]",
	Short: "Run a load test scenario",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		scenarioFile := args[0]

		cfg, err := config.LoadScenario(scenarioFile)
		if err != nil {
			return fmt.Errorf("failed to load scenario: %w", err)
		}

		// Start metrics server
		metricsPort, _ := cmd.Flags().GetInt("metrics-port")
		go startMetricsServer(metricsPort)

		// Create and run generator
		gen := generator.New(cfg)

		// Handle graceful shutdown
		done := make(chan struct{})
		go func() {
			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			<-sigCh
			fmt.Println("\nShutting down...")
			gen.Stop()
			close(done)
		}()

		fmt.Printf("Starting scenario: %s\n", cfg.Name)
		fmt.Printf("Duration: %s\n", cfg.Duration)

		if err := gen.Run(); err != nil {
			return fmt.Errorf("scenario failed: %w", err)
		}

		// Print summary
		gen.PrintSummary()
		return nil
	},
}

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List available scenarios",
	Run: func(cmd *cobra.Command, args []string) {
		scenarios := []string{
			"baseline.yaml     - Steady state baseline test",
			"ramp-usl.yaml     - Ramp test for USL fitting",
			"spike.yaml        - Spike/burst test",
			"soak.yaml         - Long duration soak test",
			"mixed.yaml        - Mixed workload test",
		}
		fmt.Println("Available scenarios:")
		for _, s := range scenarios {
			fmt.Printf("  %s\n", s)
		}
	},
}

func startMetricsServer(port int) {
	metrics.Init()
	http.Handle("/metrics", promhttp.Handler())
	addr := fmt.Sprintf(":%d", port)
	fmt.Printf("Metrics server listening on %s\n", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		fmt.Printf("Metrics server error: %v\n", err)
	}
}

func init() {
	runCmd.Flags().Int("metrics-port", 9100, "Port for Prometheus metrics")
	rootCmd.AddCommand(runCmd)
	rootCmd.AddCommand(listCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
