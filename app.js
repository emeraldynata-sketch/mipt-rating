(function () {
  const data = window.MIPT_DATA;
  const applicantId = data.applicantId;
  let route = parseRoute();

  const summaryView = document.getElementById("summaryView");
  const directionView = document.getElementById("directionView");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const directionNav = document.getElementById("directionNav");
  const globalSearch = document.getElementById("globalSearch");

  document.getElementById("buildStamp").textContent = data.generatedAt;

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

  function badge(value) {
    const cls = yes(value) ? "badge-yes" : value ? "badge-no" : "badge-soft";
    return `<span class="badge ${cls}">${escapeHtml(value || "нет")}</span>`;
  }

  function scoreClass(value) {
    const parsed = num(value);
    if (parsed === null) return "";
    return parsed > data.scoreThreshold ? "score-risk" : "score-ok";
  }

  function scoreCell(value) {
    return `<td class="${scoreClass(value)}">${fmt(value)}</td>`;
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
      .replaceAll(" МФТИ ", " МФТИ<br>")
      .replaceAll(" госуслуги", "<br>госуслуги")
      .replaceAll(" без согласий ", "<br>без согласий ")
      .replaceAll(" высший ", "<br>высший ")
      .replaceAll(" основной ", "<br>основной ")
      .replaceAll(" назначенный ", "<br>назначенный ");
  }

  function buildNav() {
    directionNav.innerHTML = data.directions.map((direction) => `
      <a class="direction-link" href="#/direction/${encodeURIComponent(direction.key)}" data-key="${escapeHtml(direction.key)}">
        ${escapeHtml(direction.shortName)}
        <span class="direction-meta">приоритет ${fmt(direction.priority)} · мест ${fmt(direction.places)}</span>
      </a>
    `).join("");
  }

  function setActiveNav() {
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", route.view === "summary");
    });
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

  function summaryRows(search) {
    return data.summary.filter((row) => {
      if (!search) return true;
      return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search));
    });
  }

  function renderSummary(search) {
    pageTitle.textContent = "Свод";
    pageSubtitle.textContent = `Код Ани ${applicantId}. Порог сравнения в своде: больше ${data.scoreThreshold}.`;

    const rows = summaryRows(search);
    const bestMain = rows.filter((row) => num(row.mainCutoff) !== null).sort((a, b) => num(a.mainCutoff) - num(b.mainCutoff))[0];
    const bestConsent = rows.filter((row) => num(row.highCutoff) !== null).sort((a, b) => num(a.highCutoff) - num(b.highCutoff))[0];

    summaryView.innerHTML = `
      <div class="cards">
        ${metric("Направлений", data.directions.length, "полный общий конкурс МФТИ")}
        ${metric("Строк в списках", data.totalRows, "обогащенные CSV")}
        ${metric("Мин. основной без чужих", bestMain ? bestMain.mainCutoff : "", bestMain ? bestMain.direction : "")}
        ${metric("Мин. высший проходной", bestConsent ? bestConsent.highCutoff : "", bestConsent ? bestConsent.direction : "")}
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Свод по направлениям</div>
          <div class="toolbar">
            <label><input type="checkbox" id="onlyAnyaPriorities"> только приоритеты Ани</label>
          </div>
        </div>
        <div class="table-wrap">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Приоритет</th>
                <th>Направление</th>
                <th>Код</th>
                <th>Школа</th>
                <th>Мест</th>
                <th>Прошлый проходной</th>
                <th>Осн. без чужих выше</th>
                <th>Проходной осн. без чужих</th>
                <th>Высший выше</th>
                <th>Проходной высший</th>
                <th>Аня №</th>
                <th>Аня балл</th>
              </tr>
            </thead>
            <tbody id="summaryRows"></tbody>
          </table>
        </div>
      </div>
    `;

    const checkbox = document.getElementById("onlyAnyaPriorities");
    checkbox.addEventListener("change", () => paintSummaryRows(rows, checkbox.checked));
    paintSummaryRows(rows, false);
  }

  function paintSummaryRows(rows, onlyAnyaPriorities) {
    const filtered = onlyAnyaPriorities ? rows.filter((row) => row.priority) : rows;
    document.getElementById("summaryRows").innerHTML = filtered.map((row) => `
      <tr>
        <td>${fmt(row.priority)}</td>
        <td><a class="route-link" href="#/direction/${encodeURIComponent(row.key)}">${escapeHtml(row.direction)}</a></td>
        <td>${escapeHtml(row.code || "")}</td>
        <td>${escapeHtml(row.school || "")}</td>
        <td>${fmt(row.places)}</td>
        ${scoreCell(row.previousCutoff)}
        <td>${fmt(row.mainAbove)}</td>
        ${scoreCell(row.mainCutoff)}
        <td>${fmt(row.highAbove)}</td>
        ${scoreCell(row.highCutoff)}
        <td>${fmt(row.anyaRank)}</td>
        <td>${fmt(row.anyaScore)}</td>
      </tr>
    `).join("") || `<tr><td colspan="12" class="empty">Ничего не найдено</td></tr>`;
  }

  function metric(label, value, note) {
    return `
      <div class="metric">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(value)}</div>
        <div class="metric-note">${escapeHtml(note || "")}</div>
      </div>
    `;
  }

  function renderDirection(direction, search) {
    pageTitle.textContent = direction.shortName;
    pageSubtitle.textContent = `Приоритет ${fmt(direction.priority)} · мест ${fmt(direction.places)} · файл ${direction.fileName}`;
    const rows = filterDirectionRows(direction.rows, search, "all");
    const anya = direction.rows.find((row) => String(row["Уникальный код"]) === applicantId);

    directionView.innerHTML = `
      <div class="cards">
        ${metric("Основной выше", direction.mainAbove, `проходной ${fmt(direction.mainCutoff)}`)}
        ${metric("Без согласий в других", direction.mainWithoutOtherConsents, `проходной ${fmt(direction.mainWithoutOtherCutoff)}`)}
        ${metric("Высший выше", direction.highAbove, `проходной ${fmt(direction.highCutoff)}`)}
        ${metric("Аня", anya ? `№ ${fmt(anya["№"])}` : "не найдена", anya ? `балл ${fmt(anya["Сумма баллов с БВИ"])}` : "")}
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
          </div>
        </div>
        <div class="table-wrap">
          <table class="direction-table">
            <thead>
              <tr>${direction.columns.map((col) => `<th>${headerLabel(col)}</th>`).join("")}</tr>
            </thead>
            <tbody id="directionRows"></tbody>
          </table>
        </div>
      </div>
    `;

    const select = document.getElementById("rowFilter");
    select.addEventListener("change", () => paintDirectionRows(direction, search, select.value));
    paintDirectionRows(direction, search, "all", rows);
  }

  function filterDirectionRows(rows, search, filter) {
    return rows.filter((row) => {
      if (filter === "main" && !yes(row["МФТИ_full_расчет_основной_приоритет"])) return false;
      if (filter === "mainNoOther" && !yes(row["МФТИ_full_основной_без_согласий_в_других_вузах"])) return false;
      if (filter === "highest" && !yes(row["МФТИ_full_расчет_высший_проходной_приоритет"])) return false;
      if (filter === "consent" && !yes(row["Согласие_есть_в_наших_выгрузках"]) && !yes(row["Согласие МФТИ сайт"])) return false;
      if (filter === "bvi" && !yes(row["БВИ в этом конкурсе"])) return false;
      if (!search) return true;
      return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search));
    });
  }

  function paintDirectionRows(direction, search, filter, preparedRows) {
    const rows = preparedRows || filterDirectionRows(direction.rows, search, filter);
    const body = document.getElementById("directionRows");
    body.innerHTML = rows.map((row) => `
      <tr class="${String(row["Уникальный код"]) === applicantId ? "anya-row" : ""}">
        ${direction.columns.map((col) => {
          const value = row[col];
          if (["МФТИ_full_расчет_основной_приоритет", "МФТИ_full_основной_без_согласий_в_других_вузах", "МФТИ_full_расчет_высший_проходной_приоритет", "Согласие_МФТИ_госуслуги", "Согласие_МИФИ_госуслуги", "Согласие_Баумана_госуслуги", "БВИ в этом конкурсе"].includes(col)) {
            return `<td>${badge(value)}</td>`;
          }
          return `<td>${escapeHtml(value)}</td>`;
        }).join("")}
      </tr>
    `).join("") || `<tr><td colspan="${direction.columns.length}" class="empty">Ничего не найдено</td></tr>`;
  }

  globalSearch.addEventListener("input", render);
  window.addEventListener("hashchange", render);

  buildNav();
  render();
})();
