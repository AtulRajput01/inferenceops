/**
 * InferenceOps Dashboard - Mockup Redesign Logic (Images 2 & 3 Match)
 * Render sparklines, gradient bar charts, scatter plot, radial gauge, and cost area chart.
 */

let sparklineTps = null;
let sparklineTtft = null;
let percentilesChart = null;
let scatterChart = null;
let costAreaChart = null;

// Default Baseline Dataset (User's EC2 10-run baseline benchmark)
const DEFAULT_BASELINE = {
  "metadata": {
    "timestamp_utc": "20260915_070200",
    "system_info": {
      "platform": "AWS EC2 c7i / 8 vCPU Intel Xeon Platinum / 30GB RAM",
      "hardware": "AWS EC2 8 vCPU Intel Xeon"
    },
    "configuration": {
      "url": "http://localhost:11434/api/generate",
      "model": "qwen2.5:7b",
      "prompt": "Explain Kubernetes container orchestration and pod scheduling in exactly 100 words.",
      "num_requests": 10,
      "tag": "cpu_baseline_ollama"
    }
  },
  "summary_statistics": {
    "count": 10,
    "client_latency_s": { "mean": 11.105, "p50": 11.369, "p95": 12.972, "p99": 13.023, "min": 8.589, "max": 13.036 },
    "ttft_s": { "mean": 0.139, "p50": 0.139, "p95": 0.140, "p99": 0.140, "min": 0.139, "max": 0.140 },
    "tokens_per_second": { "mean": 7.31, "p50": 7.31, "p95": 7.34, "p99": 7.34, "min": 7.29, "max": 7.34 },
    "tokens": { "total_prompt_tokens": 460, "total_eval_tokens": 801, "avg_prompt_tokens": 46.0, "avg_eval_tokens": 80.1 }
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
  updateHeroCards(data);
  updateCostBreakdown(data);
  updateCpuGauge(84.3);
  renderSparklines(data);
  renderPercentilesChart(data);
  renderScatterChart(data);
  renderCostAreaChart(data);
}

function updateHeroCards(data) {
  const stats = data.summary_statistics || {};
  const tps = stats.tokens_per_second || {};
  const ttft = stats.ttft_s || {};
  const lat = stats.client_latency_s || {};
  const config = (data.metadata && data.metadata.configuration) || {};
  const sys = (data.metadata && data.metadata.system_info) || {};

  document.getElementById("kpi-tps").childNodes[0].nodeValue = (tps.mean ? tps.mean.toFixed(2) : "7.31") + " ";
  document.getElementById("kpi-ttft").childNodes[0].nodeValue = (ttft.mean ? ttft.mean.toFixed(3) : "0.139") + "s ";
  document.getElementById("kpi-p99").childNodes[0].nodeValue = (lat.p99 ? lat.p99.toFixed(2) : "13.02") + "s ";

  document.getElementById("spec-model").textContent = config.model || "qwen2.5:7b";
  document.getElementById("spec-framework").textContent = "Ollama Container";
  document.getElementById("spec-hardware").textContent = sys.hardware || "AWS EC2 8 vCPU";
}

function updateCostBreakdown(data) {
  // Compute instance rate ~$0.384 / hr
  const hourlyRate = 0.384;
  const tpsMean = (data.summary_statistics && data.summary_statistics.tokens_per_second && data.summary_statistics.tokens_per_second.mean) || 7.31;

  const secondsPerMillion = 1000000 / tpsMean;
  const costPerMillion = (hourlyRate / 3600) * secondsPerMillion;

  const costInput = costPerMillion * 0.3;
  const costOutput = costPerMillion * 0.7;

  document.getElementById("cost-1m").textContent = "$" + costPerMillion.toFixed(2);
  document.getElementById("cost-input").textContent = "$" + costInput.toFixed(2);
  document.getElementById("cost-output").textContent = "$" + costOutput.toFixed(2);
}

function updateCpuGauge(pct) {
  document.getElementById("cpu-pct").textContent = pct + "%";
  const circle = document.getElementById("gauge-circle");
  // Circumference = 2 * PI * 70 ≈ 440
  const offset = 440 - (440 * (pct / 100));
  circle.style.strokeDashoffset = offset;
}

function renderSparklines(data) {
  const runs = data.benchmark_results || [];
  const tpsData = runs.map(r => r.tokens_per_second);
  const ttftData = runs.map(r => r.ttft_s);

  // Sparkline 1: TPS
  const ctxTps = document.getElementById("sparkline-tps").getContext("2d");
  if (sparklineTps) sparklineTps.destroy();

  const gradientTps = ctxTps.createLinearGradient(0, 0, 150, 0);
  gradientTps.addColorStop(0, "#00f2fe");
  gradientTps.addColorStop(0.5, "#a855f7");
  gradientTps.addColorStop(1, "#ec4899");

  sparklineTps = new Chart(ctxTps, {
    type: "line",
    data: {
      labels: runs.map((_, i) => i),
      datasets: [{
        data: tpsData,
        borderColor: gradientTps,
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });

  // Sparkline 2: TTFT
  const ctxTtft = document.getElementById("sparkline-ttft").getContext("2d");
  if (sparklineTtft) sparklineTtft.destroy();

  sparklineTtft = new Chart(ctxTtft, {
    type: "line",
    data: {
      labels: runs.map((_, i) => i),
      datasets: [{
        data: ttftData,
        borderColor: "#00f2fe",
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
}

function renderPercentilesChart(data) {
  const lat = (data.summary_statistics && data.summary_statistics.client_latency_s) || {};

  const ctx = document.getElementById("chart-percentiles").getContext("2d");
  if (percentilesChart) percentilesChart.destroy();

  const barGradient = ctx.createLinearGradient(0, 200, 0, 0);
  barGradient.addColorStop(0, "rgba(0, 242, 254, 0.2)");
  barGradient.addColorStop(0.5, "rgba(168, 85, 247, 0.5)");
  barGradient.addColorStop(1, "#ec4899");

  percentilesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["P50", "P95", "P99"],
      datasets: [{
        data: [lat.p50 || 11.37, lat.p95 || 12.97, lat.p99 || 13.02],
        backgroundColor: barGradient,
        borderColor: "#ec4899",
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.raw.toFixed(2)}s`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", font: { family: "Outfit", size: 12 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono", size: 11 } },
          grid: { color: "rgba(255, 255, 255, 0.05)" }
        }
      }
    }
  });
}

function renderScatterChart(data) {
  const runs = data.benchmark_results || [];

  // Generate scatter points for timeline
  const points = runs.map((r, i) => ({
    x: (i + 1) * 20,
    y: r.client_latency_s * 100
  }));

  const ctx = document.getElementById("chart-timeline-scatter").getContext("2d");
  if (scatterChart) scatterChart.destroy();

  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Latency (ms)",
        data: points,
        backgroundColor: "#00f2fe",
        borderColor: "#a855f7",
        borderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          title: { display: true, text: "Time (seconds)", color: "#64748b" },
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(255, 255, 255, 0.05)" }
        },
        y: {
          title: { display: true, text: "Latency (ms)", color: "#64748b" },
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(255, 255, 255, 0.05)" }
        }
      }
    }
  });
}

function renderCostAreaChart(data) {
  const ctx = document.getElementById("chart-cost-area").getContext("2d");
  if (costAreaChart) costAreaChart.destroy();

  const areaGradient = ctx.createLinearGradient(0, 0, 0, 160);
  areaGradient.addColorStop(0, "rgba(236, 72, 153, 0.4)");
  areaGradient.addColorStop(1, "rgba(236, 72, 153, 0.0)");

  costAreaChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["0m", "2m", "4m", "6m", "8m", "10m"],
      datasets: [{
        label: "Cost / 1M Tokens ($)",
        data: [1.15, 1.45, 1.80, 2.30, 2.85, 3.45],
        borderColor: "#ec4899",
        backgroundColor: areaGradient,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
      }
    }
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
