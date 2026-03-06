const intervalToMs = {
  "1h": 60 * 60 * 1000,
  "15m": 15 * 60 * 1000,
};

function formatNum(val, digits = 4) {
  return parseFloat(val).toFixed(digits);
}
function formatTime(date) {
  return new Date(date).toISOString().replace(/:00\.000Z$/, "");
}

function calculateATR(klineData, periods) {
  const trueRanges = [];

  for (let i = 0; i < klineData.length; i++) {
    const high = parseFloat(klineData[i][2]);
    const low = parseFloat(klineData[i][3]);

    if (i === 0) {
      trueRanges.push(high - low);
    } else {
      const prevClose = parseFloat(klineData[i - 1][4]);
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );
      trueRanges.push(tr);
    }
  }

  const atrValues = [];
  if (trueRanges.length >= periods) {
    let sum = 0;
    for (let j = 0; j < periods; j++) sum += trueRanges[j];
    let prevATR = sum / periods;
    atrValues.push(prevATR);

    for (let i = periods; i < trueRanges.length; i++) {
      prevATR = (prevATR * (periods - 1) + trueRanges[i]) / periods;
      atrValues.push(prevATR);
    }
  }

  return atrValues;
}

export async function exportBinanceKlines(params = {}) {
  const {
    symbol = "BTCUSDT",
    interval = "15m",
    periodHours = 12,
    writeToFile = false,
  } = params;

  if (!intervalToMs[interval]) {
    throw new Error(
      `Unsupported interval: ${interval}. Supported: ${Object.keys(intervalToMs).join(", ")}`,
    );
  }

  const intervalMs = intervalToMs[interval];
  const now = Date.now();
  const startTime = now - periodHours * 60 * 60 * 1000;
  const limit = Math.floor((now - startTime) / intervalMs);

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&startTime=${startTime}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();

  const atr14Values = calculateATR(data, 14);

  const header = [
    "Time (UTC)",
    "Open (USDT)",
    "High (USDT)",
    "Low (USDT)",
    "Close (USDT)",
    "Volume (BTC)",
    `${interval}-ATR14`,
  ];

  const rows = data.map((d, i) =>
    [
      formatTime(d[0]),
      ...d.slice(1, 5).map((x) => formatNum(x, 2)),
      formatNum(d[5], 4),
      i < 14 ? "" : formatNum(atr14Values[i - 14], 2),
    ].join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  if (writeToFile) {
    const { writeFile } = await import("node:fs/promises");
    const nowIso = formatTime(now);
    const timestamp = nowIso.replace(/T/, "_").replace(/:/g, "-").slice(0, 16);
    const fromIso = formatTime(startTime).slice(0, 10);
    const toIso = formatTime(now).slice(0, 10);
    const file = `${symbol}__${interval}__${fromIso}_to_${toIso}__UTC_${timestamp}_with_${interval}-ATR14.csv`;
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
      const interval = process.argv[2] || "15m";
      const periodHours = Number.parseFloat(process.argv[3]) || 12;
      const result = await exportBinanceKlines({
        interval,
        periodHours,
        writeToFile: true,
      });
      console.log(
        `Saved ${interval} data for BTCUSDT (${periodHours}h) to ${result.file}`,
      );
    } catch (error) {
      console.error("Export failed:", error?.message || error);
      process.exitCode = 1;
    }
  }
}
