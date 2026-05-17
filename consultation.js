// ============================================================
// CONSULTATION
// ============================================================

// 🎯 DEBOUNCED SEARCH FOR DIAGNOSIS AND MEDICATIONS
const debouncedSearchDiagnosis = debounce(async (q) => {
  await searchDiagnosis(q);
}, 300);

const debouncedSearchMedication = debounce(async (q) => {
  await searchDrug(q);
}, 300);

let csState = {
  diagnoses: [],
  medications: [],
  selectedMedicine: null,
};

let consultationLookups = {
  loaded: false,
  loading: null,
  error: "",
  diseases: [],
  medications: [],
};

const csAutocomplete = {
  diagnosis: { index: -1, results: [] },
  medication: { index: -1, results: [] },
};

let pendingMedRemoveIndex = null;

const MED_FREQUENCY_OPTIONS = [
  "",
  "Once Daily",
  "Twice Daily",
  "3x Daily",
  "4x Daily",
  "As Needed",
];
const MED_TIMING_OPTIONS = ["", "Anytime", "Before Food", "After Food"];
const MED_FORM_OPTIONS = [
  "",
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Ointment",
];

function escapeConsultHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBmiTone(bmi) {
  if (!bmi) return "neutral";
  if (bmi.cls === "bmi-normal") return "normal";
  if (bmi.cls === "bmi-obese") return "critical";
  return "medium";
}

function severityLabel(severity) {
  const map = {
    low: "Low",
    mild: "Mild",
    medium: "Medium",
    moderate: "Moderate",
    high: "High",
    severe: "Severe",
  };
  return map[severity] || severity || "Unknown";
}

function logConsultationActivity(message, tone = "info") {
  const log = document.getElementById("csActivityLog");
  if (!log) return;
  const empty = log.querySelector(".cs-activity-empty");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = `cs-activity-item cs-activity-${tone}`;
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  item.innerHTML = `<span class="cs-activity-time">${time}</span><span class="cs-activity-msg">${escapeConsultHtml(message)}</span>`;
  log.prepend(item);
  while (log.children.length > 12) log.lastElementChild?.remove();
}

function updateConsultationEmptyStates() {
  const diagEmpty = document.getElementById("diagEmptyState");
  const medEmpty = document.getElementById("medEmptyState");
  const notesEmpty = document.getElementById("notesEmptyState");
  if (diagEmpty)
    diagEmpty.classList.toggle("visible", !csState.diagnoses.length);
  if (medEmpty)
    medEmpty.classList.toggle("visible", !csState.medications.length);
  const notesVal = document.getElementById("csNotes")?.value.trim() || "";
  if (notesEmpty) notesEmpty.classList.toggle("visible", !notesVal);
}

function initConsultationCollapsibles() {
  document.querySelectorAll(".cs-collapsible .cs-panel-toggle").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const panel = btn.closest(".cs-collapsible");
      if (!panel) return;
      const isOpen = panel.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });
}

function setConsultationSaveLoading(loading) {
  const btn = document.getElementById("csSaveBtn");
  const label = btn?.querySelector(".cs-save-label");
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = !!loading;
  if (label) label.textContent = loading ? "Saving..." : "Save Consultation";
}

function flashConsultationSaved() {
  const btn = document.getElementById("csSaveBtn");
  const label = btn?.querySelector(".cs-save-label");
  if (!label) return;
  label.textContent = "Saved ✓";
  btn.classList.add("is-saved");
  setTimeout(() => {
    btn.classList.remove("is-saved");
    label.textContent = "Save Consultation";
  }, 1200);
}

function medSelectOptions(values, selected) {
  return values
    .map((value) => {
      const label = value || "-- Select --";
      const sel = String(selected || "") === value ? " selected" : "";
      return `<option value="${escapeConsultHtml(value)}"${sel}>${escapeConsultHtml(label)}</option>`;
    })
    .join("");
}

function syncMedicationToHiddenFields(med) {
  const doseEl = document.getElementById("medDose");
  const freqEl = document.getElementById("medFrequency");
  const timingEl = document.getElementById("medTiming");
  const daysEl = document.getElementById("medDays");
  const formEl = document.getElementById("medForm");
  if (doseEl) doseEl.value = med?.dose || "";
  if (freqEl) freqEl.value = med?.frequency || "";
  if (timingEl) timingEl.value = med?.timing || "";
  if (daysEl) daysEl.value = med?.days ?? "";
  if (formEl) formEl.value = med?.form || "";
}

function readMedCardFields(index) {
  const card = document.querySelector(
    `.cs-med-card[data-med-index="${index}"]`,
  );
  if (!card) return {};
  const val = (field) =>
    card.querySelector(`[data-field="${field}"]`)?.value?.trim() || "";
  return {
    dose: val("dose"),
    frequency: val("frequency"),
    timing: val("timing"),
    days: val("days"),
    form: val("form"),
  };
}

function medSummaryBadges(med) {
  const badges = [
    ["Dose", med.dose],
    ["Frequency", med.frequency],
    ["Days", med.days ? `${med.days}d` : ""],
    ["Timing", med.timing],
    ["Form", med.form],
  ].filter(([, value]) => value);
  if (!badges.length) {
    return '<span class="cs-med-badge cs-med-badge-muted">No dosage configured</span>';
  }
  return badges
    .map(
      ([label, value]) =>
        `<span class="cs-med-badge" title="${escapeConsultHtml(label)}">${escapeConsultHtml(value)}</span>`,
    )
    .join("");
}

function normalizeDiseaseOption(disease = {}) {
  return {
    id: disease.id ?? disease.diseaseId,
    name: disease.name || disease.diseasesName || disease.diseaseName || "",
    severity: normalizeSeverity(disease.severity ?? disease.diseaseSeverity),
  };
}

function normalizeMedicationOption(medication = {}) {
  return {
    id: medication.id ?? medication.medicineId ?? medication.medicationId,
    name:
      medication.name ||
      medication.medicineName ||
      medication.medicationName ||
      medication.drugName ||
      "",
  };
}

function availableDiseases() {
  return consultationLookups.diseases;
}

function availableMedications() {
  return consultationLookups.medications;
}

function jsArg(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function diagnosisNames(diagnoses) {
  return (diagnoses || []).map((d) => d.name || d).filter(Boolean);
}

function setLookupInputsDisabled(disabled) {
  ["diagSearch", "drugSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

function setLookupHint(message, type = "info") {
  const containers = ["selectedDiagnoses", "selectedMeds"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  containers.forEach((el) => {
    if (!el.children.length) {
      if (type === "loading") {
        el.innerHTML = `<div class="cs-skeleton-stack" aria-busy="true" aria-label="Loading">
          <div class="cs-skeleton cs-skeleton-line"></div>
          <div class="cs-skeleton cs-skeleton-line short"></div>
        </div>`;
      } else {
        el.innerHTML = `<div class="cs-inline-state ${type}">${message}</div>`;
      }
    }
  });
}

function clearLookupHints() {
  ["selectedDiagnoses", "selectedMeds"].forEach((id) => {
    const el = document.getElementById(id);
    if (el?.querySelector(".cs-inline-state, .cs-skeleton-stack"))
      el.innerHTML = "";
  });
}

async function loadConsultationLookups() {
  if (consultationLookups.loaded) return consultationLookups;
  if (consultationLookups.loading) return consultationLookups.loading;

  const loader = apiFn("getMyDiseasesAndMedicines");
  if (!loader || !localStorage.getItem("authToken")) {
    consultationLookups = {
      loaded: true,
      loading: null,
      error: "Login is required to load diseases and medicines.",
      diseases: [],
      medications: [],
    };
    return consultationLookups;
  }

  setLookupInputsDisabled(true);
  setLookupHint("Loading diseases and medicines...", "loading");

  consultationLookups.loading = loader()
    .then((response) => {
      const data = unpackApiResponse(response) || response || {};
      consultationLookups = {
        loaded: true,
        loading: null,
        error: "",
        diseases: normalizeApiArray(data.diseases ?? data)
          .map(normalizeDiseaseOption)
          .filter((d) => d.id !== undefined && d.id !== null && d.name),
        medications: normalizeApiArray(
          data.medicines ?? data.medications ?? data,
        )
          .map(normalizeMedicationOption)
          .filter((m) => m.id !== undefined && m.id !== null && m.name),
      };
      clearLookupHints();
      if (!consultationLookups.diseases.length) {
        const el = document.getElementById("selectedDiagnoses");
        if (el)
          el.innerHTML =
            '<div class="cs-inline-state empty">No diseases were returned for your specialty.</div>';
      }
      if (!consultationLookups.medications.length) {
        const el = document.getElementById("selectedMeds");
        if (el)
          el.innerHTML =
            '<div class="cs-inline-state empty">No medicines were returned for your specialty.</div>';
      }
      return consultationLookups;
    })
    .catch((error) => {
      consultationLookups = {
        loaded: true,
        loading: null,
        error: error?.message || "Failed to load diseases and medicines.",
        diseases: [],
        medications: [],
      };
      clearLookupHints();
      setLookupHint(consultationLookups.error, "error");
      return consultationLookups;
    })
    .finally(() => setLookupInputsDisabled(false));

  return consultationLookups.loading;
}

function resetConsultationForm() {
  csState = { diagnoses: [], medications: [], selectedMedicine: null };
  pendingMedRemoveIndex = null;
  ["selectedDiagnoses", "selectedMeds"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
  const activityLog = document.getElementById("csActivityLog");
  if (activityLog) {
    activityLog.innerHTML =
      '<div class="cs-activity-empty">Session activity will appear here.</div>';
  }
  [
    "diagSearch",
    "drugSearch",
    "csNotes",
    "csDiseaseDescription",
    "medDose",
    "medForm",
    "medFrequency",
    "medDays",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const timingEl = document.getElementById("medTiming");
  if (timingEl) timingEl.value = "";
  ["diagDrop", "drugDrop"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  updateConsultationEmptyStates();
  setConsultationSaveLoading(false);
}

async function startConsultation(apptId) {
  const appt = DB.get("appointments")
    .map(normalizeAppointment)
    .find((a) => a.id === String(apptId));
  if (!appt) {
    toast("Appointment was not found.", "error");
    return;
  }
  if (appt.status !== "Pending") {
    toast("Only pending appointments can be completed.", "warning");
    return;
  }

  const rawPatient = DB.get("patients").find(
    (p) => normalizePatient(p).id === appt.patientId,
  );
  const patient = rawPatient
    ? normalizePatient(rawPatient)
    : normalizePatient(appt);
  if (!patient.id || !patient.name) {
    toast("Patient data is missing from this appointment.", "error");
    return;
  }

  resetConsultationForm();
  document.getElementById("csApptId").value = appt.id;

  document.getElementById("csApptInfo").textContent =
    `${formatDate(appt.date)} - ${formatTime(appt.time)} - ${valueOrDash(appt.clinicName)} - ${appt.notes || "No notes"}`;

  const avatarEl = document.getElementById("csPatientAvatar");
  if (avatarEl) avatarEl.textContent = getInitials(patient.name);
  document.getElementById("csPatientName").textContent = valueOrDash(
    patient.name,
  );

  const bmi = calcBMI(patient.height, patient.weight);
  const chips = [
    patient.age ? `${patient.age}y` : null,
    patient.gender,
    patient.phone ? `Phone ${patient.phone}` : null,
    patient.bloodType ? `Blood ${patient.bloodType}` : null,
    bmi ? `BMI ${bmi.bmi}` : null,
    patient.city || null,
  ].filter(Boolean);
  document.getElementById("csPatientMeta").innerHTML = chips
    .map((c) => `<span class="cs-meta-chip">${c}</span>`)
    .join("");

  const vitalsEl = document.getElementById("csVitals");
  if (vitalsEl) {
    const bmiTone = getBmiTone(bmi);
    const vitals = [
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18"/><path d="M8 7h8"/><path d="M7 21h10"/></svg>`,
        val: patient.weight ? `${patient.weight} kg` : "-",
        lbl: "Weight",
        cls: "cs-vital-weight",
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20"/><path d="M8 6h8"/><path d="M9 18h6"/></svg>`,
        val: patient.height ? `${patient.height} cm` : "-",
        lbl: "Height",
        cls: "cs-vital-height",
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19h16"/><path d="M7 15l3-6 3 4 4-8"/></svg>`,
        val: bmi ? bmi.bmi : "-",
        lbl: bmi ? `BMI · ${bmi.label}` : "BMI",
        cls: `cs-vital-bmi cs-vital-bmi-${bmiTone}`,
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l7 4v6c0 5-3.5 9-7 10C8.5 21 5 17 5 12V6z"/></svg>`,
        val: patient.bloodType || "-",
        lbl: "Blood Type",
        cls: "cs-vital-blood",
        badge: patient.bloodType
          ? `<span class="cs-blood-badge">${escapeConsultHtml(patient.bloodType)}</span>`
          : "",
      },
    ];
    vitalsEl.innerHTML = vitals
      .map(
        (v) => `
      <div class="cs-vital-item ${v.cls}">
        <div class="cs-vital-icon">${v.icon}</div>
        <div class="cs-vital-body">
          <div class="cs-vital-lbl">${v.lbl}</div>
          <div class="cs-vital-val">${v.badge || escapeConsultHtml(v.val)}</div>
        </div>
      </div>`,
      )
      .join("");
  }

  const history = [];
  if (patient.medicalHistory.hypertension) history.push("Hypertension");
  if (patient.medicalHistory.diabetes) history.push("Diabetes");
  if (patient.medicalHistory.anaemia) history.push("Anaemia");
  if (patient.chronic) history.push(`Chronic: ${patient.chronic}`);
  document.getElementById("csHistory").innerHTML = history.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${history.map((c) => `<span class="badge badge-pending">${c}</span>`).join("")}</div>`
    : '<p style="color:var(--text-muted);font-size:13px;margin:0;">No known conditions</p>';

  const prevVisits = patient.visits.length
    ? patient.visits
    : DB.get("consultations")
        .filter((c) => c.patientId === patient.id)
        .map(normalizeVisit);
  document.getElementById("csVisits").innerHTML = prevVisits.length
    ? prevVisits
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 4)
        .map(
          (v) => `
        <div class="visit-item" style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="visit-date">${formatDate(v.date)}</div>
          </div>
          <div class="visit-diagnosis">${diagnosisNames(v.diagnoses).join(" - ") || "-"}</div>
          ${v.medications?.length ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">${v.medications.map((m) => m.name).join(", ")}</div>` : ""}
        </div>`,
        )
        .join("")
    : '<div class="empty-state" style="padding:20px 0;"><span class="icon" style="font-size:28px;">First</span><p>First visit</p></div>';

  initConsultationCollapsibles();
  updateConsultationEmptyStates();
  logConsultationActivity(`Consultation opened for ${patient.name}`, "info");
  showApp("consultation");
  loadConsultationLookups();
}

async function searchDiagnosis(q) {
  const drop = document.getElementById("diagDrop");
  if (!drop) return;
  if (!q) {
    drop.style.display = "none";
    return;
  }

  drop.innerHTML =
    '<div class="autocomplete-item" style="color:var(--text-muted);">Loading diseases...</div>';
  drop.style.display = "block";
  await loadConsultationLookups();

  if (consultationLookups.error) {
    drop.innerHTML = `<div class="autocomplete-item" style="color:var(--danger);">${consultationLookups.error}</div>`;
    return;
  }

  const selectedIds = csState.diagnoses.map((d) => String(d.id));
  const results = availableDiseases()
    .filter(
      (d) =>
        d.name.toLowerCase().includes(q.toLowerCase()) &&
        !selectedIds.includes(String(d.id)),
    )
    .slice(0, 8);

  csAutocomplete.diagnosis = { index: -1, results };
  drop.innerHTML =
    results
      .map(
        (d, index) => `
    <div class="autocomplete-item disease-option ${d.severity}" data-index="${index}" tabindex="-1" onclick="addDiagnosisById('${jsArg(d.id)}')">
      <span class="disease-option-main">${d.name}</span>
      <span class="severity-pill ${d.severity}">${d.severity}</span>
    </div>`,
      )
      .join("") ||
    '<div class="autocomplete-item" style="color:var(--text-muted);">No diseases found</div>';
}

function addDiagnosisById(id) {
  const disease = availableDiseases().find((d) => String(d.id) === String(id));
  if (
    !disease ||
    csState.diagnoses.some((d) => String(d.id) === String(disease.id))
  )
    return;
  csState.diagnoses.push({
    id: disease.id,
    name: disease.name,
    severity: disease.severity,
  });
  renderDiagnoses();
  logConsultationActivity(`Diagnosis added: ${disease.name}`, "success");
  document.getElementById("diagSearch").value = "";
  document.getElementById("diagDrop").style.display = "none";
}

function addDiagnosis(nameOrId) {
  const disease = availableDiseases().find(
    (d) => String(d.id) === String(nameOrId) || d.name === nameOrId,
  );
  if (disease) addDiagnosisById(disease.id);
}

function removeDiagnosis(id) {
  csState.diagnoses = csState.diagnoses.filter(
    (d) => String(d.id) !== String(id),
  );
  renderDiagnoses();
}

function renderDiagnoses() {
  const el = document.getElementById("selectedDiagnoses");
  if (!el) return;
  el.innerHTML = csState.diagnoses
    .map(
      (d) =>
        `<span class="tag disease-tag ${d.severity}">
      <span>${escapeConsultHtml(d.name)}</span>
      <span class="severity-pill ${d.severity}">${severityLabel(d.severity)}</span>
      <button type="button" class="remove" aria-label="Remove diagnosis" onclick="removeDiagnosis('${jsArg(d.id)}')">×</button>
    </span>`,
    )
    .join("");
  updateConsultationEmptyStates();
}

async function searchDrug(q) {
  const drop = document.getElementById("drugDrop");
  if (!drop) return;
  if (!q) {
    drop.style.display = "none";
    return;
  }

  drop.innerHTML =
    '<div class="autocomplete-item" style="color:var(--text-muted);">Loading medicines...</div>';
  drop.style.display = "block";
  await loadConsultationLookups();

  if (consultationLookups.error) {
    drop.innerHTML = `<div class="autocomplete-item" style="color:var(--danger);">${consultationLookups.error}</div>`;
    return;
  }

  const selectedIds = csState.medications.map((m) => String(m.id));
  const results = availableMedications()
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q.toLowerCase()) &&
        !selectedIds.includes(String(m.id)),
    )
    .slice(0, 8);

  csAutocomplete.medication = { index: -1, results };
  drop.innerHTML =
    results
      .map(
        (m, index) => `
    <div class="autocomplete-item med-option" data-index="${index}" tabindex="-1" onclick="selectDrug('${jsArg(m.id)}')">
      <span>${m.name}</span>
    </div>`,
      )
      .join("") ||
    '<div class="autocomplete-item" style="color:var(--text-muted);">No medicines found</div>';
}

function selectDrug(id) {
  const medicine = availableMedications().find(
    (m) => String(m.id) === String(id),
  );
  if (!medicine) return;
  csState.selectedMedicine = medicine;
  document.getElementById("drugSearch").value = medicine.name;
  document.getElementById("drugDrop").style.display = "none";
}

function addMedication() {
  const medicine = csState.selectedMedicine;
  if (!medicine) {
    toast("Select a medicine from the list first", "warning");
    return;
  }
  if (csState.medications.some((m) => String(m.id) === String(medicine.id))) {
    toast("This medicine is already selected", "info");
    return;
  }
  csState.medications.push({
    id: medicine.id,
    name: medicine.name,
    dose: "",
    frequency: "",
    timing: "",
    days: "",
    form: "",
    collapsed: false,
    applied: false,
  });
  renderMeds();
  csState.selectedMedicine = null;
  document.getElementById("drugSearch").value = "";
  logConsultationActivity(`Medication added: ${medicine.name}`, "info");
  updateConsultationEmptyStates();
}

function requestRemoveMedication(index) {
  const med = csState.medications[index];
  if (!med) return;
  pendingMedRemoveIndex = index;
  const text = document.getElementById("medRemoveConfirmText");
  if (text) text.textContent = `Remove ${med.name} from this prescription?`;
  const btn = document.getElementById("medRemoveConfirmBtn");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      if (pendingMedRemoveIndex !== null) {
        removeMedication(pendingMedRemoveIndex);
        pendingMedRemoveIndex = null;
      }
      closeModal("medRemoveConfirmModal");
    });
  }
  openModal("medRemoveConfirmModal");
}

function removeMedication(index) {
  const med = csState.medications[index];
  csState.medications.splice(index, 1);
  renderMeds();
  updateConsultationEmptyStates();
  if (med) logConsultationActivity(`Medication removed: ${med.name}`, "warning");
}

function toggleMedCard(index) {
  const med = csState.medications[index];
  if (!med) return;
  med.collapsed = !med.collapsed;
  renderMeds();
}

function applyMedication(index) {
  const med = csState.medications[index];
  if (!med) return;
  const fields = readMedCardFields(index);
  Object.assign(med, fields, { applied: true, collapsed: true });
  syncMedicationToHiddenFields(med);
  renderMeds();
  logConsultationActivity(`Medication applied: ${med.name}`, "success");
  const btn = document.querySelector(
    `.cs-med-card[data-med-index="${index}"] .cs-med-apply-btn`,
  );
  if (btn) {
    btn.classList.add("is-applied");
    const label = btn.querySelector(".cs-med-apply-label");
    if (label) label.textContent = "✓ Applied";
    setTimeout(() => {
      btn.classList.remove("is-applied");
      if (label) label.textContent = "Apply Medication";
    }, 1000);
  }
}

function renderMeds() {
  const container = document.getElementById("selectedMeds");
  if (!container) return;
  container.innerHTML = csState.medications
    .map((m, i) => {
      const collapsed = !!m.collapsed;
      const summary = medSummaryBadges(m);
      return `
    <div class="cs-med-card${collapsed ? " is-collapsed" : ""}" data-med-index="${i}" style="animation:fade-up 0.2s ease both;">
      <div class="cs-med-header">
        <button type="button" class="cs-med-toggle" onclick="toggleMedCard(${i})" aria-expanded="${!collapsed}" aria-label="Expand or collapse medication">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="cs-med-icon">💊</div>
        <div class="cs-med-title-wrap">
          <div class="cs-med-name">${escapeConsultHtml(m.name)}</div>
          <div class="cs-med-summary">${summary}</div>
        </div>
        <button type="button" class="cs-med-remove" onclick="requestRemoveMedication(${i})" title="Remove medication" aria-label="Remove medication">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="cs-med-body"${collapsed ? ' hidden' : ""}>
        <div class="cs-med-fields">
          <div class="cs-med-select-wrap">
            <label class="cs-med-lbl">Dose</label>
            <input type="text" class="cs-med-sel" data-field="dose" value="${escapeConsultHtml(m.dose || "")}" placeholder="500mg" />
          </div>
          <div class="cs-med-select-wrap">
            <label class="cs-med-lbl">Frequency</label>
            <select class="cs-med-sel" data-field="frequency">${medSelectOptions(MED_FREQUENCY_OPTIONS, m.frequency)}</select>
          </div>
          <div class="cs-med-select-wrap">
            <label class="cs-med-lbl">Timing</label>
            <select class="cs-med-sel" data-field="timing">${medSelectOptions(MED_TIMING_OPTIONS, m.timing)}</select>
          </div>
          <div class="cs-med-select-wrap">
            <label class="cs-med-lbl">Days</label>
            <input type="number" class="cs-med-sel" data-field="days" min="1" value="${escapeConsultHtml(m.days || "")}" placeholder="7" />
          </div>
          <div class="cs-med-select-wrap">
            <label class="cs-med-lbl">Form</label>
            <select class="cs-med-sel" data-field="form">${medSelectOptions(MED_FORM_OPTIONS, m.form)}</select>
          </div>
        </div>
        <div class="cs-med-actions">
          <button type="button" class="btn btn-success cs-med-apply-btn" onclick="applyMedication(${i})">
            <span class="cs-med-apply-label">Apply Medication</span>
          </button>
        </div>
      </div>
    </div>`;
    })
    .join("");
  updateConsultationEmptyStates();
}

function handleAutocompleteKeydown(type, event) {
  const config = csAutocomplete[type];
  const drop = document.getElementById(
    type === "diagnosis" ? "diagDrop" : "drugDrop",
  );
  if (!drop || drop.style.display === "none" || !config.results.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    config.index = Math.min(config.index + 1, config.results.length - 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    config.index = Math.max(config.index - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const selected = config.results[config.index >= 0 ? config.index : 0];
    if (selected) {
      if (type === "diagnosis") addDiagnosisById(selected.id);
      else selectDrug(selected.id);
    }
    return;
  } else if (event.key === "Escape") {
    drop.style.display = "none";
    return;
  } else {
    return;
  }

  drop.querySelectorAll(".autocomplete-item").forEach((item, index) => {
    item.classList.toggle("active", index === config.index);
    if (index === config.index) item.scrollIntoView({ block: "nearest" });
  });
}

function buildCompletionPayload() {
  return {
    notes: document.getElementById("csNotes")?.value.trim() || "",
    diseaseDescription:
      document.getElementById("csDiseaseDescription")?.value.trim() || "",
    diseasesIds: csState.diagnoses
      .map((d) => Number(d.id))
      .filter(Number.isFinite),
    medicineIds: csState.medications
      .map((m) => Number(m.id))
      .filter(Number.isFinite),
    dose: document.getElementById("medDose")?.value.trim() || "",
    form: document.getElementById("medForm")?.value.trim() || "",
    frequency: document.getElementById("medFrequency")?.value.trim() || "",
    days: toNumber(document.getElementById("medDays")?.value, 0),
    timing: document.getElementById("medTiming")?.value || "",
  };
}

function validateCompletionPayload(payload) {
  if (!payload.notes && !payload.diseaseDescription) {
    return "Add clinical notes or a disease description before completing the appointment.";
  }
  if (!payload.diseasesIds.length) {
    return "Select at least one disease.";
  }
  if (!payload.medicineIds.length) {
    return "Select at least one medicine.";
  }

  // 🛡️ Use MedicalFormValidator for medication validation
  const medicalErrors = MedicalFormValidator.validate({
    dose: payload.dose,
    form: payload.form,
    frequency: payload.frequency,
    timing: payload.timing,
    days: payload.days,
  });

  if (medicalErrors) {
    const errorMessages = Object.values(medicalErrors).join(", ");
    return `Medication validation failed: ${errorMessages}`;
  }

  return "";
}

function syncLastAppliedMedicationFields() {
  const applied = [...csState.medications].reverse().find((m) => m.applied);
  const source = applied || csState.medications[csState.medications.length - 1];
  if (source) syncMedicationToHiddenFields(source);
}

async function saveConsultation(e) {
  e.preventDefault();
  syncLastAppliedMedicationFields();
  const apptId = document.getElementById("csApptId").value;
  const appt = DB.get("appointments")
    .map(normalizeAppointment)
    .find((a) => a.id === apptId);
  if (!appt) {
    toast("Appointment was not found.", "error");
    return;
  }
  if (appt.status !== "Pending") {
    toast("Only pending appointments can be completed.", "warning");
    return;
  }
  if (!apiFn("completeAppointment")) {
    toast("Appointment completion API is unavailable.", "error");
    return;
  }

  const payload = buildCompletionPayload();
  const validationError = validateCompletionPayload(payload);
  if (validationError) {
    toast(validationError, "warning");
    return;
  }

  const submitBtn =
    document.getElementById("csSaveBtn") ||
    e.target.querySelector('button[type="submit"]');
  setConsultationSaveLoading(true);

  try {
    await apiFn("completeAppointment")(apptId, payload);

    const visit = normalizeVisit({
      date: appt.date,
      diagnoses: [...csState.diagnoses],
      medications: csState.medications.map((m) =>
        normalizeMedication({
          ...m,
          dose: payload.dose,
          form: payload.form,
          frequency: payload.frequency,
          timing: payload.timing,
          days: payload.days,
        }),
      ),
      notes: payload.notes,
      prescription: payload.diseaseDescription,
    });
    const consult = {
      id: DB.genId(),
      apptId,
      patientId: appt.patientId,
      ...visit,
    };

    const consultations = DB.get("consultations");
    consultations.push(consult);
    DB.set("consultations", consultations);
    addPatientVisit(consult);

    const appts = DB.get("appointments").map(normalizeAppointment);
    const idx = appts.findIndex((a) => a.id === apptId);
    if (idx >= 0) appts[idx].status = "Completed";
    DB.set("appointments", appts);

    try {
      await refreshAppointmentsFromApi();
    } catch (error) {
      console.warn("Appointment refresh after completion failed:", error);
    }

    flashConsultationSaved();
    toast("Appointment completed successfully.", "success");
    logConsultationActivity("Consultation saved successfully", "success");
    updatePendingBadge();
    if (currentAppPage === "dashboard") renderDashboard();
    if (currentAppPage === "calendar") renderCalendar();
    showApp("calendar");
  } catch (error) {
    toast(error?.message || "Failed to complete appointment.", "error");
  } finally {
    setConsultationSaveLoading(false);
  }
}

function setCondition() {}

document.addEventListener("DOMContentLoaded", () => {
  initConsultationCollapsibles();
  updateConsultationEmptyStates();
  const diagInput = document.getElementById("diagSearch");
  const drugInput = document.getElementById("drugSearch");
  if (diagInput)
    diagInput.addEventListener("keydown", (event) =>
      handleAutocompleteKeydown("diagnosis", event),
    );
  if (drugInput)
    drugInput.addEventListener("keydown", (event) =>
      handleAutocompleteKeydown("medication", event),
    );
});
