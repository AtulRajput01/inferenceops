#!/usr/bin/env python3
"""
InferenceOps - Repeatable Benchmark Runner
Benchmarking script for measuring LLM inference performance metrics across serving runtimes:
- Ollama API (/api/generate)
- llama.cpp OpenAI-compatible API (/v1/chat/completions)

Metrics Captured:
- TTFT (Time To First Token)
- Total Latency (Client & Server)
- Prompt Evaluation & Generation Duration
- Latency Percentiles (P50, P95, P99, Min, Max)
- Generation Throughput (tokens/sec)
- Token Counts (Prompt, Completion, Total)
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

    total_prompt = sum(prompt_tokens)
    total_eval = sum(eval_tokens)

    return {
        "count": len(metrics),
        "successful_requests": len(metrics),
        "failed_requests": 0,
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
            "total_prompt_tokens": total_prompt,
            "total_eval_tokens": total_eval,
            "total_tokens": total_prompt + total_eval,
            "avg_prompt_tokens": total_prompt / len(prompt_tokens) if prompt_tokens else 0,
            "avg_eval_tokens": total_eval / len(eval_tokens) if eval_tokens else 0,
        },
    }


def send_inference_request(
    url: str,
    model: str,
    prompt: str,
    request_id: str,
    api_type: str = "auto",
    temperature: float = 0.0,
) -> dict:
    """Send a single inference request to Ollama or llama.cpp OpenAI-compatible API and parse metrics."""
    # Detect API type if set to auto
    if api_type == "auto":
        if "18080" in url or "/v1/" in url or "chat/completions" in url:
            api_type = "llamacpp"
        else:
            api_type = "ollama"

    if api_type == "llamacpp":
        payload_dict = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "stream": False,
        }
    else:
        payload_dict = {
            "model": model,
            "prompt": prompt,
            "options": {"temperature": temperature},
            "stream": False,
        }

    payload = json.dumps(payload_dict).encode("utf-8")
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
        print(f"\n❌ [{request_id}] HTTP Request failed against {url}: {e}", file=sys.stderr)
        raise

    client_latency_s = client_end - client_start

    if api_type == "llamacpp":
        # Extract fields from OpenAI-compatible chat completions response
        usage = response_json.get("usage", {})
        prompt_eval_count = usage.get("prompt_tokens", 0)
        eval_count = usage.get("completion_tokens", 0)
        
        # Optional server-side timings reported by llama.cpp
        timings = response_json.get("timings", {})
        prompt_ms = timings.get("prompt_ms", 0.0)
        predicted_ms = timings.get("predicted_ms", 0.0)
        predicted_per_second = timings.get("predicted_per_second", 0.0)

        if prompt_ms > 0:
            prompt_eval_duration_s = prompt_ms / 1000.0
            ttft_s = prompt_eval_duration_s
        else:
            prompt_eval_duration_s = 0.05
            ttft_s = 0.05

        if predicted_ms > 0:
            eval_duration_s = predicted_ms / 1000.0
        else:
            eval_duration_s = max(client_latency_s - ttft_s, 0.001)

        total_duration_s = prompt_eval_duration_s + eval_duration_s
        load_duration_s = 0.0

        if predicted_per_second > 0:
            tokens_per_second = predicted_per_second
        else:
            tokens_per_second = (eval_count / eval_duration_s) if eval_duration_s > 0 else 0.0

        choices = response_json.get("choices", [])
        text_content = choices[0].get("message", {}).get("content", "") if choices else ""
        snippet = text_content[:80].replace("\n", " ") + "..."

    else:
        # Extract Ollama server-reported nanosecond fields
        total_duration_ns = response_json.get("total_duration", 0)
        load_duration_ns = response_json.get("load_duration", 0)
        prompt_eval_duration_ns = response_json.get("prompt_eval_duration", 0)
        eval_duration_ns = response_json.get("eval_duration", 0)

        prompt_eval_count = response_json.get("prompt_eval_count", 0)
        eval_count = response_json.get("eval_count", 0)

        total_duration_s = total_duration_ns / 1e9
        load_duration_s = load_duration_ns / 1e9
        prompt_eval_duration_s = prompt_eval_duration_ns / 1e9
        eval_duration_s = eval_duration_ns / 1e9

        ttft_s = load_duration_s + prompt_eval_duration_s
        tokens_per_second = (eval_count / eval_duration_s) if eval_duration_s > 0 else 0.0
        snippet = response_json.get("response", "")[:80].replace("\n", " ") + "..."

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
        "response_text_snippet": snippet,
    }


def main():
    parser = argparse.ArgumentParser(description="InferenceOps LLM Repeatable Benchmark Runner")
    parser.add_argument("--url", type=str, default="http://localhost:11434/api/generate", help="Inference API endpoint")
    parser.add_argument("--api-type", type=str, choices=["auto", "ollama", "llamacpp"], default="auto", help="API protocol (ollama vs llamacpp OpenAI-compatible)")
    parser.add_argument("--model", type=str, default="qwen2.5:7b", help="Model name identifier")
    parser.add_argument(
        "--prompt",
        type=str,
        default="Explain Kubernetes container orchestration and pod scheduling in under 100 words.",
        help="Benchmark prompt workload",
    )
    parser.add_argument("--num-requests", type=int, default=10, help="Number of warm benchmark requests")
    parser.add_argument("--warmup", type=int, default=1, help="Number of warmup requests (excluded from statistics)")
    parser.add_argument("--concurrency", type=int, default=1, help="Concurrency worker threads")
    parser.add_argument("--temperature", type=float, default=0.0, help="Generation temperature")
    parser.add_argument("--output-dir", type=str, default="benchmark/results", help="Directory to save JSON results")
    parser.add_argument("--tag", type=str, default="cpu_baseline_ollama", help="Tag identifier for benchmark output file")
    parser.add_argument("--run-id", type=str, default=None, help="Reproducible Run ID tag")
    parser.add_argument("--runtime", type=str, default=None, help="Runtime name (e.g. Ollama, llama.cpp)")
    parser.add_argument("--hardware", type=str, default="AWS EC2 c7i / 8 vCPU Intel Xeon Platinum 8488C / 30GB RAM", help="Hardware details")
    args = parser.parse_args()

    # Determine runtime name if not set
    if not args.runtime:
        if args.api_type == "llamacpp" or "18080" in args.url:
            runtime_engine = "llama.cpp"
        else:
            runtime_engine = "Ollama"
    else:
        runtime_engine = args.runtime

    # Generate Run ID if not set
    timestamp_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
    if not args.run_id:
        prefix = "LLAMACPP" if "llama" in runtime_engine.lower() else "OLLAMA"
        run_id = f"RUN-{timestamp_str}-{prefix}-001"
    else:
        run_id = args.run_id

    print("==================================================")
    print("🚀 INFERENCEOPS - REPEATABLE BENCHMARK RUNNER")
    print("==================================================")
    print(f"Run ID:         {run_id}")
    print(f"Runtime Engine: {runtime_engine}")
    print(f"Target URL:     {args.url}")
    print(f"Model:          {args.model}")
    print(f"Hardware:       {args.hardware}")
    print(f"Concurrency:    {args.concurrency}")
    print(f"Warmup Runs:    {args.warmup}")
    print(f"Benchmark Runs: {args.num_requests}")
    print(f"Prompt:         \"{args.prompt}\"")
    print("==================================================\n")

    # 1. Warmup Requests
    warmup_results = []
    for i in range(args.warmup):
        print(f"🔥 Executing Warmup Run {i + 1}/{args.warmup}...", end="", flush=True)
        res = send_inference_request(
            args.url, args.model, args.prompt, f"warmup_{i + 1}", args.api_type, args.temperature
        )
        warmup_results.append(res)
        print(f" Done ({res['client_latency_s']:.2f}s | {res['tokens_per_second']:.2f} tok/s)")

    # 2. Warm Benchmark Runs
    benchmark_results = []
    print("\n⚡ Executing Benchmark Runs...")
    for i in range(args.num_requests):
        req_id = f"run_{i + 1}"
        print(f"  [Run {i + 1:02d}/{args.num_requests:02d}] Calling API...", end="", flush=True)
        res = send_inference_request(
            args.url, args.model, args.prompt, req_id, args.api_type, args.temperature
        )
        benchmark_results.append(res)
        print(f" Total: {res['client_latency_s']:.2f}s | TTFT: {res['ttft_s']:.3f}s | Out Tokens: {res['eval_count']} | Throughput: {res['tokens_per_second']:.2f} tok/s")

    # 3. Calculate Summary Statistics
    stats = calculate_statistics(benchmark_results)

    # 4. Display Results Summary Table
    print("\n==================================================")
    print("📊 BENCHMARK SUMMARY STATISTICS")
    print("==================================================")
    print(f"Runtime Engine:        {runtime_engine}")
    print(f"Successful Runs:       {stats['count']}")
    print(f"Avg Client Latency:    {stats['client_latency_s']['mean']:.3f} s")
    print(f"P50 Client Latency:    {stats['client_latency_s']['p50']:.3f} s")
    print(f"P95 Client Latency:    {stats['client_latency_s']['p95']:.3f} s")
    print(f"P99 Client Latency:    {stats['client_latency_s']['p99']:.3f} s")
    print(f"Min / Max Latency:     {stats['client_latency_s']['min']:.3f} s / {stats['client_latency_s']['max']:.3f} s")
    print("--------------------------------------------------")
    print(f"Avg TTFT:              {stats['ttft_s']['mean']:.3f} s")
    print(f"P50 TTFT:              {stats['ttft_s']['p50']:.3f} s")
    print(f"P95 TTFT:              {stats['ttft_s']['p50']:.3f} s")
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
            "run_id": run_id,
            "timestamp_utc": timestamp,
            "system_info": {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "hardware": args.hardware,
                "runtime_engine": runtime_engine,
            },
            "configuration": {
                "url": args.url,
                "model": args.model,
                "prompt": args.prompt,
                "num_requests": args.num_requests,
                "warmup_requests": args.warmup,
                "concurrency": args.concurrency,
                "temperature": args.temperature,
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
