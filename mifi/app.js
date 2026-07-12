(function () {
  const data = window.MIFI_DATA;
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

  function metric(label, value, note) {
    return `
      <div class="metric">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(value)}</div>
        <div class="metric-note">${escapeHtml(note || "")}</div>
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
        ${metric("Направлений", data.directions.length, "выгрузки Госуслуг")}
        ${metric("Строк в списках", data.totalRows, "обогащенные CSV")}
        ${metric("Мин. основной без чужих", bestMain ? bestMain.mainCutoff : "", bestMain ? bestMain.direction : "")}
        ${metric("Мин. высший проходной", bestHigh ? bestHigh.highCutoff : "", bestHigh ? bestHigh.direction : "")}
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
                <th>Аня №</th>
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
                  ${scoreCell(row.mainCutoff)}
                  <td>${fmt(row.highAbove)}</td>
                  ${scoreCell(row.highCutoff)}
                  <td>${fmt(row.anyaRank)}</td>
                  <td>${fmt(row.anyaScore)}</td>
                  <td>${escapeHtml(row.anyaStatus || "")}</td>
                </tr>
              `).join("") || `<tr><td colspan="10" class="empty">Ничего не найдено</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderDirection(direction, search) {
    pageTitle.textContent = direction.shortName;
    pageSubtitle.textContent = `Приоритет ${fmt(direction.priority)} · мест ${fmt(direction.places)} · файл ${direction.fileName}`;
    const anya = direction.rows.find((row) => String(row["ID участника"]) === applicantId);
    const priorities = priorityOptions(direction.rows);

    directionView.innerHTML = `
      <div class="cards">
        ${metric("Основной выше", direction.mainAbove, `проходной ${fmt(direction.mainCutoff)}`)}
        ${metric("Без согласий в других", direction.mainWithoutOtherConsents, `проходной ${fmt(direction.mainWithoutOtherCutoff)}`)}
        ${metric("Высший выше", direction.highAbove, `проходной ${fmt(direction.highCutoff)}`)}
        ${metric("Аня", anya ? `№ ${fmt(anya["Порядковый номер"])}` : "не найдена", anya ? `балл ${fmt(anya["Сумма баллов"])}` : "")}
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

    const select = document.getElementById("rowFilter");
    const prioritySelect = document.getElementById("priorityFilter");
    const repaint = () => paintDirectionRows(direction, search, select.value, prioritySelect.value);
    select.addEventListener("change", repaint);
    prioritySelect.addEventListener("change", repaint);
    repaint();
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
      <tr class="${String(row["ID участника"]) === applicantId ? "anya-row" : ""}">
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
