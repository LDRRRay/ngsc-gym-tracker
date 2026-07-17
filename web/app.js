const TZ = "Asia/Taipei";
const $ = (id) => document.getElementById(id);
let allRows = [];
let selectedDays = 30;

function localParts(iso) {
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short"
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function sameTaiwanDay(a, b = new Date()) {
  const x = localParts(a);
  const y = localParts(b.toISOString());
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

function crowdText(rate) {
  if (rate <= 0.25) return "人少，現在很適合去";
  if (rate <= 0.5) return "人潮舒適";
  if (rate <= 0.75) return "人數偏多";
  return "接近滿場，建議稍後";
}

function filteredRows() {
  if (!selectedDays) return allRows;
  const cutoff = Date.now() - selectedDays * 86400000;
  return allRows.filter((row) => new Date(row.observed_at).getTime() >= cutoff);
}

function groupedSlots(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const part = localParts(row.observed_at);
    const hour = Number(part.hour);
    if (hour < 6 || hour >= 22) return;
    const minute = Number(part.minute) < 30 ? "00" : "30";
    const key = `${part.weekday}|${String(hour).padStart(2, "0")}:${minute}`;
    const values = groups.get(key) || [];
    values.push(row.current_people);
    groups.set(key, values);
  });
  return groups;
}

function dateKey(iso) {
  const part = localParts(iso);
  return `${part.year}-${part.month}-${part.day}`;
}

function abnormalClosedDays(rows) {
  const days = new Map();
  rows.forEach((row) => {
    const part = localParts(row.observed_at);
    const hour = Number(part.hour);
    if (hour < 9 || hour >= 21) return;
    const minuteOfDay = hour * 60 + Number(part.minute);
    const key = dateKey(row.observed_at);
    const day = days.get(key) || { samples: 0, first: minuteOfDay, last: minuteOfDay, hasPeople: false };
    day.samples += 1;
    day.first = Math.min(day.first, minuteOfDay);
    day.last = Math.max(day.last, minuteOfDay);
    day.hasPeople ||= row.current_people > 0;
    days.set(key, day);
  });
  return new Set([...days.entries()]
    .filter(([, day]) => day.samples >= 36 && day.last - day.first >= 180 && !day.hasPeople)
    .map(([key]) => key));
}

function renderAnalysis() {
  const rows = filteredRows();
  const closedDays = abnormalClosedDays(rows);
  const analysisRows = rows.filter((row) => !closedDays.has(dateKey(row.observed_at)));
  const groups = groupedSlots(analysisRows);
  const best = [...groups.entries()]
    .filter(([key]) => {
      const hour = Number(key.split("|")[1].split(":")[0]);
      return hour >= 9 && hour < 21;
    })
    .filter(([, values]) => values.length >= 3)
    .map(([key, values]) => ({
      key,
      samples: values.length,
      average: values.reduce((a, b) => a + b, 0) / values.length
    }))
    .sort((a, b) => a.average - b.average || b.samples - a.samples)
    .slice(0, 8);

  $("recommendations").innerHTML = best.length
    ? best.map((item, index) => {
      const [day, slot] = item.key.split("|");
      return `<div class="recommendation">
        <span class="rank">#${index + 1}</span>
        <span class="slot">${day} ${slot}</span>
        <span class="avg">平均 ${item.average.toFixed(1)} 人 <small>· ${item.samples} 筆樣本</small></span>
      </div>`;
    }).join("")
    : `<p class="empty">資料累積中。每個時段至少有 3 筆樣本後，才會提供推薦。</p>`;

  const slots = Array.from({ length: 32 }, (_, index) => {
    const total = 360 + index * 30;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${total % 60 ? "30" : "00"}`;
  });
  const days = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
  const averages = [...groups.values()]
    .filter((values) => values.length >= 3)
    .map((values) => values.reduce((a, b) => a + b, 0) / values.length);
  const max = Math.max(1, ...averages);
  const colors = ["#2878b8", "#83b9d8", "#f5e7c6", "#ef9a72", "#b9252f"];
  let heatmap = `<span></span>${slots.map((slot) => `<span class="heat-time">${slot}</span>`).join("")}`;
  days.forEach((day) => {
    heatmap += `<span class="heat-label">${day}</span>`;
    slots.forEach((slot) => {
      const values = groups.get(`${day}|${slot}`) || [];
      if (values.length < 3) {
        heatmap += `<span class="heat-cell" title="${day} ${slot}：樣本不足"></span>`;
      } else {
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const color = colors[Math.min(4, Math.floor(average / max * 5))];
        heatmap += `<span class="heat-cell" style="background:${color}" title="${day} ${slot}：平均 ${average.toFixed(1)} 人（${values.length} 筆）"></span>`;
      }
    });
  });
  $("heatmap").innerHTML = heatmap;
  $("period-note").textContent =
    `統計${selectedDays ? `最近 ${selectedDays} 天` : "全部歷史"}，共 ${analysisRows.length.toLocaleString("zh-TW")} 筆有效觀測；灰色代表樣本不足。${closedDays.size ? ` 已排除 ${closedDays.size} 個異常休館日。` : ""}`;
}

function render(data) {
  allRows = data.observations || [];
  const latest = allRows.at(-1);
  if (!latest) throw new Error("尚無觀測資料");

  const rate = latest.current_people / latest.capacity;
  $("current").textContent = latest.current_people;
  $("capacity").textContent = latest.capacity;
  $("rate").textContent = `${Math.round(rate * 100)}%`;
  $("gauge").style.setProperty("--p", `${Math.min(rate, 1) * 100}%`);
  $("crowd-label").textContent = crowdText(rate);
  $("status-text").textContent = "資料正常";
  $("updated").textContent = `最後更新 ${new Intl.DateTimeFormat("zh-TW", {
    timeZone: TZ, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(new Date(latest.observed_at))}`;
  $("sample-count").textContent = allRows.length.toLocaleString("zh-TW");

  const today = allRows.filter((row) => {
    if (!sameTaiwanDay(row.observed_at)) return false;
    const hour = Number(localParts(row.observed_at).hour);
    return hour >= 6 && hour < 22;
  });
  if (today.length) {
    const minimum = today.reduce((a, b) => a.current_people <= b.current_people ? a : b);
    const part = localParts(minimum.observed_at);
    $("today-min").textContent = `${minimum.current_people} 人`;
    $("today-min-time").textContent = `${part.hour}:${part.minute}`;
    $("today-avg").textContent =
      `${Math.round(today.reduce((sum, row) => sum + row.current_people, 0) / today.length)} 人`;
  }

  const trend = $("trend");
  trend.innerHTML = "";
  today.filter((row) => {
    const hour = Number(localParts(row.observed_at).hour);
    return hour >= 6 && hour < 22;
  }).forEach((row) => {
    const part = localParts(row.observed_at);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(2, row.current_people / row.capacity * 100)}%`;
    const minutesSinceOpen = (Number(part.hour) - 6) * 60 + Number(part.minute);
    bar.style.left = `${minutesSinceOpen / (16 * 60) * 100}%`;
    bar.dataset.tip = `${part.hour}:${part.minute} · ${row.current_people} 人`;
    trend.appendChild(bar);
  });

  const renderedBars = [...trend.children];
  const yAxis = document.createElement("div");
  yAxis.className = "y-axis";
  yAxis.setAttribute("aria-hidden", "true");
  yAxis.innerHTML = "<span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>";
  const barsArea = document.createElement("div");
  barsArea.className = "trend-bars";
  barsArea.append(...renderedBars);
  const xAxis = document.createElement("div");
  xAxis.className = "x-axis";
  xAxis.innerHTML = "<span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span><span>22:00</span>";
  trend.append(yAxis, barsArea, xAxis);

  $("records").innerHTML = allRows.slice(-20).reverse().map((row) => {
    const part = localParts(row.observed_at);
    return `<tr><td>${part.year}/${part.month}/${part.day} ${part.hour}:${part.minute}</td>
      <td>${row.current_people} 人</td><td>${row.capacity} 人</td>
      <td>${Math.round(row.current_people / row.capacity * 100)}%</td></tr>`;
  }).join("");
  renderAnalysis();
}

document.querySelectorAll(".range-picker button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedDays = Number(button.dataset.days);
    document.querySelectorAll(".range-picker button")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderAnalysis();
  });
});

async function loadHistory() {
  const apiBase = location.hostname.endsWith("workers.dev")
    ? ""
    : "https://ngsc-gym-tracker.raymond60308.workers.dev";
  const candidates = [
    `${apiBase}/api/history?days=120&v=${Date.now()}`,
    `data/history.json?v=${Date.now()}`,
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response.json();
    } catch {
      // Cloudflare API may not exist on the GitHub Pages fallback.
    }
  }
  throw new Error("資料讀取失敗");
}

loadHistory()
  .then(render)
  .catch((error) => {
    $("status-text").textContent = "暫時無法更新";
    $("crowd-label").textContent = error.message;
  });
