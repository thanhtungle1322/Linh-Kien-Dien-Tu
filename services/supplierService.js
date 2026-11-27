/**
 * Supplier & Procurement Domain Service
 * Handles vendor catalog, MOQ pricing tiers, landed cost calculation,
 * SLA reliability scoring, and purchase order formatting for ElectroHub.
 */

const SUPPLIER_CATALOG = [
  {
    code: "SUP-ESPRESSIF-VN",
    name: "Espressif Authorized Distributor VN",
    country: "VN",
    categories: ["MCU", "Wi-Fi / BLE Modules", "Development Boards"],
    leadTimeDays: 3,
    onTimeRate: 0.96,
    defectRate: 0.004,
    minOrderQuantity: 10,
    currency: "VND",
    active: true
  },
  {
    code: "SUP-SENSIRION-SG",
    name: "Sensirion Asia Pacific Pte Ltd",
    country: "SG",
    categories: ["Sensors", "Environmental Modules"],
    leadTimeDays: 7,
    onTimeRate: 0.98,
    defectRate: 0.002,
    minOrderQuantity: 25,
    currency: "VND",
    active: true
  },
  {
    code: "SUP-STMICRO-TW",
    name: "STMicroelectronics Taiwan Supply",
    country: "TW",
    categories: ["MCU", "Power Management", "Motor Drivers"],
    leadTimeDays: 10,
    onTimeRate: 0.92,
    defectRate: 0.006,
    minOrderQuantity: 50,
    currency: "VND",
    active: true
  },
  {
    code: "SUP-YAGEO-CN",
    name: "Yageo Passive Components Hub",
    country: "CN",
    categories: ["Passive", "Resistors", "Capacitors"],
    leadTimeDays: 12,
    onTimeRate: 0.89,
    defectRate: 0.009,
    minOrderQuantity: 100,
    currency: "VND",
    active: true
  },
  {
    code: "SUP-MEANWELL-VN",
    name: "MeanWell Industrial Power VN",
    country: "VN",
    categories: ["Power", "Converters", "Adapters"],
    leadTimeDays: 4,
    onTimeRate: 0.95,
    defectRate: 0.005,
    minOrderQuantity: 5,
    currency: "VND",
    active: true
  },
  {
    code: "SUP-LEGACY-DEMO",
    name: "Legacy Discontinued Components",
    country: "VN",
    categories: ["Display"],
    leadTimeDays: 21,
    onTimeRate: 0.72,
    defectRate: 0.03,
    minOrderQuantity: 50,
    currency: "VND",
    active: false
  }
];

const VOLUME_DISCOUNT_TIERS = [
  { minQty: 500, discountRate: 0.18, tierName: "ENTERPRISE_500" },
  { minQty: 200, discountRate: 0.12, tierName: "WHOLESALE_200" },
  { minQty: 50, discountRate: 0.07, tierName: "BULK_50" },
  { minQty: 20, discountRate: 0.03, tierName: "STARTER_20" },
  { minQty: 1, discountRate: 0.0, tierName: "STANDARD" }
];

const COUNTRY_CUSTOMS_DUTY = {
  VN: 0.0,
  SG: 0.02,
  TW: 0.04,
  CN: 0.05,
  JP: 0.03,
  US: 0.05
};

const DEFAULT_VAT_RATE = 0.08;

/**
 * Filter suppliers by active status, country, or supported category.
 * @param {object} filters
 * @returns {Array<object>}
 */
function listSuppliers(filters = {}) {
  const { country, category, includeInactive = false } = filters;

  return SUPPLIER_CATALOG.filter((supplier) => {
    if (!includeInactive && !supplier.active) {
      return false;
    }
    if (country && supplier.country.toUpperCase() !== String(country).toUpperCase()) {
      return false;
    }
    if (category) {
      const target = String(category).toLowerCase();
      const matched = supplier.categories.some((c) => c.toLowerCase() === target);
      if (!matched) return false;
    }
    return true;
  }).map((supplier) => ({
    ...supplier,
    reliabilityScore: computeSupplierReliabilityScore(supplier)
  }));
}

/**
 * Look up a supplier by its unique code.
 * @param {string} supplierCode
 * @returns {object|null}
 */
function findSupplierByCode(supplierCode) {
  if (typeof supplierCode !== "string" || !supplierCode.trim()) {
    return null;
  }
  const normalized = supplierCode.trim().toUpperCase();
  const found = SUPPLIER_CATALOG.find((s) => s.code === normalized);
  if (!found) return null;
  return {
    ...found,
    reliabilityScore: computeSupplierReliabilityScore(found)
  };
}

/**
 * Compute a 0-100 reliability score combining on-time delivery, defect rate, and lead time.
 * @param {object} supplier
 * @returns {number}
 */
function computeSupplierReliabilityScore(supplier) {
  if (!supplier) return 0;
  const onTimeScore = (Number(supplier.onTimeRate) || 0) * 60;
  const qualityScore = Math.max(0, 1 - (Number(supplier.defectRate) || 0) * 10) * 25;
  const leadPenalty = Math.min(15, Math.max(0, (Number(supplier.leadTimeDays) || 0) - 2) * 0.8);
  const leadScore = 15 - leadPenalty;

  return Number(Math.max(0, Math.min(100, onTimeScore + qualityScore + leadScore)).toFixed(2));
}

/**
 * Determine volume discount tier for a given order quantity.
 * @param {number} quantity
 * @returns {object}
 */
function resolveVolumeDiscountTier(quantity) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return VOLUME_DISCOUNT_TIERS[VOLUME_DISCOUNT_TIERS.length - 1];
  }

  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (qty >= tier.minQty) {
      return tier;
    }
  }
  return VOLUME_DISCOUNT_TIERS[VOLUME_DISCOUNT_TIERS.length - 1];
}

/**
 * Calculate a procurement quote including MOQ validation and bulk discount.
 * @param {object} params
 * @returns {object}
 */
function calculateBulkQuote({ supplierCode, unitPrice, quantity }) {
  const supplier = findSupplierByCode(supplierCode);
  if (!supplier) {
    return { valid: false, error: "Unknown supplier code" };
  }
  if (!supplier.active) {
    return { valid: false, error: "Supplier is currently inactive" };
  }

  const price = Number(unitPrice);
  const qty = Number(quantity);

  if (!Number.isFinite(price) || price <= 0) {
    return { valid: false, error: "unitPrice must be a positive number" };
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return { valid: false, error: "quantity must be a positive integer" };
  }

  const meetsMoq = qty >= supplier.minOrderQuantity;
  const tier = resolveVolumeDiscountTier(qty);
  const grossSubtotal = Math.round(price * qty);
  const discountAmount = Math.round(grossSubtotal * tier.discountRate);
  const netSubtotal = grossSubtotal - discountAmount;

  return {
    valid: true,
    supplierCode: supplier.code,
    supplierName: supplier.name,
    unitPrice: price,
    quantity: qty,
    minOrderQuantity: supplier.minOrderQuantity,
    meetsMoq,
    discountTier: tier.tierName,
    discountRate: tier.discountRate,
    grossSubtotal,
    discountAmount,
    netSubtotal,
    estimatedLeadTimeDays: supplier.leadTimeDays
  };
}

/**
 * Estimate full landed cost including shipping, import duty, and VAT.
 * @param {object} params
 * @returns {object}
 */
function calculateLandedCost({ supplierCode, unitPrice, quantity, shippingFee = 0, vatRate = DEFAULT_VAT_RATE }) {
  const quote = calculateBulkQuote({ supplierCode, unitPrice, quantity });
  if (!quote.valid) {
    return quote;
  }

  const supplier = findSupplierByCode(supplierCode);
  const safeShipping = Math.max(0, Number(shippingFee) || 0);
  const safeVat = Math.max(0, Math.min(0.25, Number(vatRate)));
  const dutyRate = COUNTRY_CUSTOMS_DUTY[supplier.country] ?? 0.05;

  const customsDuty = Math.round(quote.netSubtotal * dutyRate);
  const taxableBase = quote.netSubtotal + customsDuty + safeShipping;
  const vatAmount = Math.round(taxableBase * safeVat);
  const totalLandedCost = taxableBase + vatAmount;
  const landedUnitCost = Math.round(totalLandedCost / quote.quantity);

  return {
    ...quote,
    country: supplier.country,
    shippingFee: safeShipping,
    dutyRate,
    customsDuty,
    vatRate: safeVat,
    vatAmount,
    totalLandedCost,
    landedUnitCost
  };
}

/**
 * Evaluate supplier SLA performance across active vendors.
 * @returns {object}
 */
function generateSlaReport() {
  const activeSuppliers = listSuppliers({ includeInactive: false });
  const ranked = activeSuppliers
    .map((s) => {
      let grade = "C";
      if (s.reliabilityScore >= 90) {
        grade = "A";
      } else if (s.reliabilityScore >= 80) {
        grade = "B";
      }
      return {
        code: s.code,
        name: s.name,
        country: s.country,
        leadTimeDays: s.leadTimeDays,
        onTimeRatePercent: Number((s.onTimeRate * 100).toFixed(1)),
        defectRatePercent: Number((s.defectRate * 100).toFixed(2)),
        reliabilityScore: s.reliabilityScore,
        slaGrade: grade
      };
    })
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  const averageScore = ranked.length
    ? Number((ranked.reduce((sum, item) => sum + item.reliabilityScore, 0) / ranked.length).toFixed(2))
    : 0;

  return {
    totalActiveSuppliers: ranked.length,
    averageReliabilityScore: averageScore,
    topSupplier: ranked[0] || null,
    suppliers: ranked
  };
}

/**
 * Escape a single CSV cell safely.
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeCsvField(value) {
  let str = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export active supplier SLA summary to CSV format.
 * @returns {string}
 */
function exportSuppliersCsv() {
  const report = generateSlaReport();
  const header = ["Code", "Name", "Country", "LeadTimeDays", "OnTimePercent", "DefectPercent", "Score", "Grade"].join(",");
  const rows = report.suppliers.map((s) =>
    [
      sanitizeCsvField(s.code),
      sanitizeCsvField(s.name),
      sanitizeCsvField(s.country),
      sanitizeCsvField(s.leadTimeDays),
      sanitizeCsvField(s.onTimeRatePercent),
      sanitizeCsvField(s.defectRatePercent),
      sanitizeCsvField(s.reliabilityScore),
      sanitizeCsvField(s.slaGrade)
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

module.exports = {
  SUPPLIER_CATALOG,
  VOLUME_DISCOUNT_TIERS,
  listSuppliers,
  findSupplierByCode,
  computeSupplierReliabilityScore,
  resolveVolumeDiscountTier,
  calculateBulkQuote,
  calculateLandedCost,
  generateSlaReport,
  sanitizeCsvField,
  exportSuppliersCsv
};
