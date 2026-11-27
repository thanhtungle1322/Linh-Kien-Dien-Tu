/**
 * Inventory Analytics & Valuation Service
 * Pure domain logic for ElectroHub electronic components warehouse reporting.
 */

const DEFAULT_REORDER_THRESHOLD = 25;
const MAX_REORDER_THRESHOLD = 10000;

/**
 * Validate and clamp a numeric threshold parameter.
 * @param {unknown} rawValue
 * @param {number} fallback
 * @returns {number}
 */
function validateThreshold(rawValue, fallback = DEFAULT_REORDER_THRESHOLD) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_REORDER_THRESHOLD) {
    return fallback;
  }
  return parsed;
}

/**
 * Compute overall warehouse valuation metrics for a product list.
 * @param {Array<object>} products
 * @returns {object}
 */
function calculateValuation(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      totalSkus: 0,
      totalUnits: 0,
      totalValue: 0,
      averageUnitPrice: 0,
      highestValueItem: null,
      lowestStockItem: null
    };
  }

  let totalUnits = 0;
  let totalValue = 0;
  let priceSum = 0;
  let highestValueItem = null;
  let highestLineValue = -1;
  let lowestStockItem = null;
  let lowestStock = Infinity;

  for (const item of products) {
    const price = Number(item.price) || 0;
    const stock = Number(item.stock) || 0;
    const lineValue = price * stock;

    totalUnits += stock;
    totalValue += lineValue;
    priceSum += price;

    if (lineValue > highestLineValue) {
      highestLineValue = lineValue;
      highestValueItem = {
        id: item.id,
        name: item.name,
        category: item.category,
        lineValue
      };
    }

    if (stock < lowestStock) {
      lowestStock = stock;
      lowestStockItem = {
        id: item.id,
        name: item.name,
        category: item.category,
        stock
      };
    }
  }

  return {
    totalSkus: products.length,
    totalUnits,
    totalValue,
    averageUnitPrice: Math.round(priceSum / products.length),
    highestValueItem,
    lowestStockItem
  };
}

/**
 * Group inventory metrics by component category.
 * @param {Array<object>} products
 * @returns {Array<object>}
 */
function groupByCategory(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const buckets = new Map();

  for (const item of products) {
    const category = item.category || "Uncategorized";
    const price = Number(item.price) || 0;
    const stock = Number(item.stock) || 0;
    const rating = Number(item.rating) || 0;

    if (!buckets.has(category)) {
      buckets.set(category, {
        category,
        skuCount: 0,
        totalUnits: 0,
        totalValue: 0,
        ratingSum: 0
      });
    }

    const entry = buckets.get(category);
    entry.skuCount += 1;
    entry.totalUnits += stock;
    entry.totalValue += price * stock;
    entry.ratingSum += rating;
  }

  return Array.from(buckets.values())
    .map((entry) => ({
      category: entry.category,
      skuCount: entry.skuCount,
      totalUnits: entry.totalUnits,
      totalValue: entry.totalValue,
      averageRating: Number((entry.ratingSum / entry.skuCount).toFixed(2))
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Perform ABC inventory classification based on cumulative stock value.
 * Class A: top 80% of value, Class B: next 15%, Class C: remaining 5%.
 * @param {Array<object>} products
 * @returns {Array<object>}
 */
function computeAbcClassification(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const enriched = products
    .map((item) => {
      const price = Number(item.price) || 0;
      const stock = Number(item.stock) || 0;
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        price,
        stock,
        inventoryValue: price * stock
      };
    })
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  const grandTotal = enriched.reduce((sum, item) => sum + item.inventoryValue, 0);
  if (grandTotal <= 0) {
    return enriched.map((item) => ({
      ...item,
      valueSharePercent: 0,
      cumulativePercent: 0,
      abcClass: "C"
    }));
  }

  let runningTotal = 0;
  return enriched.map((item) => {
    runningTotal += item.inventoryValue;
    const valueSharePercent = Number(((item.inventoryValue / grandTotal) * 100).toFixed(2));
    const cumulativePercent = Number(((runningTotal / grandTotal) * 100).toFixed(2));

    let abcClass = "C";
    if (cumulativePercent <= 80) {
      abcClass = "A";
    } else if (cumulativePercent <= 95) {
      abcClass = "B";
    }

    return {
      ...item,
      valueSharePercent,
      cumulativePercent,
      abcClass
    };
  });
}

/**
 * Identify products below the stock reorder threshold and assign urgency.
 * @param {Array<object>} products
 * @param {number} threshold
 * @returns {Array<object>}
 */
function getReorderAlerts(products, threshold = DEFAULT_REORDER_THRESHOLD) {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const safeThreshold = validateThreshold(threshold, DEFAULT_REORDER_THRESHOLD);

  return products
    .filter((item) => (Number(item.stock) || 0) <= safeThreshold)
    .map((item) => {
      const stock = Number(item.stock) || 0;
      let urgency = "MEDIUM";
      if (stock <= Math.floor(safeThreshold * 0.25)) {
        urgency = "CRITICAL";
      } else if (stock <= Math.floor(safeThreshold * 0.6)) {
        urgency = "HIGH";
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        currentStock: stock,
        threshold: safeThreshold,
        suggestedOrderQty: Math.max(safeThreshold * 2 - stock, 10),
        urgency
      };
    })
    .sort((a, b) => a.currentStock - b.currentStock);
}

/**
 * Compute an aggregate warehouse health score (0-100) based on stock coverage.
 * @param {Array<object>} products
 * @returns {object}
 */
function calculateStockHealthScore(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { score: 0, status: "EMPTY", outOfStockCount: 0, lowStockCount: 0 };
  }

  let outOfStockCount = 0;
  let lowStockCount = 0;

  for (const item of products) {
    const stock = Number(item.stock) || 0;
    if (stock <= 0) {
      outOfStockCount += 1;
    } else if (stock <= DEFAULT_REORDER_THRESHOLD) {
      lowStockCount += 1;
    }
  }

  const penalty = outOfStockCount * 15 + lowStockCount * 5;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  let status = "HEALTHY";
  if (score < 50) {
    status = "CRITICAL";
  } else if (score < 80) {
    status = "WARNING";
  }

  return { score, status, outOfStockCount, lowStockCount };
}

/**
 * Escape a single CSV cell safely (including spreadsheet formula-injection protection).
 * @param {unknown} value
 * @returns {string}
 */
function escapeCsvCell(value) {
  let text = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Format product valuation list as RFC 4180 CSV text.
 * @param {Array<object>} products
 * @returns {string}
 */
function formatValuationCsv(products) {
  const header = ["ID", "Name", "Category", "Price", "Stock", "TotalValue", "Rating"].join(",");
  if (!Array.isArray(products) || products.length === 0) {
    return header;
  }

  const rows = products.map((item) => {
    const price = Number(item.price) || 0;
    const stock = Number(item.stock) || 0;
    return [
      escapeCsvCell(item.id),
      escapeCsvCell(item.name),
      escapeCsvCell(item.category),
      escapeCsvCell(price),
      escapeCsvCell(stock),
      escapeCsvCell(price * stock),
      escapeCsvCell(item.rating ?? "")
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

module.exports = {
  DEFAULT_REORDER_THRESHOLD,
  validateThreshold,
  calculateValuation,
  groupByCategory,
  computeAbcClassification,
  getReorderAlerts,
  calculateStockHealthScore,
  escapeCsvCell,
  formatValuationCsv
};
