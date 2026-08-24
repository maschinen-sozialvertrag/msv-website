/*
  MSV-Praxisfall-Wacht
  ---------------------------------------------------------
  WICHTIG:
  Hier nur den veröffentlichten Link des Tabellenblatts
  "Webansicht" eintragen – NICHT den privaten Master-Link.

  Google Sheets:
  Datei → Freigeben → Im Web veröffentlichen
  → nur "Webansicht" auswählen
  → veröffentlichen
  → den pubhtml-Link unten eintragen.
*/

const PUBLISHED_WEBANSICHT_URL =
https://docs.google.com/spreadsheets/d/e/2PACX-1vR5Hm1NjskvrZlwtiruwr3hA_xHZqodSvlunpWPMOS37rIqJb_56chjsbV6-7tUZQDzhB8J8B-iAquk/pubhtml?gid=1611987831&single=true";

const PAGE_STEP = 12;

let allCases = [];
let filteredCases = [];
let visibleLimit = PAGE_STEP;


/* ---------------------------------------------------------
   DOM
--------------------------------------------------------- */

const els = {
  dataStatus: document.getElementById("dataStatus"),

  kpiTotal: document.getElementById("kpiTotal"),
  kpiVisible: document.getElementById("kpiVisible"),
  kpiMature: document.getElementById("kpiMature"),
  kpiTraining: document.getElementById("kpiTraining"),

  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),

  filterIndustry: document.getElementById("filterIndustry"),
  filterReadiness: document.getElementById("filterReadiness"),
  filterAutonomy: document.getElementById("filterAutonomy"),
  filterTraining: document.getElementById("filterTraining"),
  filterSource: document.getElementById("filterSource"),

  resetFilters: document.getElementById("resetFilters"),

  caseGrid: document.getElementById("caseGrid"),
  resultCount: document.getElementById("resultCount"),

  watchError: document.getElementById("watchError"),
  watchErrorText: document.getElementById("watchErrorText"),
  emptyState: document.getElementById("emptyState"),

  loadActions: document.getElementById("loadActions"),
  loadMore: document.getElementById("loadMore"),
  showAll: document.getElementById("showAll"),
};


/* ---------------------------------------------------------
   Google-Sheets-Link → GViz-Abfrage
--------------------------------------------------------- */

function buildGvizUrl(publishedUrl) {
  if (!publishedUrl || publishedUrl.includes("HIER_DEN_")) {
    throw new Error(
      "Der veröffentlichte Link zum Tabellenblatt „Webansicht“ wurde noch nicht in praxisfall-wacht.js eingetragen."
    );
  }

  const url = new URL(publishedUrl);

  const match = url.pathname.match(
    /\/spreadsheets\/d\/e\/([^/]+)\/pubhtml/
  );

  if (!match) {
    throw new Error(
      "Bitte den Link aus „Im Web veröffentlichen“ verwenden. Erwartet wird ein Google-Link mit /spreadsheets/d/e/.../pubhtml."
    );
  }

  const publicationId = match[1];
  const gid = url.searchParams.get("gid");

  if (!gid) {
    throw new Error(
      "Im veröffentlichten Google-Sheets-Link fehlt die Tabellenblatt-ID (gid). Bitte wirklich nur „Webansicht“ veröffentlichen."
    );
  }

  return `https://docs.google.com/spreadsheets/d/e/${publicationId}/gviz/tq?gid=${gid}&headers=1`;
}


/* ---------------------------------------------------------
   Daten laden
--------------------------------------------------------- */

function loadPublishedSheet() {
  let queryUrl;

  try {
    queryUrl = buildGvizUrl(PUBLISHED_WEBANSICHT_URL);
  } catch (error) {
    showLoadError(error.message);
    return;
  }

  els.dataStatus.textContent = "Live-Daten werden geladen …";

  google.charts.load("current");

  google.charts.setOnLoadCallback(() => {
    const query = new google.visualization.Query(queryUrl);

    query.send((response) => {
      if (response.isError()) {
        showLoadError(
          `Google Sheets meldet: ${response.getMessage()}`
        );
        return;
      }

      try {
        const table = response.getDataTable();
        allCases = dataTableToCases(table);

        if (!allCases.length) {
          throw new Error(
            "Das veröffentlichte Tabellenblatt enthält keine lesbaren Praxisfälle."
          );
        }

        populateFilters();
        applyFilters();

        els.dataStatus.textContent =
          `${allCases.length} Fälle live aus Google Sheets geladen`;
        els.dataStatus.classList.add("is-live");

      } catch (error) {
        showLoadError(error.message);
      }
    });
  });
}


function dataTableToCases(table) {
  const labels = [];

  for (let c = 0; c < table.getNumberOfColumns(); c++) {
    labels.push(table.getColumnLabel(c).trim());
  }

  const result = [];

  for (let r = 0; r < table.getNumberOfRows(); r++) {
    const obj = {};

    labels.forEach((label, c) => {
      const value = table.getValue(r, c);
      obj[label] = value == null ? "" : String(value).trim();
    });

    if (!obj["ID"]) {
      continue;
    }

    result.push({
      id: obj["ID"],
      company: obj["Unternehmen / Institution"],
      caseName: obj["Praxisfall"],
      industry: obj["Branche"],
      location: obj["Ort"],
      readiness: obj["Einsatzreife"],
      autonomy: obj["Autonomiegrad"],
      training: obj["Trainingswissen"],
      employment: obj["Beschäftigungswirkung"],
      topic: obj["MSV-Thema"],
      sourceStatus: obj["Quellenstatus"],
      description: obj["Kurzbeschreibung"],
      question: obj["MSV-Leitfrage"],
      source1: obj["Quelle 1"],
      source2: obj["Quelle 2"],
    });
  }

  return result;
}


/* ---------------------------------------------------------
   Filter
--------------------------------------------------------- */

function populateFilters() {
  fillSelect(els.filterIndustry, uniqueValues("industry"));
  fillSelect(els.filterReadiness, uniqueValues("readiness"));
  fillSelect(els.filterAutonomy, uniqueValues("autonomy"));
  fillSelect(els.filterTraining, uniqueValues("training"));
  fillSelect(els.filterSource, uniqueValues("sourceStatus"));
}


function uniqueValues(key) {
  return [...new Set(
    allCases
      .map(item => item[key])
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "de"));
}


function fillSelect(select, values) {
  const existingFirst = select.options[0];
  select.innerHTML = "";
  select.appendChild(existingFirst);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}


function applyFilters() {
  const search = normalize(els.searchInput.value);
  const industry = els.filterIndustry.value;
  const readiness = els.filterReadiness.value;
  const autonomy = els.filterAutonomy.value;
  const training = els.filterTraining.value;
  const source = els.filterSource.value;

  filteredCases = allCases.filter(item => {
    const searchable = normalize([
      item.id,
      item.company,
      item.caseName,
      item.industry,
      item.location,
      item.readiness,
      item.autonomy,
      item.training,
      item.employment,
      item.topic,
      item.sourceStatus,
      item.description,
      item.question
    ].join(" "));

    return (
      (!search || searchable.includes(search)) &&
      (!industry || item.industry === industry) &&
      (!readiness || item.readiness === readiness) &&
      (!autonomy || item.autonomy === autonomy) &&
      (!training || item.training === training) &&
      (!source || item.sourceStatus === source)
    );
  });

  sortCases(filteredCases, els.sortSelect.value);

  visibleLimit = PAGE_STEP;

  render();
}


function sortCases(cases, mode) {
  cases.sort((a, b) => {
    if (mode === "id-asc") {
      return numericId(a.id) - numericId(b.id);
    }

    if (mode === "company-asc") {
      return (a.company || a.caseName)
        .localeCompare((b.company || b.caseName), "de");
    }

    return numericId(b.id) - numericId(a.id);
  });
}


function numericId(id) {
  const match = String(id).match(/\d+/);
  return match ? Number(match[0]) : 0;
}


function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


/* ---------------------------------------------------------
   Rendern
--------------------------------------------------------- */

function render() {
  els.caseGrid.innerHTML = "";

  const visibleCases = filteredCases.slice(0, visibleLimit);

  visibleCases.forEach(item => {
    els.caseGrid.appendChild(createCaseCard(item));
  });

  els.kpiTotal.textContent = allCases.length;
  els.kpiVisible.textContent = filteredCases.length;

  els.kpiMature.textContent = allCases.filter(item =>
    ["regulärer Dauerbetrieb", "Skalierung"].includes(item.readiness)
  ).length;

  els.kpiTraining.textContent = allCases.filter(item =>
    item.training === "ja"
  ).length;

  els.resultCount.textContent =
    `${filteredCases.length} von ${allCases.length} Fällen`;

  els.emptyState.hidden = filteredCases.length !== 0;

  const moreAvailable = visibleLimit < filteredCases.length;
  els.loadActions.hidden = !moreAvailable;

  if (moreAvailable) {
    const remaining = filteredCases.length - visibleLimit;
    els.loadMore.textContent =
      `Weitere ${Math.min(PAGE_STEP, remaining)} anzeigen`;
  }
}


function createCaseCard(item) {
  const card = document.createElement("article");
  card.className = "public-case-card";

  const chips = [
    item.industry && chip(item.industry),
    item.location && chip(item.location),
    item.readiness && chip(`Einsatz: ${item.readiness}`, true),
    item.autonomy && chip(`Autonomie: ${item.autonomy}`),
    item.training && chip(`Trainingswissen: ${item.training}`),
    item.employment && chip(`Beschäftigung: ${item.employment}`),
    item.topic && chip(item.topic, true),
  ].filter(Boolean).join("");

  const links = [
    safeLink(item.source1, "Quelle 1 öffnen", false),
    safeLink(item.source2, "Quelle 2 öffnen", true),
  ].filter(Boolean).join("");

  card.innerHTML = `
    <div class="case-topline">
      <span class="case-id">${escapeHtml(item.id)}</span>
      <span class="case-source-status" title="Quellenstatus">
        ${escapeHtml(item.sourceStatus || "–")}
      </span>
    </div>

    <p class="case-company">${escapeHtml(item.company || "")}</p>

    <h3>${escapeHtml(item.caseName || item.company || item.id)}</h3>

    <div class="case-chips">
      ${chips}
    </div>

    <p class="case-description">
      ${escapeHtml(item.description || "Kurzbeschreibung noch offen.")}
    </p>

    <p class="case-question">
      ${escapeHtml(item.question || "MSV-Leitfrage noch offen.")}
    </p>

    <div class="case-links">
      ${links || "<span class='case-chip'>Quellenlink noch offen</span>"}
    </div>
  `;

  return card;
}


function chip(text, orange = false) {
  return `
    <span class="case-chip ${orange ? "is-orange" : ""}">
      ${escapeHtml(text)}
    </span>
  `;
}


function safeLink(url, label, secondary) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return `
      <a
        class="case-link ${secondary ? "secondary" : ""}"
        href="${escapeHtml(parsed.href)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHtml(label)} →
      </a>
    `;

  } catch {
    return "";
  }
}


function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ---------------------------------------------------------
   Fehler
--------------------------------------------------------- */

function showLoadError(message) {
  els.dataStatus.textContent = "Datenquelle nicht verbunden";
  els.dataStatus.classList.add("is-error");

  els.watchError.hidden = false;
  els.watchErrorText.textContent = message;

  els.kpiTotal.textContent = "–";
  els.kpiVisible.textContent = "–";
  els.kpiMature.textContent = "–";
  els.kpiTraining.textContent = "–";

  els.loadActions.hidden = true;
}


/* ---------------------------------------------------------
   Events
--------------------------------------------------------- */

[
  els.filterIndustry,
  els.filterReadiness,
  els.filterAutonomy,
  els.filterTraining,
  els.filterSource,
  els.sortSelect,
].forEach(element => {
  element.addEventListener("change", applyFilters);
});

els.searchInput.addEventListener("input", applyFilters);

els.resetFilters.addEventListener("click", () => {
  els.searchInput.value = "";
  els.filterIndustry.value = "";
  els.filterReadiness.value = "";
  els.filterAutonomy.value = "";
  els.filterTraining.value = "";
  els.filterSource.value = "";
  els.sortSelect.value = "id-desc";

  applyFilters();
});

els.loadMore.addEventListener("click", () => {
  visibleLimit += PAGE_STEP;
  render();
});

els.showAll.addEventListener("click", () => {
  visibleLimit = filteredCases.length;
  render();
});


/* ---------------------------------------------------------
   Start
--------------------------------------------------------- */

loadPublishedSheet();
