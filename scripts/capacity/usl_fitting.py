#!/usr/bin/env python3
"""
USL (Universal Scalability Law) Curve Fitting Tool.

Fits throughput vs concurrency data to the USL model:
    X(N) = λN / (1 + σ(N-1) + κN(N-1))

Where:
    λ = single-thread throughput
    σ = contention coefficient (serialization)
    κ = coherency coefficient (crosstalk)
    N = concurrency level

Usage:
    python usl_fitting.py --service query-service --start 2026-01-14T00:00:00Z --end 2026-01-14T12:00:00Z
"""
import argparse
import json
import sys
from dataclasses import dataclass
from typing import Tuple, Optional

import numpy as np
from scipy.optimize import curve_fit

# Configuration
PROMETHEUS_URL = "http://localhost:9090"


@dataclass
class USLResult:
    """USL fitting result."""
    lambda_: float      # Single-thread throughput
    sigma: float        # Contention coefficient
    kappa: float        # Coherency coefficient
    n_max: float        # Optimal concurrency
    x_max: float        # Maximum throughput at n_max
    r_squared: float    # Goodness of fit
    data_points: int


def usl_model(n: np.ndarray, lambda_: float, sigma: float, kappa: float) -> np.ndarray:
    """USL throughput model."""
    return (lambda_ * n) / (1 + sigma * (n - 1) + kappa * n * (n - 1))


def fit_usl(concurrency: np.ndarray, throughput: np.ndarray) -> dict:
    """Fit USL model to observed data."""
    if len(concurrency) < 5:
        return {"error": "Insufficient data points (need >= 5)"}
    
    # Initial guesses
    lambda_init = throughput[0] / concurrency[0] if concurrency[0] > 0 else 1.0
    
    try:
        popt, pcov = curve_fit(
            usl_model,
            concurrency,
            throughput,
            p0=[lambda_init, 0.01, 0.001],
            bounds=([0, 0, 0], [np.inf, 1, 1]),
            maxfev=10000
        )
        
        lambda_, sigma, kappa = popt
        
        # Calculate R-squared
        predicted = usl_model(concurrency, *popt)
        ss_res = np.sum((throughput - predicted) ** 2)
        ss_tot = np.sum((throughput - np.mean(throughput)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Calculate optimal concurrency
        if kappa > 0:
            n_max = np.sqrt((1 - sigma) / kappa)
            x_max = usl_model(np.array([n_max]), lambda_, sigma, kappa)[0]
        else:
            n_max = float('inf')
            x_max = float('inf')
        
        return {
            "lambda": lambda_,
            "sigma": sigma,
            "kappa": kappa,
            "n_max": n_max,
            "x_max": x_max,
            "r_squared": r_squared,
            "data_points": len(concurrency),
            "interpretation": interpret_coefficients(sigma, kappa)
        }
        
    except Exception as e:
        return {"error": f"Fitting failed: {str(e)}"}


def interpret_coefficients(sigma: float, kappa: float) -> dict:
    """Interpret USL coefficients."""
    interpretation = {
        "contention_level": "low" if sigma < 0.1 else "medium" if sigma < 0.3 else "high",
        "coherency_level": "low" if kappa < 0.01 else "medium" if kappa < 0.05 else "high",
    }
    
    if kappa > 0.05:
        interpretation["recommendation"] = "High coherency overhead - reduce shared state or cross-node communication"
    elif sigma > 0.3:
        interpretation["recommendation"] = "High contention - reduce lock contention or serial processing"
    else:
        interpretation["recommendation"] = "Good scalability characteristics"
    
    return interpretation


def fetch_prometheus_data(service: str, start: str, end: str, prometheus_url: str) -> Tuple[np.ndarray, np.ndarray]:
    """Fetch concurrency and throughput data from Prometheus."""
    import requests
    
    # Query for concurrency (active requests)
    concurrency_query = f'avg_over_time({service}_active_requests{{}}[5m])'
    
    # Query for throughput (requests per second)
    throughput_query = f'rate({service}_http_requests_total{{}}[5m])'
    
    params = {
        "query": concurrency_query,
        "start": start,
        "end": end,
        "step": "5m"
    }
    
    try:
        # Fetch concurrency
        resp = requests.get(f"{prometheus_url}/api/v1/query_range", params=params)
        resp.raise_for_status()
        conc_data = resp.json()
        
        # Fetch throughput
        params["query"] = throughput_query
        resp = requests.get(f"{prometheus_url}/api/v1/query_range", params=params)
        resp.raise_for_status()
        tput_data = resp.json()
        
        if conc_data["status"] != "success" or tput_data["status"] != "success":
            raise ValueError("Prometheus query failed")
        
        conc_values = [float(v[1]) for v in conc_data["data"]["result"][0]["values"]]
        tput_values = [float(v[1]) for v in tput_data["data"]["result"][0]["values"]]
        
        # Align arrays
        min_len = min(len(conc_values), len(tput_values))
        
        return np.array(conc_values[:min_len]), np.array(tput_values[:min_len])
        
    except requests.RequestException as e:
        raise ValueError(f"Failed to fetch Prometheus data: {e}")
    except (KeyError, IndexError) as e:
        raise ValueError(f"No data returned from Prometheus: {e}")


def generate_capacity_report(result: dict, service: str) -> str:
    """Generate capacity planning report."""
    if "error" in result:
        return f"Error: {result['error']}"
    
    lines = [
        f"Service: {service}",
        f"Data Points: {result['data_points']}",
        f"R-squared: {result['r_squared']:.4f}",
        "",
        "USL Coefficients:",
        f"  λ (single-thread throughput): {result['lambda']:.2f} req/s",
        f"  σ (contention): {result['sigma']:.6f}",
        f"  κ (coherency): {result['kappa']:.6f}",
        "",
        "Capacity Limits:",
        f"  Optimal Concurrency (N_max): {result['n_max']:.1f}",
        f"  Maximum Throughput (X_max): {result['x_max']:.2f} req/s",
        "",
        "Interpretation:",
        f"  Contention Level: {result['interpretation']['contention_level']}",
        f"  Coherency Level: {result['interpretation']['coherency_level']}",
        f"  Recommendation: {result['interpretation']['recommendation']}",
    ]
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="USL Curve Fitting Tool")
    parser.add_argument("--service", required=True, help="Service name")
    parser.add_argument("--start", required=True, help="Start time (RFC3339)")
    parser.add_argument("--end", required=True, help="End time (RFC3339)")
    parser.add_argument("--prometheus", default=PROMETHEUS_URL, help="Prometheus URL")
    parser.add_argument("--output", choices=["json", "text"], default="text", help="Output format")
    
    args = parser.parse_args()
    prometheus_url = args.prometheus
    
    print(f"Fetching data for {args.service}...", file=sys.stderr)
    
    try:
        concurrency, throughput = fetch_prometheus_data(
            args.service, args.start, args.end, prometheus_url
        )
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Fitting USL model with {len(concurrency)} data points...", file=sys.stderr)
    
    result = fit_usl(concurrency, throughput)
    
    if args.output == "json":
        print(json.dumps(result, indent=2, default=str))
    else:
        print("\n" + "=" * 50)
        print(f"USL Analysis: {args.service}")
        print("=" * 50)
        
        if "error" in result:
            print(f"Error: {result['error']}")
            sys.exit(1)
        
        print(generate_capacity_report(result, args.service))
        
        # Print scaling projection
        print("\nScaling Projection:")
        print("-" * 30)
        for n in [1, 2, 4, 8, 16, 32, 64]:
            if n <= result["n_max"] * 2:
                x = usl_model(np.array([n]), result["lambda"], result["sigma"], result["kappa"])[0]
                efficiency = (x / (result["lambda"] * n)) * 100
                print(f"  N={n:3d}: {x:8.1f} req/s ({efficiency:5.1f}% efficiency)")


if __name__ == "__main__":
    main()
