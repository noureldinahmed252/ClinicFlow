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
      el.innerHTML = `<div class="cs-inline-state ${type}">${message}</div>`;
    }
  });
}

function clearLookupHints() {
  ["selectedDiagnoses", "selectedMeds"].forEach((id) => {
    const el = document.getElementById(id);
    if (el?.querySelector(".cs-inline-state")) el.innerHTML = "";
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
  ["selectedDiagnoses", "selectedMeds"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
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
    const vitals = [
      {
        icon: "kg",
        val: patient.weight ? `${patient.weight} kg` : "-",
        lbl: "Weight",
        bg: "#dbeafe",
      },
      {
        icon: "cm",
        val: patient.height ? `${patient.height} cm` : "-",
        lbl: "Height",
        bg: "#dcfce7",
      },
      {
        icon: "BMI",
        val: bmi ? bmi.bmi : "-",
        lbl: `BMI - ${bmi ? bmi.label : ""}`,
        bg: bmi
          ? {
              normal: "#dcfce7",
              overweight: "#fef9c3",
              obese: "#fee2e2",
              underweight: "#ede9fe",
            }[bmi.cls.replace("bmi-", "")]
          : "#f1f5f9",
      },
      {
        icon: "BT",
        val: patient.bloodType || "-",
        lbl: "Blood Type",
        bg: "#fee2e2",
      },
    ];
    vitalsEl.innerHTML = vitals
      .map(
        (v) => `
      <div class="cs-vital-item">
        <div class="cs-vital-icon" style="background:${v.bg};">${v.icon}</div>
        <div>
          <div class="cs-vital-val">${v.val}</div>
          <div class="cs-vital-lbl">${v.lbl}</div>
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
      <span>${d.name}</span><span class="severity-dot"></span><button class="remove" onclick="removeDiagnosis('${jsArg(d.id)}')">x</button>
    </span>`,
    )
    .join("");
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
  csState.medications.push({ id: medicine.id, name: medicine.name });
  renderMeds();
  csState.selectedMedicine = null;
  document.getElementById("drugSearch").value = "";
}

function removeMedication(index) {
  csState.medications.splice(index, 1);
  renderMeds();
}

function renderMeds() {
  const container = document.getElementById("selectedMeds");
  if (!container) return;
  container.innerHTML = csState.medications
    .map(
      (m, i) => `
    <div class="cs-med-card" style="animation:fade-up 0.2s ease both;">
      <div class="cs-med-header">
        <div class="cs-med-icon">Rx</div>
        <div class="cs-med-name">${m.name}</div>
        <button type="button" class="cs-med-remove" onclick="removeMedication(${i})" title="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);">Uses the shared medication details below.</div>
    </div>`,
    )
    .join("");
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

async function saveConsultation(e) {
  e.preventDefault();
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

  const submitBtn = e.target.querySelector('button[type="submit"]');
  setAuthLoading(submitBtn, true);

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

    toast("Appointment completed successfully.", "success");
    updatePendingBadge();
    if (currentAppPage === "dashboard") renderDashboard();
    if (currentAppPage === "calendar") renderCalendar();
    showApp("calendar");
  } catch (error) {
    toast(error?.message || "Failed to complete appointment.", "error");
  } finally {
    setAuthLoading(submitBtn, false);
  }
}

function setCondition() {}

document.addEventListener("DOMContentLoaded", () => {
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
