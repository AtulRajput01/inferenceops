/**
 * InferenceOps Dashboard - Pixel-Perfect Mockup Visualization & Interactivity
 */

let sparklineTps = null;
let sparklineTtft = null;
let sparklineP99 = null;
let percentilesChart = null;
let scatterChart = null;
let costAreaChart = null;

// Mockup Data Matching Image 1
const MOCKUP_BASELINE = {
  "metadata": {
    "timestamp_utc": "20260915_124000",
    "system_info": {
      "platform": "NVIDIA A100-SXM4-80GB x8 NVLink",
      "hardware": "A100x8 NVLink"
    },
    "configuration": {
      "url": "http://localhost:8000/v1/chat/completions",
      "model": "Llama 2-70b-chat",
      "framework": "Hugging Face TGI",
      "prompt": "Benchmarking LLM latency distribution & throughput stability.",
      "num_requests": 200,
      "tag": "tgi_a100_70b"
    }
  },
  "summary_statistics": {
    "count": 200,
    "client_latency_s": { "mean": 0.65, "p50": 0.31, "p95": 0.88, "p99": 1.25, "min": 0.18, "max": 1.50 },
    "ttft_s": { "mean": 0.139, "p50": 0.139, "p95": 0.145, "p99": 0.150, "min": 0.120, "max": 0.165 },
    "tokens_per_second": { "mean": 7.31, "p50": 7.31, "p95": 7.80, "p99": 8.10, "min": 6.90, "max": 8.40 },
    "tokens": { "total_prompt_tokens": 8400, "total_eval_tokens": 25600, "avg_prompt_tokens": 42.0, "avg_eval_tokens": 128.0 }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initDashboard(MOCKUP_BASELINE);
  setupFileUpload();
  renderEqualizerBars();
});

function initDashboard(data) {
  updateHeroCards(data);
  updateCpuGauge(84.3, "48/64");
  renderSparklines();
  renderPercentilesChart(data);
  renderScatterChart();
  renderCostAreaChart();
}

function updateHeroCards(data) {
  const stats = data.summary_statistics || {};
  const tps = stats.tokens_per_second || {};
  const ttft = stats.ttft_s || {};
  const lat = stats.client_latency_s || {};
  const config = (data.metadata && data.metadata.configuration) || {};
  const sys = (data.metadata && data.metadata.system_info) || {};

  document.getElementById("kpi-tps").textContent = (tps.mean ? tps.mean.toFixed(2) : "7.31");
  document.getElementById("kpi-ttft").textContent = (ttft.p50 ? ttft.p50.toFixed(3) : "0.139") + "s";
  document.getElementById("kpi-p99").textContent = (lat.p99 ? lat.p99.toFixed(2) : "1.25") + "s";

  document.getElementById("spec-model").textContent = config.model || "Llama 2-70b-chat";
  document.getElementById("spec-framework").textContent = config.framework || "Hugging Face TGI";
  document.getElementById("spec-hardware").textContent = sys.hardware || "A100x8 NVLink";
}

function updateCpuGauge(pct, coresStr) {
  document.getElementById("cpu-pct").textContent = pct + "%";
  document.getElementById("cpu-cores").textContent = coresStr || "48/64";
  const circle = document.getElementById("gauge-circle");
  const offset = 427 - (427 * (pct / 100));
  circle.style.strokeDashoffset = offset;
}

function renderEqualizerBars() {
  const container = document.getElementById("equalizer-bars");
  container.innerHTML = "";
  const barHeights = [40, 65, 85, 95, 70, 80, 60, 90, 100, 75, 85, 90, 70, 95, 80, 85, 60, 90, 75, 50];
  barHeights.forEach(h => {
    const bar = document.createElement("div");
    bar.className = "eq-bar";
    bar.style.height = h + "%";
    container.appendChild(bar);
  });
}

function renderSparklines() {
  // Sparkline 1: TPS (Magenta line with filled gradient)
  const ctxTps = document.getElementById("sparkline-tps").getContext("2d");
  if (sparklineTps) sparklineTps.destroy();

  const gradientTpsFill = ctxTps.createLinearGradient(0, 0, 0, 50);
  gradientTpsFill.addColorStop(0, "rgba(236, 72, 153, 0.4)");
  gradientTpsFill.addColorStop(1, "rgba(236, 72, 153, 0.0)");

  const tpsPoints = [6.8, 7.0, 6.9, 7.2, 7.5, 7.1, 7.4, 7.3, 7.2, 7.6, 7.3, 7.4, 7.31];

  sparklineTps = new Chart(ctxTps, {
    type: "line",
    data: {
      labels: tpsPoints.map((_, i) => i),
      datasets: [{
        data: tpsPoints,
        borderColor: "#d946ef",
        borderWidth: 2,
        fill: true,
        backgroundColor: gradientTpsFill,
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

  // Sparkline 2: TTFT (Cyan waveform)
  const ctxTtft = document.getElementById("sparkline-ttft").getContext("2d");
  if (sparklineTtft) sparklineTtft.destroy();

  const ttftPoints = [0.12, 0.15, 0.13, 0.16, 0.14, 0.17, 0.13, 0.18, 0.14, 0.16, 0.139];

  const gradientTtftFill = ctxTtft.createLinearGradient(0, 0, 0, 50);
  gradientTtftFill.addColorStop(0, "rgba(0, 242, 254, 0.3)");
  gradientTtftFill.addColorStop(1, "rgba(0, 242, 254, 0.0)");

  sparklineTtft = new Chart(ctxTtft, {
    type: "line",
    data: {
      labels: ttftPoints.map((_, i) => i),
      datasets: [{
        data: ttftPoints,
        borderColor: "#00f2fe",
        borderWidth: 2,
        fill: true,
        backgroundColor: gradientTtftFill,
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

  // Sparkline 3: P99 Latency (Subtle Pink Area)
  const ctxP99 = document.getElementById("sparkline-p99").getContext("2d");
  if (sparklineP99) sparklineP99.destroy();

  const p99Points = [1.10, 1.15, 1.08, 1.20, 1.18, 1.25, 1.22, 1.25];

  const gradientP99Fill = ctxP99.createLinearGradient(0, 0, 0, 50);
  gradientP99Fill.addColorStop(0, "rgba(236, 72, 153, 0.25)");
  gradientP99Fill.addColorStop(1, "rgba(236, 72, 153, 0.0)");

  sparklineP99 = new Chart(ctxP99, {
    type: "line",
    data: {
      labels: p99Points.map((_, i) => i),
      datasets: [{
        data: p99Points,
        borderColor: "#ec4899",
        borderWidth: 1.5,
        fill: true,
        backgroundColor: gradientP99Fill,
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
  const stats = data.summary_statistics || {};
  const lat = stats.client_latency_s || {};

  const p50Val = lat.p50 !== undefined ? lat.p50 : 0.31;
  const p95Val = lat.p95 !== undefined ? lat.p95 : 0.88;
  const p99Val = lat.p99 !== undefined ? lat.p99 : 1.25;

  const ctx = document.getElementById("chart-percentiles").getContext("2d");
  if (percentilesChart) percentilesChart.destroy();

  // Cyan gradient for P50
  const gradP50 = ctx.createLinearGradient(0, 200, 0, 0);
  gradP50.addColorStop(0, "rgba(0, 242, 254, 0.1)");
  gradP50.addColorStop(1, "rgba(0, 242, 254, 0.8)");

  // Pink gradient for P95
  const gradP95 = ctx.createLinearGradient(0, 200, 0, 0);
  gradP95.addColorStop(0, "rgba(168, 85, 247, 0.1)");
  gradP95.addColorStop(1, "rgba(236, 72, 153, 0.85)");

  // Magenta gradient for P99
  const gradP99 = ctx.createLinearGradient(0, 200, 0, 0);
  gradP99.addColorStop(0, "rgba(0, 242, 254, 0.2)");
  gradP99.addColorStop(0.5, "rgba(168, 85, 247, 0.6)");
  gradP99.addColorStop(1, "rgba(236, 72, 153, 0.95)");

  // Plugin to render floating value badges on top of vertical bars
  const floatingBadgesPlugin = {
    id: 'floatingBadges',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const labels = [`P50=${p50Val}s`, `P95=${p95Val}s`, `P99=${p99Val}s`];
      const fontColors = ["#00f2fe", "#ec4899", "#d946ef"];

      meta.data.forEach((bar, index) => {
        const valText = labels[index] || "";
        const color = fontColors[index] || "#fff";

        ctx.save();
        ctx.font = '500 12px "Outfit", sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(valText, bar.x, bar.y - 8);
        ctx.restore();
      });
    }
  };

  percentilesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["P50", "P95", "P99"],
      datasets: [{
        data: [p50Val, p95Val, p99Val],
        backgroundColor: [gradP50, gradP95, gradP99],
        borderColor: ["#00f2fe", "#ec4899", "#d946ef"],
        borderWidth: 2,
        borderRadius: 6,
        barThickness: 54
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 25 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", font: { family: "Outfit", size: 13, weight: "600" } },
          grid: { display: false }
        },
        y: {
          min: 0,
          max: Math.ceil(p99Val * 1.15 * 10) / 10,
          ticks: { color: "#64748b", font: { family: "Outfit", size: 11 }, stepSize: 0.3 },
          grid: { color: "rgba(255, 255, 255, 0.04)" }
        }
      }
    },
    plugins: [floatingBadgesPlugin]
  });
}

function renderScatterChart() {
  const ctx = document.getElementById("chart-timeline-scatter").getContext("2d");
  if (scatterChart) scatterChart.destroy();

  // Generate dense scatter plot points matching mockup
  const cyanPoints = [];
  const purplePoints = [];

  for (let i = 0; i < 220; i++) {
    const x = (i / 220) * 200;
    // Latency centered around 300ms - 600ms with some outliers up to 1500ms
    const baseLatency = 250 + Math.random() * 350 + (Math.random() > 0.92 ? Math.random() * 800 : 0);
    if (i % 2 === 0) {
      cyanPoints.push({ x, y: baseLatency });
    } else {
      purplePoints.push({ x, y: baseLatency * (0.85 + Math.random() * 0.3) });
    }
  }

  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Cyan Latencies",
          data: cyanPoints,
          backgroundColor: "rgba(0, 242, 254, 0.65)",
          pointRadius: 2.5,
          pointHoverRadius: 4
        },
        {
          label: "Purple Latencies",
          data: purplePoints,
          backgroundColor: "rgba(217, 70, 239, 0.65)",
          pointRadius: 2.5,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111428",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleFont: { family: "Outfit", size: 13, weight: "700" },
          bodyFont: { family: "Outfit", size: 12 },
          callbacks: {
            title: () => "Last 25",
            label: (ctx) => [
              `Latency: ${ctx.raw.y.toFixed(0)}ms`,
              `Output: 100ms`,
              `Ots avg: 200s`
            ]
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          title: { display: true, text: "Time (hours)", color: "#64748b", font: { size: 11 } },
          ticks: { color: "#64748b", callback: (val) => val + "h" },
          grid: { color: "rgba(255, 255, 255, 0.04)" }
        },
        y: {
          title: { display: true, text: "Latency (ms)", color: "#64748b", font: { size: 11 } },
          ticks: { color: "#64748b", callback: (val) => val + "ms" },
          grid: { color: "rgba(255, 255, 255, 0.04)" }
        }
      }
    }
  });
}

function renderCostAreaChart() {
  const ctx = document.getElementById("chart-cost-area").getContext("2d");
  if (costAreaChart) costAreaChart.destroy();

  const fillGradient = ctx.createLinearGradient(0, 0, 0, 160);
  fillGradient.addColorStop(0, "rgba(217, 70, 239, 0.4)");
  fillGradient.addColorStop(1, "rgba(217, 70, 239, 0.0)");

  const strokeGradient = ctx.createLinearGradient(0, 0, 300, 0);
  strokeGradient.addColorStop(0, "#00f2fe");
  strokeGradient.addColorStop(0.5, "#a855f7");
  strokeGradient.addColorStop(1, "#ec4899");

  costAreaChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["0m", "2m", "4m", "6m", "8m", "10m"],
      datasets: [{
        label: "Cost / 1M Tokens ($)",
        data: [0.15, 0.45, 0.85, 1.40, 2.20, 3.45],
        borderColor: strokeGradient,
        backgroundColor: fillGradient,
        fill: true,
        tension: 0.45,
        borderWidth: 2.5,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
        y: {
          ticks: { color: "#64748b", font: { size: 11 }, callback: (val) => "$" + val.toFixed(2) },
          grid: { color: "rgba(255, 255, 255, 0.04)" }
        }
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
