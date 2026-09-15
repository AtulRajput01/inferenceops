#!/usr/bin/env python3
"""
InferenceOps - Repeatable Benchmark Runner
Benchmarking script for measuring LLM inference performance metrics:
- TTFT (Time To First Token)
- Total Latency (Client & Server)
- Prompt Evaluation & Generation Duration
- Latency Percentiles (P50, P95, P99)
- Generation Throughput (tokens/sec)
"""

import argparse
import datetime
import json
import math
import os
import platform
import sys
import time
import urllib.error
import urllib.request


def calculate_percentile(data: list[float], percentile: float) -> float:
    """Calculate the p-th percentile of a list of numbers using linear interpolation."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    if n == 1:
        return sorted_data[0]
    
    k = (n - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return sorted_data[int(f)] * (c - k) + sorted_data[int(c)] * (k - f)


def calculate_statistics(metrics: list[dict]) -> dict:
    """Compute summary statistics across warm benchmark runs."""
    if not metrics:
        return {}

    client_latencies = [m["client_latency_s"] for m in metrics]
    total_durations = [m["total_duration_s"] for m in metrics]
    ttft_times = [m["ttft_s"] for m in metrics]
    eval_durations = [m["eval_duration_s"] for m in metrics]
    tokens_per_sec = [m["tokens_per_second"] for m in metrics]
    prompt_tokens = [m["prompt_eval_count"] for m in metrics]
    eval_tokens = [m["eval_count"] for m in metrics]

    return {
        "count": len(metrics),
        "client_latency_s": {
            "mean": sum(client_latencies) / len(client_latencies),
            "p50": calculate_percentile(client_latencies, 50),
            "p95": calculate_percentile(client_latencies, 95),
            "p99": calculate_percentile(client_latencies, 99),
            "min": min(client_latencies),
            "max": max(client_latencies),
        },
        "total_duration_s": {
            "mean": sum(total_durations) / len(total_durations),
            "p50": calculate_percentile(total_durations, 50),
            "p95": calculate_percentile(total_durations, 95),
            "p99": calculate_percentile(total_durations, 99),
            "min": min(total_durations),
            "max": max(total_durations),
        },
        "ttft_s": {
            "mean": sum(ttft_times) / len(ttft_times),
            "p50": calculate_percentile(ttft_times, 50),
            "p95": calculate_percentile(ttft_times, 95),
            "p99": calculate_percentile(ttft_times, 99),
            "min": min(ttft_times),
            "max": max(ttft_times),
        },
        "eval_duration_s": {
            "mean": sum(eval_durations) / len(eval_durations),
            "p50": calculate_percentile(eval_durations, 50),
            "p95": calculate_percentile(eval_durations, 95),
            "p99": calculate_percentile(eval_durations, 99),
            "min": min(eval_durations),
            "max": max(eval_durations),
        },
        "tokens_per_second": {
            "mean": sum(tokens_per_sec) / len(tokens_per_sec),
            "p50": calculate_percentile(tokens_per_sec, 50),
            "p95": calculate_percentile(tokens_per_sec, 95),
            "p99": calculate_percentile(tokens_per_sec, 99),
            "min": min(tokens_per_sec),
            "max": max(tokens_per_sec),
        },
        "tokens": {
            "total_prompt_tokens": sum(prompt_tokens),
            "total_eval_tokens": sum(eval_tokens),
            "avg_prompt_tokens": sum(prompt_tokens) / len(prompt_tokens),
            "avg_eval_tokens": sum(eval_tokens) / len(eval_tokens),
        },
    }


def send_inference_request(url: str, model: str, prompt: str, request_id: str) -> dict:
    """Send a single inference request to Ollama API and parse performance metrics."""
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    client_start = time.perf_counter()
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            client_end = time.perf_counter()
            response_json = json.loads(resp_body)
    except urllib.error.URLError as e:
        print(f"❌ [{request_id}] HTTP Request failed: {e}", file=sys.stderr)
        raise

    client_latency_s = client_end - client_start

    # Extract Ollama server-reported nanosecond fields
    total_duration_ns = response_json.get("total_duration", 0)
    load_duration_ns = response_json.get("load_duration", 0)
    prompt_eval_duration_ns = response_json.get("prompt_eval_duration", 0)
    eval_duration_ns = response_json.get("eval_duration", 0)

    prompt_eval_count = response_json.get("prompt_eval_count", 0)
    eval_count = response_json.get("eval_count", 0)

    # Convert durations to seconds
    total_duration_s = total_duration_ns / 1e9
    load_duration_s = load_duration_ns / 1e9
    prompt_eval_duration_s = prompt_eval_duration_ns / 1e9
    eval_duration_s = eval_duration_ns / 1e9

    # TTFT estimation: time spent before token generation begins
    ttft_s = load_duration_s + prompt_eval_duration_s

    # Throughput (tokens / second)
    tokens_per_second = (eval_count / eval_duration_s) if eval_duration_s > 0 else 0.0

    return {
        "request_id": request_id,
        "client_latency_s": client_latency_s,
        "total_duration_s": total_duration_s,
        "load_duration_s": load_duration_s,
        "prompt_eval_duration_s": prompt_eval_duration_s,
        "eval_duration_s": eval_duration_s,
        "ttft_s": ttft_s,
        "prompt_eval_count": prompt_eval_count,
        "eval_count": eval_count,
        "tokens_per_second": tokens_per_second,
        "response_text_snippet": response_json.get("response", "")[:80].replace("\n", " ") + "...",
    }


def main():
    parser = argparse.ArgumentParser(description="InferenceOps LLM Repeatable Benchmark Runner")
    parser.add_argument("--url", type=str, default="http://localhost:11434/api/generate", help="Inference API endpoint")
    parser.add_argument("--model", type=str, default="qwen2.5:7b", help="Ollama model name")
    parser.add_argument(
        "--prompt",
        type=str,
        default="Explain Kubernetes container orchestration and pod scheduling in exactly 100 words.",
        help="Benchmark prompt workload",
    )
    parser.add_argument("--num-requests", type=int, default=10, help="Number of warm benchmark requests")
    parser.add_argument("--warmup", type=int, default=1, help="Number of warmup requests (excluded from statistics)")
    parser.add_argument("--output-dir", type=str, default="benchmark/results", help="Directory to save JSON results")
    parser.add_argument("--tag", type=str, default="cpu_baseline_ollama", help="Tag identifier for benchmark output file")
    args = parser.parse_args()

    print("==================================================")
    print("🚀 INFERENCEOPS - REPEATABLE BENCHMARK RUNNER")
    print("==================================================")
    print(f"Target URL:     {args.url}")
    print(f"Model:          {args.model}")
    print(f"Warmup Runs:    {args.warmup}")
    print(f"Benchmark Runs: {args.num_requests}")
    print(f"Prompt:         \"{args.prompt}\"")
    print("==================================================\n")

    # 1. Warmup Requests
    warmup_results = []
    for i in range(args.warmup):
        print(f"🔥 Executing Warmup Run {i + 1}/{args.warmup}...", end="", flush=True)
        res = send_inference_request(args.url, args.model, args.prompt, f"warmup_{i + 1}")
        warmup_results.append(res)
        print(f" Done ({res['client_latency_s']:.2f}s | {res['tokens_per_second']:.2f} tok/s)")

    # 2. Warm Benchmark Runs
    benchmark_results = []
    print("\n⚡ Executing Benchmark Runs...")
    for i in range(args.num_requests):
        req_id = f"run_{i + 1}"
        print(f"  [Run {i + 1:02d}/{args.num_requests:02d}] Calling API...", end="", flush=True)
        res = send_inference_request(args.url, args.model, args.prompt, req_id)
        benchmark_results.append(res)
        print(f" Total: {res['client_latency_s']:.2f}s | TTFT: {res['ttft_s']:.3f}s | Out Tokens: {res['eval_count']} | Throughput: {res['tokens_per_second']:.2f} tok/s")

    # 3. Calculate Summary Statistics
    stats = calculate_statistics(benchmark_results)

    # 4. Display Results Summary Table
    print("\n==================================================")
    print("📊 BENCHMARK SUMMARY STATISTICS")
    print("==================================================")
    print(f"Successful Runs:       {stats['count']}")
    print(f"Avg Client Latency:    {stats['client_latency_s']['mean']:.3f} s")
    print(f"P50 Client Latency:    {stats['client_latency_s']['p50']:.3f} s")
    print(f"P95 Client Latency:    {stats['client_latency_s']['p95']:.3f} s")
    print(f"P99 Client Latency:    {stats['client_latency_s']['p99']:.3f} s")
    print(f"Min / Max Latency:     {stats['client_latency_s']['min']:.3f} s / {stats['client_latency_s']['max']:.3f} s")
    print("--------------------------------------------------")
    print(f"Avg TTFT:              {stats['ttft_s']['mean']:.3f} s")
    print(f"P50 TTFT:              {stats['ttft_s']['p50']:.3f} s")
    print(f"P95 TTFT:              {stats['ttft_s']['p95']:.3f} s")
    print("--------------------------------------------------")
    print(f"Mean Generation Speed: {stats['tokens_per_second']['mean']:.2f} tokens/sec")
    print(f"Min Generation Speed:  {stats['tokens_per_second']['min']:.2f} tokens/sec")
    print(f"Max Generation Speed:  {stats['tokens_per_second']['max']:.2f} tokens/sec")
    print(f"Avg Tokens Generated:  {stats['tokens']['avg_eval_tokens']:.1f} tokens")
    print("==================================================")

    # 5. Save JSON Output
    os.makedirs(args.output_dir, exist_ok=True)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_filename = f"{args.tag}_{timestamp}.json"
    output_path = os.path.join(args.output_dir, output_filename)

    output_data = {
        "metadata": {
            "timestamp_utc": timestamp,
            "system_info": {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
            },
            "configuration": {
                "url": args.url,
                "model": args.model,
                "prompt": args.prompt,
                "num_requests": args.num_requests,
                "warmup_requests": args.warmup,
                "tag": args.tag,
            },
        },
        "summary_statistics": stats,
        "warmup_results": warmup_results,
        "benchmark_results": benchmark_results,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print(f"\n💾 Results successfully saved to: {output_path}\n")


if __name__ == "__main__":
    main()
