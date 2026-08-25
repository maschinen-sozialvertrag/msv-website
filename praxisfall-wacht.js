/*
  Maschinen-Sozialvertrag
  Öffentliche Praxisfall-Wacht
  ---------------------------------------------------------

  Datenquelle:
  /api/praxisfaelle

  Die Google-Sheets-Daten werden nicht mehr direkt
  vom Browser geladen.

  Datenfluss:

  Privater MSV-Master
        ↓
  öffentliche Webansicht
        ↓
  Cloudflare Pages Function
        ↓
  /api/praxisfaelle
        ↓
  diese JavaScript-Datei
*/


/* =========================================================
   GRUNDEINSTELLUNGEN
   ========================================================= */

const API_URL = "/api/praxisfaelle";

const PAGE_STEP = 12;

let allCases = [];
let filteredCases = [];
let visibleLimit = PAGE_STEP;


/* =========================================================
   DOM
   ========================================================= */

const els = {

  dataStatus:
    document.getElementById("dataStatus"),

  kpiTotal:
    document.getElementById("kpiTotal"),

  kpiVisible:
    document.getElementById("kpiVisible"),

  kpiMature:
    document.getElementById("kpiMature"),

  kpiTraining:
    document.getElementById("kpiTraining"),


  searchInput:
    document.getElementById("searchInput"),

  sortSelect:
    document.getElementById("sortSelect"),


  filterIndustry:
    document.getElementById("filterIndustry"),

  filterReadiness:
    document.getElementById("filterReadiness"),

  filterAutonomy:
    document.getElementById("filterAutonomy"),

  filterTraining:
    document.getElementById("filterTraining"),

  filterSource:
    document.getElementById("filterSource"),


  resetFilters:
    document.getElementById("resetFilters"),


  caseGrid:
    document.getElementById("caseGrid"),

  resultCount:
    document.getElementById("resultCount"),


  watchError:
    document.getElementById("watchError"),

  watchErrorText:
    document.getElementById("watchErrorText"),

  emptyState:
    document.getElementById("emptyState"),


  loadActions:
    document.getElementById("loadActions"),

  loadMore:
    document.getElementById("loadMore"),

  showAll:
    document.getElementById("showAll"),

};


/* =========================================================
   DATEN LADEN
   ========================================================= */

async function loadPublishedCases() {

  try {

    setLoadingState();


    /* -----------------------------------------------------
       API abrufen
       ----------------------------------------------------- */

    const response = await fetch(
      API_URL,
      {
        headers: {
          "Accept": "application/json"
        }
      }
    );


    /* -----------------------------------------------------
       HTTP-Fehler
       ----------------------------------------------------- */

    if (!response.ok) {

      throw new Error(
        `Die Praxisfall-API antwortete mit HTTP ${response.status}.`
      );

    }


    /* -----------------------------------------------------
       JSON lesen
       ----------------------------------------------------- */

    const data = await response.json();


    /* -----------------------------------------------------
       API-Fehler
       ----------------------------------------------------- */

    if (!data || data.ok !== true) {

      throw new Error(
        data?.detail ||
        data?.error ||
        "Die Praxisfall-API hat keine gültigen Daten geliefert."
      );

    }


    /* -----------------------------------------------------
       Fälle prüfen
       ----------------------------------------------------- */

    if (!Array.isArray(data.cases)) {

      throw new Error(
        "Die Praxisfall-API enthält kein gültiges Fall-Array."
      );

    }


    allCases =
      data.cases
        .filter(item =>
          item &&
          /^F\d+$/i.test(
            String(item.id || "")
          )
        );


    if (!allCases.length) {

      throw new Error(
        "Die Praxisfall-API enthält keine lesbaren Praxisfälle."
      );

    }


    /* -----------------------------------------------------
       Oberfläche vorbereiten
       ----------------------------------------------------- */

    populateFilters();

    applyFilters();


    /* -----------------------------------------------------
       Erfolgsstatus
       ----------------------------------------------------- */

    els.dataStatus.textContent =
      `${allCases.length} Fälle live geladen`;

    els.dataStatus.classList.remove(
      "is-error"
    );

    els.dataStatus.classList.add(
      "is-live"
    );


    if (els.watchError) {
      els.watchError.hidden = true;
    }


  } catch (error) {

    showLoadError(
      error instanceof Error
        ? error.message
        : String(error)
    );

  }

}


/* =========================================================
   LADESTATUS
   ========================================================= */

function setLoadingState() {

  if (!els.dataStatus) {
    return;
  }

  els.dataStatus.textContent =
    "Live-Daten werden geladen …";

  els.dataStatus.classList.remove(
    "is-error",
    "is-live"
  );

}


/* =========================================================
   FILTER AUFBAUEN
   ========================================================= */

function populateFilters() {

  fillSelect(
    els.filterIndustry,
    uniqueValues("industry")
  );

  fillSelect(
    els.filterReadiness,
    uniqueValues("readiness")
  );

  fillSelect(
    els.filterAutonomy,
    uniqueValues("autonomy")
  );

  fillSelect(
    els.filterTraining,
    uniqueValues("training")
  );

  fillSelect(
    els.filterSource,
    uniqueValues("sourceStatus")
  );

}


/* =========================================================
   EINDEUTIGE FILTERWERTE
   ========================================================= */

function uniqueValues(key) {

  return [
    ...new Set(
      allCases
        .map(item =>
          String(
            item[key] || ""
          ).trim()
        )
        .filter(Boolean)
    )
  ]
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          "de"
        )
    );

}


/* =========================================================
   SELECT-FELDER BEFÜLLEN
   ========================================================= */

function fillSelect(
  select,
  values
) {

  if (!select) {
    return;
  }


  const firstOption =
    select.options[0]
      ? select.options[0].cloneNode(true)
      : null;


  select.innerHTML = "";


  if (firstOption) {
    select.appendChild(firstOption);
  }


  values.forEach(value => {

    const option =
      document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.appendChild(option);

  });

}


/* =========================================================
   FILTER ANWENDEN
   ========================================================= */

function applyFilters() {

  const search =
    normalize(
      els.searchInput?.value
    );


  const industry =
    els.filterIndustry?.value || "";

  const readiness =
    els.filterReadiness?.value || "";

  const autonomy =
    els.filterAutonomy?.value || "";

  const training =
    els.filterTraining?.value || "";

  const source =
    els.filterSource?.value || "";


  filteredCases =
    allCases.filter(item => {


      const searchable =
        normalize(
          [
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
          ].join(" ")
        );


      return (

        (
          !search ||
          searchable.includes(search)
        )

        &&

        (
          !industry ||
          item.industry === industry
        )

        &&

        (
          !readiness ||
          item.readiness === readiness
        )

        &&

        (
          !autonomy ||
          item.autonomy === autonomy
        )

        &&

        (
          !training ||
          item.training === training
        )

        &&

        (
          !source ||
          item.sourceStatus === source
        )

      );

    });


  sortCases(
    filteredCases,
    els.sortSelect?.value
  );


  visibleLimit = PAGE_STEP;


  render();

}


/* =========================================================
   SORTIERUNG
   ========================================================= */

function sortCases(
  cases,
  mode
) {

  cases.sort(
    (a, b) => {


      /* Älteste ID zuerst */

      if (mode === "id-asc") {

        return (
          numericId(a.id) -
          numericId(b.id)
        );

      }


      /* Unternehmen A–Z */

      if (mode === "company-asc") {

        const nameA =
          a.company ||
          a.caseName ||
          "";

        const nameB =
          b.company ||
          b.caseName ||
          "";


        return nameA.localeCompare(
          nameB,
          "de"
        );

      }


      /* Standard:
         neueste ID zuerst
      */

      return (
        numericId(b.id) -
        numericId(a.id)
      );

    }
  );

}


/* =========================================================
   FALL-ID → ZAHL
   ========================================================= */

function numericId(id) {

  const match =
    String(id || "")
      .match(/\d+/);


  return match
    ? Number(match[0])
    : 0;

}


/* =========================================================
   TEXT NORMALISIEREN
   ========================================================= */

function normalize(value) {

  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );

}


/* =========================================================
   RENDERN
   ========================================================= */

function render() {

  if (!els.caseGrid) {
    return;
  }


  els.caseGrid.innerHTML = "";


  const visibleCases =
    filteredCases.slice(
      0,
      visibleLimit
    );


  visibleCases.forEach(item => {

    els.caseGrid.appendChild(
      createCaseCard(item)
    );

  });


  /* -------------------------------------------------------
     KPI
     ------------------------------------------------------- */

  if (els.kpiTotal) {

    els.kpiTotal.textContent =
      allCases.length;

  }


  if (els.kpiVisible) {

    els.kpiVisible.textContent =
      filteredCases.length;

  }


  if (els.kpiMature) {

    els.kpiMature.textContent =
      allCases.filter(item =>

        [
          "regulärer Dauerbetrieb",
          "Skalierung"
        ].includes(
          String(
            item.readiness || ""
          ).trim()
        )

      ).length;

  }


  if (els.kpiTraining) {

    els.kpiTraining.textContent =
      allCases.filter(item =>

        normalize(
          item.training
        ) === "ja"

      ).length;

  }


  /* -------------------------------------------------------
     Ergebnisanzahl
     ------------------------------------------------------- */

  if (els.resultCount) {

    els.resultCount.textContent =
      `${filteredCases.length} von ${allCases.length} Fällen`;

  }


  /* -------------------------------------------------------
     Leerzustand
     ------------------------------------------------------- */

  if (els.emptyState) {

    els.emptyState.hidden =
      filteredCases.length !== 0;

  }


  /* -------------------------------------------------------
     Ladebuttons
     ------------------------------------------------------- */

  const moreAvailable =
    visibleLimit <
    filteredCases.length;


  if (els.loadActions) {

    els.loadActions.hidden =
      !moreAvailable;

  }


  if (
    moreAvailable &&
    els.loadMore
  ) {

    const remaining =
      filteredCases.length -
      visibleLimit;


    els.loadMore.textContent =
      `Weitere ${Math.min(
        PAGE_STEP,
        remaining
      )} anzeigen`;

  }

}


/* =========================================================
   PRAXISFALL-KARTE
   ========================================================= */

function createCaseCard(item) {

  const card =
    document.createElement("article");


  card.className =
    "public-case-card";


  /* -------------------------------------------------------
     Chips
     ------------------------------------------------------- */

  const chips = [

    item.industry &&
      chip(
        item.industry
      ),

    item.location &&
      chip(
        item.location
      ),

    item.readiness &&
      chip(
        `Einsatz: ${item.readiness}`,
        true
      ),

    item.autonomy &&
      chip(
        `Autonomie: ${item.autonomy}`
      ),

    item.training &&
      chip(
        `Trainingswissen: ${item.training}`
      ),

    item.employment &&
      chip(
        `Beschäftigung: ${item.employment}`
      ),

    item.topic &&
      chip(
        item.topic,
        true
      ),

  ]
    .filter(Boolean)
    .join("");


  /* -------------------------------------------------------
     Quellenlinks
     ------------------------------------------------------- */

  const links = [

    safeLink(
      item.source1,
      "Quelle 1 öffnen",
      false
    ),

    safeLink(
      item.source2,
      "Quelle 2 öffnen",
      true
    ),

  ]
    .filter(Boolean)
    .join("");


  /* -------------------------------------------------------
     HTML
     ------------------------------------------------------- */

  card.innerHTML = `

    <div class="case-topline">

      <span class="case-id">
        ${escapeHtml(
          item.id
        )}
      </span>


      <span
        class="case-source-status"
        title="Quellenstatus"
      >
        ${escapeHtml(
          item.sourceStatus || "–"
        )}
      </span>

    </div>


    <p class="case-company">
      ${escapeHtml(
        item.company || ""
      )}
    </p>


    <h3>
      ${escapeHtml(
        item.caseName ||
        item.company ||
        item.id
      )}
    </h3>


    <div class="case-chips">
      ${chips}
    </div>


    <p class="case-description">
      ${escapeHtml(
        item.description ||
        "Kurzbeschreibung noch offen."
      )}
    </p>


    <p class="case-question">
      ${escapeHtml(
        item.question ||
        "MSV-Leitfrage noch offen."
      )}
    </p>


    <div class="case-links">

      ${
        links ||
        "<span class='case-chip'>Quellenlink noch offen</span>"
      }

    </div>

  `;


  return card;

}


/* =========================================================
   CHIP
   ========================================================= */

function chip(
  text,
  orange = false
) {

  return `

    <span
      class="case-chip ${orange ? "is-orange" : ""}"
    >
      ${escapeHtml(text)}
    </span>

  `;

}


/* =========================================================
   QUELLENLINK
   ========================================================= */

function safeLink(
  url,
  label,
  secondary
) {

  if (!url) {
    return "";
  }


  try {

    const parsed =
      new URL(url);


    if (
      ![
        "http:",
        "https:"
      ].includes(
        parsed.protocol
      )
    ) {

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


/* =========================================================
   HTML ESCAPEN
   ========================================================= */

function escapeHtml(value) {

  return String(value || "")

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   FEHLER
   ========================================================= */

function showLoadError(message) {

  if (els.dataStatus) {

    els.dataStatus.textContent =
      "Datenquelle nicht verbunden";


    els.dataStatus.classList.remove(
      "is-live"
    );


    els.dataStatus.classList.add(
      "is-error"
    );

  }


  if (els.watchError) {

    els.watchError.hidden = false;

  }


  if (els.watchErrorText) {

    els.watchErrorText.textContent =
      message;

  }


  if (els.kpiTotal) {
    els.kpiTotal.textContent = "–";
  }

  if (els.kpiVisible) {
    els.kpiVisible.textContent = "–";
  }

  if (els.kpiMature) {
    els.kpiMature.textContent = "–";
  }

  if (els.kpiTraining) {
    els.kpiTraining.textContent = "–";
  }


  if (els.loadActions) {

    els.loadActions.hidden = true;

  }

}


/* =========================================================
   EVENTS
   ========================================================= */

[
  els.filterIndustry,
  els.filterReadiness,
  els.filterAutonomy,
  els.filterTraining,
  els.filterSource,
  els.sortSelect
]

  .filter(Boolean)

  .forEach(element => {

    element.addEventListener(
      "change",
      applyFilters
    );

  });


/* Suche */

if (els.searchInput) {

  els.searchInput.addEventListener(
    "input",
    applyFilters
  );

}


/* Filter zurücksetzen */

if (els.resetFilters) {

  els.resetFilters.addEventListener(
    "click",
    () => {

      if (els.searchInput) {
        els.searchInput.value = "";
      }

      if (els.filterIndustry) {
        els.filterIndustry.value = "";
      }

      if (els.filterReadiness) {
        els.filterReadiness.value = "";
      }

      if (els.filterAutonomy) {
        els.filterAutonomy.value = "";
      }

      if (els.filterTraining) {
        els.filterTraining.value = "";
      }

      if (els.filterSource) {
        els.filterSource.value = "";
      }

      if (els.sortSelect) {
        els.sortSelect.value =
          "id-desc";
      }


      applyFilters();

    }
  );

}


/* Weitere anzeigen */

if (els.loadMore) {

  els.loadMore.addEventListener(
    "click",
    () => {

      visibleLimit +=
        PAGE_STEP;

      render();

    }
  );

}


/* Alle anzeigen */

if (els.showAll) {

  els.showAll.addEventListener(
    "click",
    () => {

      visibleLimit =
        filteredCases.length;

      render();

    }
  );

}


/* =========================================================
   START
   ========================================================= */

loadPublishedCases();
