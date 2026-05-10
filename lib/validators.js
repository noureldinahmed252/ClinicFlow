// ============================================================
// VALIDATORS LIBRARY - Production-Ready Safety Layer
// ============================================================

// 🔒 AUTH TOKEN VALIDATION
const AUTH_TOKEN_KEY = "authToken";

class AuthValidator {
  static isValidToken(token) {
    if (!token || typeof token !== "string") return false;
    if (token.length < 20) return false;
    // Basic JWT-like check: should have at least 1 dot
    return (token.match(/\./g) || []).length >= 1;
  }

  static getValidToken() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!this.isValidToken(token)) {
      console.warn("⚠️ Invalid token detected, clearing");
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
    return token;
  }

  static setToken(token) {
    if (!this.isValidToken(token)) {
      throw new Error("Invalid token format");
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  static clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  static hasValidToken() {
    return this.getValidToken() !== null;
  }
}

// ⏰ STRICT TIME VALIDATION
class TimeValidator {
  // Normalize various time formats to HH:MM
  static normalize(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return null;

    timeStr = timeStr.trim().toUpperCase();

    // Handle 12-hour format (9:30am → 09:30)
    const match12h = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match12h) {
      let [, h, m, meridiem] = match12h;
      h = parseInt(h);

      if (meridiem === "PM" && h !== 12) h += 12;
      if (meridiem === "AM" && h === 12) h = 0;

      if (h < 0 || h > 23 || parseInt(m) < 0 || parseInt(m) > 59) {
        return null; // Invalid time
      }
      return `${String(h).padStart(2, "0")}:${m}`;
    }

    // Handle 24-hour format (09:30)
    const match24h = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24h) {
      let [, h, m] = match24h;
      h = parseInt(h);
      m = parseInt(m);

      if (h < 0 || h > 23 || m < 0 || m > 59) {
        return null;
      }
      return `${String(h).padStart(2, "0")}:${m}`;
    }

    return null;
  }

  static toMinutes(timeStr) {
    const normalized = this.normalize(timeStr);
    if (!normalized) return null;

    const [h, m] = normalized.split(":").map(Number);
    return h * 60 + m;
  }

  static isValid(timeStr) {
    return this.normalize(timeStr) !== null;
  }

  // Check if two time slots overlap
  static doOverlap(start1, duration1, start2, duration2) {
    const s1 = this.toMinutes(start1);
    const s2 = this.toMinutes(start2);

    if (s1 === null || s2 === null) return false;

    duration1 = Math.max(0, parseInt(duration1) || 30);
    duration2 = Math.max(0, parseInt(duration2) || 30);

    return s1 < s2 + duration2 && s2 < s1 + duration1;
  }
}

// 🛡️ STRICT MEDICAL FORM VALIDATOR
class MedicalFormValidator {
  static rules = {
    dose: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[\d]+\s*(mg|ml|g|ug|mmol|units?|IU)?$/i,
      error: 'Dose format: e.g., "500mg" or "2ml"',
    },
    form: {
      required: true,
      allowed: ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment"],
      error: "Invalid medication form",
    },
    frequency: {
      required: true,
      allowed: [
        "Once Daily",
        "Twice Daily",
        "3x Daily",
        "4x Daily",
        "As Needed",
      ],
      error: "Invalid frequency",
    },
    timing: {
      required: true,
      allowed: ["Anytime", "Before Food", "After Food"],
      error: "Invalid timing",
    },
    days: {
      required: true,
      min: 1,
      max: 365,
      type: "integer",
      error: "Days must be between 1-365",
    },
  };

  static validate(formData) {
    const errors = {};

    for (const [field, value] of Object.entries(formData)) {
      const rule = this.rules[field];
      if (!rule) continue;

      // Required check
      if (rule.required && (!value || value.toString().trim() === "")) {
        errors[field] = `${field} is required`;
        continue;
      }

      // Pattern check (for dose)
      if (rule.pattern && !rule.pattern.test(value)) {
        errors[field] = rule.error;
        continue;
      }

      // Allowed values check (form, frequency, timing)
      if (rule.allowed && !rule.allowed.includes(value)) {
        errors[field] = rule.error;
        continue;
      }

      // Numeric checks (days)
      if (rule.type === "integer") {
        const num = parseInt(value);
        if (!Number.isInteger(num) || num < rule.min || num > rule.max) {
          errors[field] = rule.error;
          continue;
        }
      }

      // Length check (dose string length)
      if (rule.minLength && value.length < rule.minLength) {
        errors[field] = `${field} too short`;
        continue;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors[field] = `${field} too long`;
        continue;
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  }
}

// 🔐 STRONG PASSWORD VALIDATOR
class PasswordValidator {
  static rules = {
    minLength: { value: 8, label: "At least 8 characters" },
    uppercase: { regex: /[A-Z]/, label: "One uppercase letter (A-Z)" },
    lowercase: { regex: /[a-z]/, label: "One lowercase letter (a-z)" },
    number: { regex: /\d/, label: "One number (0-9)" },
    special: {
      regex: /[!@#$%^&*()_+\-=\[\]{};:'",.<>?\/\\|`~]/,
      label: "One special character",
    },
  };

  static validate(password) {
    const failures = [];

    if (password.length < this.rules.minLength.value) {
      failures.push(this.rules.minLength.label);
    }

    if (!this.rules.uppercase.regex.test(password)) {
      failures.push(this.rules.uppercase.label);
    }

    if (!this.rules.lowercase.regex.test(password)) {
      failures.push(this.rules.lowercase.label);
    }

    if (!this.rules.number.regex.test(password)) {
      failures.push(this.rules.number.label);
    }

    // Special char optional but recommended
    const hasSpecial = this.rules.special.regex.test(password);

    return {
      isValid: failures.length === 0,
      failures,
      hasSpecial,
      strength: this.getStrength(failures.length, hasSpecial),
    };
  }

  static getStrength(failureCount, hasSpecial) {
    if (failureCount === 0 && hasSpecial) return "very-strong";
    if (failureCount === 0) return "strong";
    if (failureCount === 1) return "medium";
    if (failureCount <= 3) return "weak";
    return "very-weak";
  }
}

// 🔄 RETRY + FALLBACK ENGINE WITH PROPER VALIDATION
class ApiClient {
  static async request(endpoint, method = "GET", body = null, options = {}) {
    const { retries = 3, timeout = 8000, fallback = null } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(
          endpoint.startsWith("http")
            ? endpoint
            : "https://osamarabea-001-site1.jtempurl.com" + endpoint,
          {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(AuthValidator.getValidToken() && {
                Authorization: `Bearer ${AuthValidator.getValidToken()}`,
              }),
            },
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        // Handle 401 globally
        if (response.status === 401) {
          AuthValidator.clearToken();
          throw new Error("Session expired. Please login again.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMsg = data.message || `Error: ${response.status}`;
          throw new Error(this.sanitizeError(errorMsg));
        }

        return data; // Success on first try
      } catch (error) {
        console.warn(`❌ Attempt ${attempt}/${retries} failed:`, error.message);

        if (attempt === retries) {
          // All retries exhausted
          if (fallback !== null) return fallback;
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  static sanitizeError(msg) {
    return String(msg)
      .replace(/[A-Z]:\\[^\s"]*/gi, "[path]")
      .replace(/\/[a-zA-Z0-9_\-\/]+/g, "[path]")
      .split("\n")[0]
      .substring(0, 100); // Limit length
  }
}

// ✅ SAFE API RESPONSE HANDLER
function safeUnpackApiResponse(response, options = {}) {
  const { maxRetries = 0, timeout = 5000 } = options;

  // Validate response is object
  if (!response || typeof response !== "object") {
    console.warn("❌ API Response is not object:", typeof response);
    return null;
  }

  // Check for error structure first
  if (response.error || response.errors) {
    const errorMsg =
      response.error?.message ||
      response.errors?.[0]?.message ||
      "Unknown error";
    console.error("🚨 API Error Response:", errorMsg);
    return null;
  }

  // Safe unpacking with validation
  const candidates = [
    response.data?.data,
    response.data,
    response.result,
    response,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      // Validate it's not an error object disguised as data
      if (!candidate.error && !candidate.statusCode) {
        return candidate;
      }
    }
  }

  console.warn("⚠️ No valid data found in API response");
  return null;
}

// 📊 OPTIMIZED CHART MANAGEMENT
class ChartManager {
  static charts = {
    appointments: null,
    conditions: null,
  };

  static initChart(canvasId, type, initialData, initialOptions) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
      type,
      data: initialData,
      options: {
        ...initialOptions,
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  static updateChart(chartKey, newData) {
    if (!this.charts[chartKey]) return;

    const chart = this.charts[chartKey];
    chart.data = newData;
    chart.update("none"); // Update without animation for speed
  }

  static destroyChart(chartKey) {
    if (this.charts[chartKey]) {
      this.charts[chartKey].destroy();
      this.charts[chartKey] = null;
    }
  }

  static destroyAll() {
    Object.keys(this.charts).forEach((key) => this.destroyChart(key));
  }
}

// 🎯 DEBOUNCE UTILITY
function debounce(fn, delay = 300) {
  let timeoutId = null;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// 🎯 THROTTLE UTILITY
function throttle(fn, delay = 300) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

console.log("✅ Validators library loaded");
