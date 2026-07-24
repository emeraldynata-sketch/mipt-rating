(function () {
  const data = window.MIFI_DATA;
  const applicantId = data.applicantId;
  normalizeRows();
  let route = parseRoute();

  const summaryView = document.getElementById("summaryView");
  const directionView = document.getElementById("directionView");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const directionNav = document.getElementById("directionNav");
  const globalSearch = document.getElementById("globalSearch");

  document.getElementById("buildStamp").textContent = data.generatedAt;

  function normalizeRows() {
    data.directions.forEach((direction) => {
      if (!direction.rows.length || !Array.isArray(direction.rows[0])) return;
      direction.rows = direction.rows.map((values) => {
        const row = {};
        direction.columns.forEach((column, index) => {
          row[column] = values[index] ?? "";
        });
        return row;
      });
    });
  }

  function parseRoute() {
    const hash = window.location.hash || "#/summary";
    const parts = hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "direction" && parts[1]) {
      return { view: "direction", key: decodeURIComponent(parts[1]) };
    }
    return { view: "summary" };
  }

  function yes(value) {
    return String(value || "").trim().toLowerCase() === "да";
  }

  function num(value) {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function fmt(value) {
    return value === null || value === undefined || value === "" ? "" : value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function headerLabel(column) {
    return escapeHtml(column)
      .replaceAll("_", " ")
      .replaceAll("Расчет ", "")
      .replaceAll(" госуслуги", "<br>госуслуги")
      .replaceAll(" согласие ", "<br>согласие ")
      .replaceAll(" высший ", "<br>высший ")
      .replaceAll(" основной ", "<br>основной ")
      .replaceAll(" участника", "<br>участника");
  }

  function scoreClass(value) {
    const parsed = num(value);
    if (parsed === null) return "";
    return parsed > data.scoreThreshold ? "score-risk" : "score-ok";
  }

  function scoreCell(value) {
    return `<td class="${scoreClass(value)}">${fmt(value)}</td>`;
  }

  function badge(value) {
    const cls = yes(value) ? "badge-yes" : value ? "badge-no" : "badge-soft";
    return `<span class="badge ${cls}">${escapeHtml(value || "нет")}</span>`;
  }

  function applicantCode(row) {
    return String(row["ID участника"] || row["Код поступающего"] || "");
  }

  function metric(label, value, note, detail) {
    const help = detail || note || label;
    return `
      <div class="metric" title="${escapeHtml(help)}">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(value)}</div>
        <div class="metric-note">${escapeHtml(note || "")}</div>
        ${detail ? `<div class="metric-detail">${escapeHtml(detail)}</div>` : ""}
      </div>
    `;
  }

  function buildNav() {
    directionNav.innerHTML = data.directions.map((direction) => `
      <a class="direction-link" href="#/direction/${encodeURIComponent(direction.key)}" data-key="${escapeHtml(direction.key)}">
        ${escapeHtml(direction.shortName)}
        <span class="direction-meta">приоритет ${fmt(direction.priority)} · мест ${fmt(direction.places)}</span>
      </a>
    `).join("");
  }

  function priorityOptions(rows) {
    return [...new Set(rows.map((row) => row["Приоритет конкурса"]).filter((value) => value !== undefined && value !== ""))]
      .sort((a, b) => num(a) - num(b));
  }

  function setActiveNav() {
    document.querySelectorAll(".direction-link").forEach((el) => {
      el.classList.toggle("active", route.view === "direction" && el.dataset.key === route.key);
    });
  }

  function render() {
    route = parseRoute();
    setActiveNav();
    const search = globalSearch.value.trim().toLowerCase();
    if (route.view === "direction") {
      const direction = data.directions.find((item) => item.key === route.key) || data.directions[0];
      renderDirection(direction, search);
      summaryView.classList.add("hidden");
      directionView.classList.remove("hidden");
    } else {
      renderSummary(search);
      directionView.classList.add("hidden");
      summaryView.classList.remove("hidden");
    }
  }

  function renderSummary(search) {
    pageTitle.textContent = "Свод МИФИ";
    pageSubtitle.textContent = `Код Ани ${applicantId}. Балл МИФИ ${data.anyaScore}; красным отмечены проходные ${data.anyaScore} и выше.`;

    const rows = data.summary.filter((row) => {
      if (!search) return true;
      return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search));
    });
    const bestMain = rows.filter((row) => num(row.mainCutoff) !== null).sort((a, b) => num(a.mainCutoff) - num(b.mainCutoff))[0];
    const bestHigh = rows.filter((row) => num(row.highCutoff) !== null).sort((a, b) => num(a.highCutoff) - num(b.highCutoff))[0];

    summaryView.innerHTML = `
      <div class="cards">
        ${metric("Направления МИФИ", data.directions.length, "выгрузки Госуслуг", "Сколько направлений МИФИ есть в загруженных списках Ани; это не полный контур всех направлений МИФИ.")}
        ${metric("Строки в списках", data.totalRows, "после обогащения", "Общее число строк во всех загруженных направлениях МИФИ.")}
        ${metric("Лучшая отсечка: основной без чужих", bestMain ? bestMain.mainCutoff : "", bestMain ? bestMain.direction : "", "Минимальный проходной балл среди направлений по модели основного приоритета, исключая известных абитуриентов с согласием в другом вузе.")}
        ${metric("Лучшая отсечка: высший проходной", bestHigh ? bestHigh.highCutoff : "", bestHigh ? bestHigh.direction : "", "Минимальный проходной балл среди направлений по модели приказа: учитываются только согласия и прохождение по приоритетам.")}
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Свод по направлениям МИФИ</div>
        </div>
        <div class="table-wrap">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Приоритет</th>
                <th>Направление</th>
                <th>Мест</th>
                <th>Осн. без чужих выше</th>
                <th>Проходной осн. без чужих</th>
                <th>Высший выше</th>
                <th>Проходной высший</th>
                <th>Проходной<br>высш. +10%</th>
                <th>Аня балл</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${fmt(row.priority)}</td>
                  <td><a class="route-link" href="#/direction/${encodeURIComponent(row.key)}">${escapeHtml(row.direction)}</a></td>
                  <td>${fmt(row.places)}</td>
                  <td>${fmt(row.mainAbove)}</td>
                  <td>${fmt(row.mainWithoutHighNoConsent)}</td>
                  ${scoreCell(row.mainCutoff)}
                  <td>${fmt(row.highAbove)}</td>
                  ${scoreCell(row.highCutoff)}
                  ${scoreCell(row.highCutoffPlus10)}
                  <td>${fmt(row.anyaScore)}</td>
                  <td>${escapeHtml(row.anyaStatus || "")}</td>
                </tr>
              `).join("") || `<tr><td colspan="11" class="empty">Ничего не найдено</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.querySelector(".summary-table thead tr th:nth-child(4)")
      ?.insertAdjacentHTML("afterend", "<th>Осн. без высшего и согласий</th>");
  }

  function renderDirection(direction, search) {
    pageTitle.textContent = direction.shortName;
    pageSubtitle.textContent = `Приоритет ${fmt(direction.priority)} · мест ${fmt(direction.places)} · файл ${direction.fileName}`;
    const anya = direction.rows.find((row) => applicantCode(row) === applicantId);
    const priorities = priorityOptions(direction.rows);

    directionView.innerHTML = `
      <div class="cards">
        ${metric("Основной приоритет выше Ани и с таким же баллом", direction.mainAbove, `отсечка ${fmt(direction.mainCutoff)}`, "Сколько абитуриентов с баллом Ани и выше получают это направление по расчету основного приоритета в рамках загруженных списков МИФИ.")}
        ${metric("Основной без чужих согласий", direction.mainWithoutOtherConsents, `отсечка ${fmt(direction.mainWithoutOtherCutoff)}`, "То же, но исключены абитуриенты, у которых известно согласие в МФТИ или Бауманке.")}
        ${metric("Высший проходной выше Ани и с таким же баллом", direction.highAbove, `отсечка ${fmt(direction.highCutoff)}`, "Сколько абитуриентов с баллом Ани и выше проходят в модель текущего приказа: есть согласие и направление является высшим проходным.")}
        ${metric("Аня в этом списке", anya ? `№ ${fmt(anya["Порядковый номер"])}` : "не найдена", anya ? `балл ${fmt(anya["Сумма баллов"])}` : "", "Позиция и расчетный балл Ани в текущем конкурсном списке.")}
      </div>
      <div class="cards scenario-cards">
        ${metric("Сценарий мест +10%", direction.placesPlus10 || "", `было ${fmt(direction.places)}`, "Модельный сценарий: количество мест увеличено на 10% с округлением вверх.")}
        ${metric("Осн. без чужих +10%", direction.mainWithoutOtherConsentsPlus10, `отсечка ${fmt(direction.mainWithoutOtherCutoffPlus10)}`, "Основной приоритет без известных чужих согласий при увеличенном числе мест.")}
        ${metric("Осн. без высш. и согл. +10%", direction.mainWithoutHighNoConsentPlus10, "балл Ани и выше", "Абитуриенты с основным приоритетом, без высшего проходного и без известного согласия при увеличенном числе мест.")}
        ${metric("Высший проходной +10%", direction.highAbovePlus10, `отсечка ${fmt(direction.highCutoffPlus10)}`, "Высший проходной при увеличенном числе мест.")}
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Обогащенный список</div>
          <div class="toolbar">
            <select id="rowFilter">
              <option value="all">все строки</option>
              <option value="main">основной приоритет</option>
              <option value="mainNoOther">основной без согласий в других</option>
              <option value="highest">высший проходной</option>
              <option value="consent">есть согласие</option>
              <option value="bvi">БВИ</option>
            </select>
            <select id="priorityFilter">
              <option value="all">все приоритеты</option>
              ${priorities.map((priority) => `<option value="${escapeHtml(priority)}">приоритет ${escapeHtml(priority)}</option>`).join("")}
            </select>
            <span id="rowCount" class="row-count"></span>
            <button id="exportCsv" type="button">Выгрузить Excel</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="direction-table">
            <thead>
              <tr><th>#</th>${direction.columns.map((col) => `<th>${headerLabel(col)}</th>`).join("")}</tr>
            </thead>
            <tbody id="directionRows"></tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelector("#directionView .cards .metric:nth-child(2)")
      ?.insertAdjacentHTML("afterend", metric("Осн. без высшего и без согласий", direction.mainWithoutHighNoConsent, "балл Ани и выше", "Абитуриенты с основным приоритетом, без высшего проходного и без известного согласия, чей расчетный балл не ниже балла Ани."));

    const select = document.getElementById("rowFilter");
    const prioritySelect = document.getElementById("priorityFilter");
    const repaint = () => paintDirectionRows(direction, search, select.value, prioritySelect.value);
    select.addEventListener("change", repaint);
    prioritySelect.addEventListener("change", repaint);
    document.getElementById("exportCsv").addEventListener("click", () => {
      const rows = filterRows(direction.rows, search, select.value, prioritySelect.value);
      downloadDirectionCsv(direction, rows);
    });
    repaint();
  }

  function csvValue(value) {
    const text = String(value ?? "").replaceAll("\r\n", " ").replaceAll("\n", " ").replaceAll("\r", " ");
    return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function safeFileName(value) {
    return String(value || "rating")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || "rating";
  }

  function downloadDirectionCsv(direction, rows) {
    const header = ["#", ...direction.columns];
    const lines = [
      header.map(csvValue).join(";"),
      ...rows.map((row, index) => [index + 1, ...direction.columns.map((column) => row[column])].map(csvValue).join(";")),
    ];
    const stamp = data.generatedAt.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "");
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(direction.shortName)}_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filterRows(rows, search, filter, priorityFilter = "all") {
    return rows.filter((row) => {
      if (filter === "main" && !yes(row["Расчет_основной_приоритет"])) return false;
      if (filter === "mainNoOther" && (!yes(row["Расчет_основной_приоритет"]) || yes(row["Расчет_согласие_в_другом_вузе"]))) return false;
      if (filter === "highest" && !yes(row["Расчет_высший_проходной_приоритет"])) return false;
      if (filter === "consent" && !yes(row["Расчет_согласие_есть_в_любом_из_3_вузов"]) && !yes(row["Подано согласие"])) return false;
      if (filter === "bvi" && String(row["Баллы за ВИ"]).trim() !== "Без вступительных испытаний") return false;
      if (priorityFilter !== "all" && String(row["Приоритет конкурса"]) !== String(priorityFilter)) return false;
      if (!search) return true;
      return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search));
    });
  }

  function paintDirectionRows(direction, search, filter, priorityFilter) {
    const rows = filterRows(direction.rows, search, filter, priorityFilter);
    const counter = document.getElementById("rowCount");
    if (counter) {
      counter.textContent = `Строк: ${rows.length} из ${direction.rows.length}`;
    }
    document.getElementById("directionRows").innerHTML = rows.map((row, index) => `
      <tr class="${applicantCode(row) === applicantId ? "anya-row" : ""}">
        <td class="row-index">${index + 1}</td>
        ${direction.columns.map((col) => {
          const value = row[col];
          if (["Подано согласие", "Расчет_основной_приоритет", "Расчет_высший_проходной_приоритет", "Расчет_согласие_есть_в_любом_из_3_вузов", "Расчет_согласие_в_этом_вузе", "Расчет_согласие_в_другом_вузе", "Согласие_МФТИ_госуслуги", "Согласие_МИФИ_госуслуги", "Согласие_Баумана_госуслуги"].includes(col)) {
            return `<td>${badge(value)}</td>`;
          }
          return `<td>${escapeHtml(value)}</td>`;
        }).join("")}
      </tr>
    `).join("") || `<tr><td colspan="${direction.columns.length + 1}" class="empty">Ничего не найдено</td></tr>`;
  }

  globalSearch.addEventListener("input", render);
  window.addEventListener("hashchange", render);
  buildNav();
  render();
})();
