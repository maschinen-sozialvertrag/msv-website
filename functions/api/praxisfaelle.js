/*
  Maschinen-Sozialvertrag
  API für die öffentliche Praxisfall-Wacht
  ---------------------------------------------------------

  Route:
  /api/praxisfaelle

  Aufgabe:
  - öffentliche Google-Sheets-Webansicht serverseitig laden
  - CSV in strukturierte JSON-Daten umwandeln
  - nur öffentliche Felder ausgeben
  - Browser der Besucher greifen NICHT direkt auf
    Google Sheets / GViz zu

  Datenfluss:

  Privater MSV-Master
        ↓
  interne Webansicht
        ↓
  IMPORTRANGE
        ↓
  öffentliches Google Sheet
        ↓
  diese Cloudflare Pages Function
        ↓
  /api/praxisfaelle
        ↓
  praxisfall-wacht.js
*/


/* =========================================================
   ÖFFENTLICHE GOOGLE-SHEETS-DATENQUELLE
   ========================================================= */

const PUBLIC_SHEET_ID =
  "1C0Twg1jbKW-_XW_yNLP2IBvrwpZb0myuZAR_od0Oje0";

const PUBLIC_SHEET_GID =
  "1529330882";


const GOOGLE_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${PUBLIC_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${PUBLIC_SHEET_GID}`;


/*
  Cache-Dauer des serverseitigen Google-Abrufs.

  300 Sekunden = 5 Minuten.

  Änderungen im Master müssen deshalb nicht zwingend
  sekundengenau auf der öffentlichen Seite erscheinen.
*/

const GOOGLE_CACHE_TTL = 300;


/* =========================================================
   ERWARTETE ÖFFENTLICHE SPALTEN
   ========================================================= */

const REQUIRED_HEADERS = [
  "ID",
  "Unternehmen / Institution",
  "Praxisfall",
  "Branche",
  "Ort",
  "Einsatzreife",
  "Autonomiegrad",
  "Trainingswissen",
  "Beschäftigungswirkung",
  "MSV-Thema",
  "Quellenstatus",
  "Kurzbeschreibung",
  "MSV-Leitfrage",
  "Quelle 1",
  "Quelle 2",
];


/* =========================================================
   CLOUDFLARE PAGES FUNCTION
   ========================================================= */

export async function onRequestGet() {

  try {

    /* -----------------------------------------------------
       Google-Sheet serverseitig abrufen
       ----------------------------------------------------- */

    const googleResponse = await fetch(
      GOOGLE_CSV_URL,
      {
        headers: {
          "Accept":
            "text/csv,text/plain;q=0.9,*/*;q=0.1",
        },

        cf: {
          cacheEverything: true,
          cacheTtl: GOOGLE_CACHE_TTL,
        },
      }
    );


    /* -----------------------------------------------------
       HTTP-Fehler von Google abfangen
       ----------------------------------------------------- */

    if (!googleResponse.ok) {

      throw new Error(
        `Google Sheets antwortete mit HTTP ${googleResponse.status}.`
      );

    }


    /* -----------------------------------------------------
       CSV lesen
       ----------------------------------------------------- */

    const csvText =
      await googleResponse.text();


    if (!csvText.trim()) {

      throw new Error(
        "Google Sheets hat eine leere Datenquelle geliefert."
      );

    }


    /* -----------------------------------------------------
       CSV parsen
       ----------------------------------------------------- */

    const rows =
      parseCsv(csvText);


    if (rows.length < 2) {

      throw new Error(
        "Das öffentliche Tabellenblatt enthält keine Praxisfälle."
      );

    }


    /* -----------------------------------------------------
       Kopfzeile auslesen
       ----------------------------------------------------- */

    const headers =
      rows[0].map(header =>
        normalizeHeader(header)
      );


    /* -----------------------------------------------------
       Prüfen, ob alle erwarteten Spalten vorhanden sind
       ----------------------------------------------------- */

    const missingHeaders =
      REQUIRED_HEADERS.filter(
        required =>
          !headers.includes(required)
      );


    if (missingHeaders.length > 0) {

      throw new Error(
        "In der öffentlichen Webansicht fehlen folgende Spalten: " +
        missingHeaders.join(", ")
      );

    }


    /* -----------------------------------------------------
       Spaltenpositionen bestimmen
       ----------------------------------------------------- */

    const columnIndex = {};

    headers.forEach(
      (header, index) => {

        columnIndex[header] =
          index;

      }
    );


    /* -----------------------------------------------------
       Praxisfälle erzeugen
       ----------------------------------------------------- */

    const cases =
      rows
        .slice(1)

        .map(row => {

          return {

            id:
              getCell(
                row,
                columnIndex,
                "ID"
              ),

            company:
              getCell(
                row,
                columnIndex,
                "Unternehmen / Institution"
              ),

            caseName:
              getCell(
                row,
                columnIndex,
                "Praxisfall"
              ),

            industry:
              getCell(
                row,
                columnIndex,
                "Branche"
              ),

            location:
              getCell(
                row,
                columnIndex,
                "Ort"
              ),

            readiness:
              getCell(
                row,
                columnIndex,
                "Einsatzreife"
              ),

            autonomy:
              getCell(
                row,
                columnIndex,
                "Autonomiegrad"
              ),

            training:
              getCell(
                row,
                columnIndex,
                "Trainingswissen"
              ),

            employment:
              getCell(
                row,
                columnIndex,
                "Beschäftigungswirkung"
              ),

            topic:
              getCell(
                row,
                columnIndex,
                "MSV-Thema"
              ),

            sourceStatus:
              getCell(
                row,
                columnIndex,
                "Quellenstatus"
              ),

            description:
              getCell(
                row,
                columnIndex,
                "Kurzbeschreibung"
              ),

            question:
              getCell(
                row,
                columnIndex,
                "MSV-Leitfrage"
              ),

            source1:
              getCell(
                row,
                columnIndex,
                "Quelle 1"
              ),

            source2:
              getCell(
                row,
                columnIndex,
                "Quelle 2"
              ),

          };

        })


        /*
          Nur Zeilen mit einer echten Fall-ID behalten.
          Dadurch werden vorbereitete Leerzeilen ignoriert.
        */

        .filter(item =>
          /^F\d+$/i.test(item.id)
        );


    /* -----------------------------------------------------
       Keine Fälle gefunden
       ----------------------------------------------------- */

    if (!cases.length) {

      throw new Error(
        "In der öffentlichen Webansicht wurden keine gültigen Praxisfall-IDs gefunden."
      );

    }


    /* -----------------------------------------------------
       Nach numerischer Fall-ID sortieren
       ----------------------------------------------------- */

    cases.sort(
      (a, b) =>
        numericId(a.id) -
        numericId(b.id)
    );


    /* -----------------------------------------------------
       JSON-Antwort
       ----------------------------------------------------- */

    return jsonResponse(
      {
        ok: true,

        count:
          cases.length,

        fetchedAt:
          new Date().toISOString(),

        cases:
          cases,
      },

      200,

      {
        /*
          Browser darf die Antwort kurz zwischenspeichern.
          Die Praxisfall-Wacht muss nicht bei jedem Klick
          Google erneut abfragen.
        */

        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",

        /*
          API-Antwort soll nicht als eigenständige
          Suchmaschinen-Seite indexiert werden.
        */

        "X-Robots-Tag":
          "noindex, nofollow",

      }
    );


  } catch (error) {


    /* -----------------------------------------------------
       Fehlerantwort
       ----------------------------------------------------- */

    console.error(
      "MSV Praxisfall-Wacht API:",
      error
    );


    return jsonResponse(
      {
        ok: false,

        error:
          "Die Praxisfall-Daten konnten derzeit nicht geladen werden.",

        detail:
          error instanceof Error
            ? error.message
            : String(error),
      },

      502,

      {
        /*
          Fehler nicht lange cachen.
        */

        "Cache-Control":
          "no-store",

        "X-Robots-Tag":
          "noindex, nofollow",
      }
    );

  }

}


/* =========================================================
   CSV-PARSER
   ========================================================= */

/*
  Einfaches split(",") reicht NICHT.

  Google Sheets kann enthalten:
  - Kommas innerhalb von Texten
  - Anführungszeichen
  - Zeilenumbrüche innerhalb von Zellen
  - URLs
  - leere Felder

  Dieser Parser berücksichtigt die üblichen CSV-Regeln.
*/

function parseCsv(text) {

  const input =
    String(text || "")
      .replace(/^\uFEFF/, "");


  const rows = [];

  let row = [];
  let field = "";

  let insideQuotes = false;


  for (
    let i = 0;
    i < input.length;
    i++
  ) {

    const character =
      input[i];


    /* -----------------------------------------------------
       Anführungszeichen
       ----------------------------------------------------- */

    if (character === '"') {

      /*
        Zwei doppelte Anführungszeichen innerhalb
        eines gequoteten Feldes bedeuten ein
        tatsächliches Anführungszeichen.
      */

      if (
        insideQuotes &&
        input[i + 1] === '"'
      ) {

        field += '"';

        i++;

      } else {

        insideQuotes =
          !insideQuotes;

      }

      continue;

    }


    /* -----------------------------------------------------
       Komma außerhalb eines Textfeldes
       ----------------------------------------------------- */

    if (
      character === "," &&
      !insideQuotes
    ) {

      row.push(field);

      field = "";

      continue;

    }


    /* -----------------------------------------------------
       Zeilenende außerhalb eines Textfeldes
       ----------------------------------------------------- */

    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !insideQuotes
    ) {

      row.push(field);

      field = "";


      /*
        Vollständig leere Zeilen ignorieren.
      */

      if (
        row.some(cell =>
          String(cell).trim() !== ""
        )
      ) {

        rows.push(row);

      }


      row = [];


      /*
        Windows-Zeilenende \r\n:
        das \n direkt überspringen.
      */

      if (
        character === "\r" &&
        input[i + 1] === "\n"
      ) {

        i++;

      }

      continue;

    }


    /* -----------------------------------------------------
       Normales Zeichen
       ----------------------------------------------------- */

    field += character;

  }


  /* -------------------------------------------------------
     Letzte Zeile verarbeiten
     ------------------------------------------------------- */

  if (
    field.length > 0 ||
    row.length > 0
  ) {

    row.push(field);


    if (
      row.some(cell =>
        String(cell).trim() !== ""
      )
    ) {

      rows.push(row);

    }

  }


  return rows;

}


/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */


/*
  Header bereinigen.
*/

function normalizeHeader(value) {

  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();

}


/*
  Zellenwert anhand des Spaltennamens auslesen.
*/

function getCell(
  row,
  columnIndex,
  header
) {

  const index =
    columnIndex[header];


  if (
    index === undefined ||
    index === null
  ) {

    return "";

  }


  const value =
    row[index];


  return value == null
    ? ""
    : String(value).trim();

}


/*
  F001 → 1
  F075 → 75
*/

function numericId(id) {

  const match =
    String(id || "")
      .match(/\d+/);


  return match
    ? Number(match[0])
    : 0;

}


/* =========================================================
   JSON-ANTWORT
   ========================================================= */

function jsonResponse(
  data,
  status = 200,
  extraHeaders = {}
) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),

    {
      status,

      headers: {

        "Content-Type":
          "application/json; charset=utf-8",

        ...extraHeaders,

      },
    }
  );

}
