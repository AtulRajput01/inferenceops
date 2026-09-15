/**
 * InferenceOps Dashboard - Interactive Application Logic
 * Renders performance metrics, Chart.js visualizations, and economics calculation
 */

let timelineChart = null;
let percentilesChart = null;
let throughputChart = null;

// Default Baseline Dataset (EC2 10-run baseline metrics)
const DEFAULT_BASELINE = {
  "metadata": {
    "timestamp_utc": "20260915_070200",
    "system_info": {
      "platform": "Linux (AWS EC2 ap-south-1)",
      "python_version": "3.12.3",
      "hardware": "AWS EC2 8 vCPU Intel Xeon Platinum 8488C / 30GB RAM"
    },
    "configuration": {
      "url": "http://localhost:11434/api/generate",
      "model": "qwen2.5:7b",
      "prompt": "Explain Kubernetes container orchestration and pod scheduling in exactly 100 words.",
      "num_requests": 10,
      "warmup_requests": 1,
      "tag": "cpu_baseline_ollama"
    }
  },
  "summary_statistics": {
    "count": 10,
    "client_latency_s": {
      "mean": 11.105,
      "p50": 11.369,
      "p95": 12.972,
      "p99": 13.023,
      "min": 8.589,
      "max": 13.036
    },
    "ttft_s": {
      "mean": 0.139,
      "p50": 0.139,
      "p95": 0.140,
      "p99": 0.140,
      "min": 0.139,
      "max": 0.140
    },
    "tokens_per_second": {
      "mean": 7.31,
      "p50": 7.31,
      "p95": 7.34,
      "p99": 7.34,
      "min": 7.29,
      "max": 7.34
    },
    "tokens": {
      "total_prompt_tokens": 460,
      "total_eval_tokens": 801,
      "avg_prompt_tokens": 46.0,
      "avg_eval_tokens": 80.1
    }
  },
  "benchmark_results": [
    { "request_id": "run_1", "client_latency_s": 12.89, "ttft_s": 0.139, "eval_duration_s": 12.60, "eval_count": 93, "tokens_per_second": 7.30 },
    { "request_id": "run_2", "client_latency_s": 10.10, "ttft_s": 0.139, "eval_duration_s": 9.82, "eval_count": 73, "tokens_per_second": 7.33 },
    { "request_id": "run_3", "client_latency_s": 9.30, "ttft_s": 0.139, "eval_duration_s": 9.02, "eval_count": 67, "tokens_per_second": 7.32 },
    { "request_id": "run_4", "client_latency_s": 13.04, "ttft_s": 0.140, "eval_duration_s": 12.75, "eval_count": 94, "tokens_per_second": 7.29 },
    { "request_id": "run_5", "client_latency_s": 8.59, "ttft_s": 0.139, "eval_duration_s": 8.31, "eval_count": 62, "tokens_per_second": 7.34 },
    { "request_id": "run_6", "client_latency_s": 11.79, "ttft_s": 0.140, "eval_duration_s": 11.50, "eval_count": 85, "tokens_per_second": 7.30 },
    { "request_id": "run_7", "client_latency_s": 10.94, "ttft_s": 0.139, "eval_duration_s": 10.66, "eval_count": 79, "tokens_per_second": 7.32 },
    { "request_id": "run_8", "client_latency_s": 11.23, "ttft_s": 0.140, "eval_duration_s": 10.94, "eval_count": 81, "tokens_per_second": 7.31 },
    { "request_id": "run_9", "client_latency_s": 11.51, "ttft_s": 0.138, "eval_duration_s": 11.22, "eval_count": 83, "tokens_per_second": 7.30 },
    { "request_id": "run_10", "client_latency_s": 11.66, "ttft_s": 0.139, "eval_duration_s": 11.37, "eval_count": 84, "tokens_per_second": 7.30 }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  initDashboard(DEFAULT_BASELINE);
  setupFileUpload();
});

function initDashboard(data) {
  updateMetadataBanner(data);
  updateKpiCards(data);
  updateEconomicsCard(data);
  renderTimelineChart(data);
  renderPercentilesChart(data);
  renderThroughputChart(data);
  renderDataTable(data);
}

function updateMetadataBanner(data) {
  const meta = data.metadata || {};
  const config = meta.configuration || {};
  const sys = meta.system_info || {};

  document.getElementById("meta-model").textContent = config.model || "qwen2.5:7b";
  document.getElementById("meta-hardware").textContent = sys.hardware || sys.platform || "AWS EC2 CPU";
  document.getElementById("meta-tag").textContent = config.tag || "cpu_baseline";
  document.getElementById("meta-timestamp").textContent = meta.timestamp_utc || "Live";
}

function updateKpiCards(data) {
  const stats = data.summary_statistics || {};
  const tps = stats.tokens_per_second || {};
  const ttft = stats.ttft_s || {};
  const lat = stats.client_latency_s || {};
  const tok = stats.tokens || {};

  document.getElementById("kpi-tps").textContent = tps.mean ? tps.mean.toFixed(2) : "0.00";
  document.getElementById("kpi-ttft").textContent = ttft.mean ? (ttft.mean * 1000).toFixed(0) + " ms" : "0 ms";
  document.getElementById("kpi-p95").textContent = lat.p95 ? lat.p95.toFixed(2) + " s" : "0.00 s";
  document.getElementById("kpi-tokens").textContent = tok.avg_eval_tokens ? tok.avg_eval_tokens.toFixed(1) : "0";
}

function updateEconomicsCard(data) {
  // EC2 c7i.2xlarge estimated cost: ~$0.384 / hour
  const hourlyRate = 0.384;
  const stats = data.summary_statistics || {};
  const tpsMean = stats.tokens_per_second ? stats.tokens_per_second.mean : 7.31;

  // Cost per 1M tokens calculation = (Hourly Cost / 3600 seconds) * (1,000,000 tokens / tokens_per_second)
  const secondsPerMillion = 1000000 / tpsMean;
  const costPerMillion = (hourlyRate / 3600) * secondsPerMillion;
  const costPerThousand = costPerMillion / 1000;

  document.getElementById("cost-1m").textContent = "$" + costPerMillion.toFixed(3);
  document.getElementById("cost-1k").textContent = "$" + costPerThousand.toFixed(5);
  document.getElementById("cost-hourly").textContent = "$" + hourlyRate.toFixed(3) + " / hr";
}

function renderTimelineChart(data) {
  const runs = data.benchmark_results || [];
  const labels = runs.map((r, i) => `Run ${i + 1}`);
  const latencies = runs.map(r => r.client_latency_s);
  const ttfts = runs.map(r => r.ttft_s);

  const ctx = document.getElementById("chart-timeline").getContext("2d");
  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Client Latency (s)",
          data: latencies,
          backgroundColor: "rgba(0, 242, 254, 0.4)",
          borderColor: "#00f2fe",
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: "TTFT (s)",
          data: ttfts,
          backgroundColor: "rgba(168, 85, 247, 0.6)",
          borderColor: "#a855f7",
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } }
      },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });
}

function renderPercentilesChart(data) {
  const lat = (data.summary_statistics && data.summary_statistics.client_latency_s) || {};

  const ctx = document.getElementById("chart-percentiles").getContext("2d");
  if (percentilesChart) percentilesChart.destroy();

  percentilesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Min", "P50 (Median)", "P95", "P99", "Max"],
      datasets: [
        {
          label: "Latency (seconds)",
          data: [lat.min || 0, lat.p50 || 0, lat.p95 || 0, lat.p99 || 0, lat.max || 0],
          backgroundColor: [
            "rgba(16, 185, 129, 0.5)",
            "rgba(59, 130, 246, 0.5)",
            "rgba(168, 85, 247, 0.6)",
            "rgba(245, 158, 11, 0.6)",
            "rgba(239, 68, 68, 0.6)"
          ],
          borderColor: ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"],
          borderWidth: 1.5,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });
}

function renderThroughputChart(data) {
  const runs = data.benchmark_results || [];
  const labels = runs.map((r, i) => `Run ${i + 1}`);
  const tps = runs.map(r => r.tokens_per_second);

  const ctx = document.getElementById("chart-throughput").getContext("2d");
  if (throughputChart) throughputChart.destroy();

  throughputChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Throughput (tokens/sec)",
          data: tps,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#10b981",
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } }
      },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, min: 5, max: 10 }
      }
    }
  });
}

function renderDataTable(data) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  const runs = data.benchmark_results || [];

  runs.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>Run ${idx + 1}</td>
      <td>${r.client_latency_s ? r.client_latency_s.toFixed(3) + " s" : "-"}</td>
      <td>${r.ttft_s ? (r.ttft_s * 1000).toFixed(1) + " ms" : "-"}</td>
      <td>${r.eval_duration_s ? r.eval_duration_s.toFixed(3) + " s" : "-"}</td>
      <td>${r.eval_count || "-"}</td>
      <td><span style="color: var(--accent-emerald); font-weight: 600;">${r.tokens_per_second ? r.tokens_per_second.toFixed(2) : "-"} tok/s</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function setupFileUpload() {
  const btn = document.getElementById("upload-btn");
  const input = document.getElementById("file-input");

  btn.addEventListener("click", () => input.click());

  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        initDashboard(parsed);
      } catch (err) {
        alert("Invalid benchmark JSON file format: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}
