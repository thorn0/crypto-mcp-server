function toIsoDate(str) {
  const m = str.match(/^(\d{2}) (\w{3}) (\d{4})$/);
  if (!m) return str;
  const [, dd, mon, yyyy] = m;
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  return `${yyyy}-${months[mon] || "01"}-${dd}`;
}

function parseFarsideEtfTable(html) {
  const tableMatch = html.match(
    /<table[^>]*class=["'][^"']*\betf\b[^"']*["'][^>]*>([\s\S]+?)<\/table>/i,
  );
  if (!tableMatch) throw new Error('No <table class="etf"> found!');
  const tableHtml = tableMatch[0];

  const trRegex = /<tr[\s\S]*?>[\s\S]*?<\/tr>/gi;
  const trs = tableHtml.match(trRegex);
  if (!trs || trs.length < 5) throw new Error("Table too short or not found");

  const parseCells = (tr) => {
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells = [];
    let m;
    while ((m = cellRegex.exec(tr))) {
      let val = m[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(val);
    }
    return cells;
  };

  const [, tickerRow, , ...dataRows] = trs.map(parseCells);

  const headers = ["Date", ...tickerRow.slice(1, -1), "Total flow"];
  const headerMap = {};
  headers.forEach((h, i) => (headerMap[i] = h));

  const data = [];
  for (const row of dataRows) {
    if (row.length === headers.length && /^\d{2} \w{3} 20\d\d$/.test(row[0])) {
      const o = {};
      row.forEach((val, i) => {
        let v = val.replace(/,/g, "");
        if (i === 0) {
          v = toIsoDate(v);
        } else {
          if (/^\(.*\)$/.test(v)) v = "-" + v.slice(1, -1);
          if (v === "-" || v === "") v = null;
          else if (!isNaN(Number(v))) v = Number(v);
        }
        o[headerMap[i]] = v;
      });
      data.push(o);
    }
  }
  return { headers, data };
}

// WordPress REST API via static-extension path to bypass Cloudflare challenge
const FARSIDE_API_URL =
  "https://farside.co.uk/btc.css?rest_route=/wp/v2/pages/997";

export async function exportFarsideETF(params = {}) {
  const { writeToFile = false } = params;

  const res = await fetch(FARSIDE_API_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const { content } = await res.json();
  const html = content.rendered;

  const { headers, data } = parseFarsideEtfTable(html);
  if (!data.length) throw new Error("No valid ETF rows found!");

  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) =>
          row[h] == null ? "" : `"${String(row[h]).replace(/"/g, '""')}"`,
        )
        .join(","),
    ),
  ].join("\n");

  if (writeToFile) {
    const { writeFile } = await import("node:fs/promises");
    const now = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const file = `farside_btc_etf_${now}.csv`;
    await writeFile(file, csv);
    return { content: csv, file };
  }

  return { content: csv };
}

// CLI entry point
if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url.startsWith("file:")
) {
  const { resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisFile = resolve(fileURLToPath(import.meta.url));
  const entryFile = resolve(process.argv[1]);

  if (thisFile === entryFile) {
    try {
      const result = await exportFarsideETF({ writeToFile: true });
      console.log(`Exported ETF data to ${result.file}`);
    } catch (error) {
      console.error("Export failed:", error?.message || error);
      process.exitCode = 1;
    }
  }
}
