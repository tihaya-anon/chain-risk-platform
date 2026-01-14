#!/usr/bin/env python3
"""
USL (Universal Scalability Law) Curve Fitting Tool

Uses data from Prometheus to fit the USL model:
    X(N) = λN / (1 + σ(N-1) + κN(N-1))

Where:
    X(N) = throughput at concurrency N
    λ    = throughput per unit (single request)
    σ    = contention coefficient (serialization)
    κ    = coherency coefficient (crosstalk)

Usage:
    python usl_fitting.py --service query-service --start 2026-01-14T00:00:00Z --end 2026-01-14T01:00:00Z
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Tuple

import numpy as np
import requests
from scipy.optimize import curve_fit

PROMETHEUS_URL = "http://localhost:19090"

def usl_model(n: np.ndarray, lambda_: float, sigma: float, kappa: float) -> np.ndarray:
    """USL throughput model."""
    return (lambda_ * n) / (1 + sigma * (n - 1) + kappa * n * (n - 1))


def fetch_prometheus_data(service: str, start: str, end: str, step: str = "30s") -> Tuple[np.ndarray, np.ndarray]:
    """Fetch concurrency and throughput data from Prometheus."""
    
    # Query concurrency
    concurrency_query = f"{service}:usl_concurrency"
    throughput_query = f"{service}:usl_throughput"
    
    concurrency_data = query_prometheus_range(concurrency_query, start, end, step)
    throughput_data = query_prometheus_range(throughput_query, start, end, step)
    
    if not concurrency_data or not throughput_data:
        raise ValueError(f"No data found for service: {service}")
    
    # Align timestamps and extract values
    concurrency = np.array([float(v[1]) for v in concurrency_data])
    throughput = np.array([float(v[1]) for v in throughput_data])
    
    # Filter out zeros and invalid values
    mask = (concurrency > 0) & (throughput > 0) & np.isfinite(concurrency) & np.isfinite(throughput)
    
    return concurrency[mask], throughput[mask]


def query_prometheus_range(query: str, start: str, end: str, step: str) -> list:
    """Execute a Prometheus range query."""
    url = f"{PROMETHEUS_URL}/api/v1/query_range"
    params = {
        "query": query,
        "start": start,
        "end": end,
        "step": step
    }
    
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        
        if data["status"] != "success":
            return []
        
        results = data.get("data", {}).get("result", [])
        if not results:
            return []
        
        return results[0].get("values", [])
    except Exception as e:
        print(f"Error querying Prometheus: {e}", file=sys.stderr)
        return []


def fit_usl(concurrency: np.ndarray, throughput: np.ndarray) -> dict:
    """Fit USL model to data."""
    
    # Initial parameter guesses
    lambda_init = throughput.max() / concurrency[throughput.argmax()]
    sigma_init = 0.01
    kappa_init = 0.001
    
    try:
        popt, pcov = curve_fit(
            usl_model,
            concurrency,
            throughput,
            p0=[lambda_init, sigma_init, kappa_init],
            bounds=([0, 0, 0], [np.inf, 1, 1]),
            maxfev=10000
        )
        
        lambda_, sigma, kappa = popt
        perr = np.sqrt(np.diag(pcov))
        
        # Calculate max useful concurrency: N_max = sqrt((1-σ)/κ)
        if kappa > 0:
            n_max = np.sqrt((1 - sigma) / kappa)
        else:
            n_max = float('inf')
        
        # Calculate max throughput
        x_max = usl_model(n_max, lambda_, sigma, kappa) if np.isfinite(n_max) else float('inf')
        
        # R-squared
        residuals = throughput - usl_model(concurrency, *popt)
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((throughput - np.mean(throughput)) ** 2)
        r_squared = 1 - (ss_res / ss_tot)
        
        return {
            "lambda": lambda_,
            "sigma": sigma,
            "kappa": kappa,
            "lambda_stderr": perr[0],
            "sigma_stderr": perr[1],
            "kappa_stderr": perr[2],
            "n_max": n_max,
            "x_max": x_max,
            "r_squared": r_squared,
            "data_points": len(concurrency),
            "interpretation": interpret_coefficients(sigma, kappa)
        }
    except Exception as e:
        return {"error": str(e)}


def interpret_coefficients(sigma: float, kappa: float) -> dict:
    """Interpret USL coefficients."""
    interpretation = {
        "contention": "",
        "coherency": "",
        "recommendation": []
    }
    
    # Sigma interpretation (contention/serialization)
    if sigma < 0.01:
        interpretation["contention"] = "Very low contention - system scales nearly linearly"
    elif sigma < 0.05:
        interpretation["contention"] = "Low contention - good scalability"
    elif sigma < 0.1:
        interpretation["contention"] = "Moderate contention - some serialization bottleneck"
        interpretation["recommendation"].append("Investigate shared resources (locks, mutexes)")
    else:
        interpretation["contention"] = "High contention - significant serialization"
        interpretation["recommendation"].append("Critical: Reduce lock contention")
        interpretation["recommendation"].append("Consider lock-free data structures")
    
    # Kappa interpretation (coherency/crosstalk)
    if kappa < 0.0001:
        interpretation["coherency"] = "Very low coherency overhead - minimal coordination costs"
    elif kappa < 0.001:
        interpretation["coherency"] = "Low coherency overhead - acceptable coordination"
    elif kappa < 0.01:
        interpretation["coherency"] = "Moderate coherency overhead - noticeable coordination costs"
        interpretation["recommendation"].append("Review distributed coordination patterns")
    else:
        interpretation["coherency"] = "High coherency overhead - excessive coordination"
        interpretation["recommendation"].append("Critical: Reduce cross-node communication")
        interpretation["recommendation"].append("Consider data locality optimization")
    
    return interpretation


def main():
    parser = argparse.ArgumentParser(description="USL Curve Fitting Tool")
    parser.add_argument("--service", required=True, help="Service name (e.g., query_service)")
    parser.add_argument("--start", required=True, help="Start time (RFC3339)")
    parser.add_argument("--end", required=True, help="End time (RFC3339)")
    parser.add_argument("--prometheus", default=PROMETHEUS_URL, help="Prometheus URL")
    parser.add_argument("--output", choices=["json", "text"], default="text", help="Output format")
    
    args = parser.parse_args()
    
    global PROMETHEUS_URL
    PROMETHEUS_URL = args.prometheus
    
    print(f"Fetching data for {args.service}...", file=sys.stderr)
    
    try:
        concurrency, throughput = fetch_prometheus_data(args.service, args.start, args.end)
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
        
        print(f"\nModel: X(N) = λN / (1 + σ(N-1) + κN(N-1))")
        print(f"\nCoefficients:")
        print(f"  λ (single-thread throughput): {result['lambda']:.4f} ± {result['lambda_stderr']:.4f}")
        print(f"  σ (contention):               {result['sigma']:.6f} ± {result['sigma_stderr']:.6f}")
        print(f"  κ (coherency):                {result['kappa']:.8f} ± {result['kappa_stderr']:.8f}")
        
        print(f"\nScaling Limits:")
        print(f"  Max useful concurrency (N_max): {result['n_max']:.1f}")
        print(f"  Max throughput (X_max):         {result['x_max']:.2f} req/s")
        
        print(f"\nModel Fit:")
        print(f"  R-squared: {result['r_squared']:.4f}")
        print(f"  Data points: {result['data_points']}")
        
        interp = result["interpretation"]
        print(f"\nInterpretation:")
        print(f"  Contention: {interp['contention']}")
        print(f"  Coherency:  {interp['coherency']}")
        
        if interp["recommendation"]:
            print(f"\nRecommendations:")
            for rec in interp["recommendation"]:
                print(f"  • {rec}")
        
        print("=" * 50)


if __name__ == "__main__":
    main()
