/**
 * Warranty & RMA Policy Service
 * Evaluates warranty coverage, moisture sensitivity handling, and batch defect metrics
 * for electronic components sold on ElectroHub.
 */

const CATEGORY_WARRANTY_DAYS = {
  MCU: 365,
  Sensors: 180,
  "Power Management": 365,
  "Wi-Fi / BLE Modules": 365,
  "Development Boards": 180,
  Display: 90,
  Passive: 30
};

const DEFAULT_WARRANTY_DAYS = 90;

const ESD_SENSITIVE_CATEGORIES = new Set([
  "MCU",
  "Sensors",
  "Power Management",
  "Wi-Fi / BLE Modules",
  "Development Boards"
]);

const MSL_REQUIREMENTS = {
  MCU: { level: "MSL-3", floorLifeHours: 168, bakeRequiredIfExposed: true },
  Sensors: { level: "MSL-1", floorLifeHours: Infinity, bakeRequiredIfExposed: false },
  "Wi-Fi / BLE Modules": { level: "MSL-3", floorLifeHours: 168, bakeRequiredIfExposed: true },
  "Power Management": { level: "MSL-2", floorLifeHours: 8760, bakeRequiredIfExposed: false },
  Display: { level: "MSL-1", floorLifeHours: Infinity, bakeRequiredIfExposed: false }
};

/**
 * Determine warranty duration in days for a component category.
 * @param {string} category
 * @returns {number}
 */
function getWarrantyDays(category) {
  if (typeof category !== "string" || !category.trim()) {
    return DEFAULT_WARRANTY_DAYS;
  }
  const normalized = category.trim();
  for (const [key, days] of Object.entries(CATEGORY_WARRANTY_DAYS)) {
    if (key.toLowerCase() === normalized.toLowerCase()) {
      return days;
    }
  }
  return DEFAULT_WARRANTY_DAYS;
}

/**
 * Evaluate whether an order item is eligible for RMA warranty claim.
 * @param {object} params
 * @returns {object}
 */
function evaluateWarrantyClaim({
  category,
  purchasedAt,
  claimDate = new Date(),
  physicalDamage = false,
  esdDamaged = false,
  soldered = false
}) {
  const warrantyDays = getWarrantyDays(category);
  const purchaseTime = new Date(purchasedAt).getTime();
  const claimTime = new Date(claimDate).getTime();

  if (Number.isNaN(purchaseTime) || Number.isNaN(claimTime)) {
    return { eligible: false, reason: "Invalid purchase or claim date" };
  }

  const elapsedDays = Math.floor((claimTime - purchaseTime) / (1000 * 60 * 60 * 24));
  if (elapsedDays < 0) {
    return { eligible: false, reason: "Claim date cannot precede purchase date" };
  }

  if (physicalDamage) {
    return {
      eligible: false,
      elapsedDays,
      warrantyDays,
      resolution: "REJECTED",
      reason: "Physical damage is excluded from standard component warranty"
    };
  }

  if (esdDamaged && ESD_SENSITIVE_CATEGORIES.has(category)) {
    return {
      eligible: false,
      elapsedDays,
      warrantyDays,
      resolution: "REJECTED",
      reason: "Electrostatic discharge (ESD) damage voids semiconductor warranty"
    };
  }

  if (elapsedDays > warrantyDays) {
    return {
      eligible: false,
      elapsedDays,
      warrantyDays,
      resolution: "EXPIRED",
      reason: `Warranty period of ${warrantyDays} days has expired`
    };
  }

  const resolution = soldered ? "CREDIT_NOTE" : elapsedDays <= 30 ? "DIRECT_REPLACEMENT" : "REPAIR_OR_REPLACE";

  return {
    eligible: true,
    elapsedDays,
    remainingDays: warrantyDays - elapsedDays,
    warrantyDays,
    resolution,
    mslGuidance: MSL_REQUIREMENTS[category] || { level: "MSL-1", floorLifeHours: Infinity, bakeRequiredIfExposed: false },
    esdHandlingRequired: ESD_SENSITIVE_CATEGORIES.has(category)
  };
}

/**
 * Summarize batch defect metrics for incoming QC inspection.
 * @param {Array<object>} batches
 * @returns {object}
 */
function analyzeBatchDefectMetrics(batches) {
  if (!Array.isArray(batches) || batches.length === 0) {
    return {
      totalBatches: 0,
      totalInspected: 0,
      totalDefective: 0,
      overallDefectRatePercent: 0,
      rejectedBatches: []
    };
  }

  let totalInspected = 0;
  let totalDefective = 0;
  const rejectedBatches = [];

  for (const batch of batches) {
    const inspected = Math.max(0, Number(batch.inspectedQty) || 0);
    const defective = Math.max(0, Math.min(inspected, Number(batch.defectiveQty) || 0));
    const rate = inspected > 0 ? defective / inspected : 0;

    totalInspected += inspected;
    totalDefective += defective;

    if (rate > 0.02) {
      rejectedBatches.push({
        batchId: batch.batchId || "UNKNOWN",
        inspectedQty: inspected,
        defectiveQty: defective,
        defectRatePercent: Number((rate * 100).toFixed(2))
      });
    }
  }

  const overallDefectRatePercent = totalInspected > 0
    ? Number(((totalDefective / totalInspected) * 100).toFixed(3))
    : 0;

  return {
    totalBatches: batches.length,
    totalInspected,
    totalDefective,
    overallDefectRatePercent,
    rejectedBatches
  };
}

module.exports = {
  CATEGORY_WARRANTY_DAYS,
  ESD_SENSITIVE_CATEGORIES,
  MSL_REQUIREMENTS,
  getWarrantyDays,
  evaluateWarrantyClaim,
  analyzeBatchDefectMetrics
};
