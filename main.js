// ============================================================
// DATA LAYER — localStorage with proper validation
// ============================================================
const DB = {
  get(key, def = []) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? def;
    } catch {
      return def;
    }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
  genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
};

function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nextPrefixedId(key, prefix) {
  const items = DB.get(key);
  const next =
    items.reduce((max, item) => {
      const match = String(item.id || "").match(/\d+/);
      return match ? Math.max(max, Number(match[0])) : max;
    }, 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function nextNumericId(key) {
  return (
    DB.get(key).reduce((max, item) => {
      const value = Number(item.id ?? item.clinicId);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1
  );
}

function unpackApiResponse(response) {
  if (Array.isArray(response)) return response;
  return (
    response?.data?.data ??
    response?.data ??
    response?.result ??
    response ??
    null
  );
}

function extractDoctorId(response) {
  const data = unpackApiResponse(response) || {};
  return (
    data.doctorId ??
    data.id ??
    data.userId ??
    data.doctor?.doctorId ??
    data.doctor?.id ??
    response?.doctorId ??
    response?.data?.doctorId ??
    response?.data?.doctor?.id ??
    localStorage.getItem("doctorId") ??
    null
  );
}

function normalizeApiArray(response) {
  const data = unpackApiResponse(response);
  if (data && typeof data === "object") {
    for (const key of [
      "items",
      "diseases",
      "medications",
      "drugs",
      "appointments",
      "clinics",
    ]) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return Array.isArray(data) ? data : [];
}

const API_LAYER = {};
[
  "apiLogin",
  "apiSignup",
  "apiLogout",
  "getProfileData",
  "apiUpdateProfile",
  "getDoctorImage",
  "uploadDoctorProfileImage",
  "getDoctorAppointments",
  "getMyDiseasesAndMedicines",
  "completeAppointment",
  "getMyClinics",
  "createClinic",
  "updateClinic",
  "deleteClinic",
].forEach((name) => {
  if (typeof window[name] === "function")
    API_LAYER[name] = window[name].bind(window);
});

function apiFn(name) {
  return (
    API_LAYER[name] ||
    (typeof window[name] === "function" ? window[name] : null)
  );
}

function toGender(value) {
  const gender = String(value || "").toLowerCase();
  if (["male", "m", "ذكر"].includes(gender)) return "Male";
  if (["female", "f", "انثى", "أنثى"].includes(gender)) return "Female";
  return "";
}

function toMarried(value) {
  if (typeof value === "boolean") return value;
  return ["married", "true", "1", "yes"].includes(
    String(value || "").toLowerCase(),
  );
}

function marriedLabel(value) {
  if (value === true) return "married";
  if (value === false) return "single";
  return "-";
}

function toMedicalHistory(patient = {}) {
  const history = patient.medicalHistory || {};
  return {
    hypertension: toBooleanFlag(history.hypertension ?? patient.hypertension),
    diabetes: toBooleanFlag(history.diabetes ?? patient.diabetes),
    anaemia: toBooleanFlag(history.anaemia ?? patient.anaemia),
  };
}

function firstValue(...values) {
  return (
    values.find(
      (value) => value !== undefined && value !== null && value !== "",
    ) ?? ""
  );
}

function toBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n", ""].includes(normalized)) return false;
  return false;
}

function normalizeSeverity(value) {
  const severity = String(value || "").toLowerCase();
  if (["high", "severe", "critical"].includes(severity)) return "severe";
  if (["medium", "moderate", "acute", "chronic"].includes(severity))
    return "moderate";
  return "mild";
}

function normalizeDiagnosis(item = {}) {
  if (typeof item === "string")
    return { id: "", name: item, severity: "moderate" };
  return {
    id: item.id ?? item.diseaseId ?? "",
    name: item.name || item.diseasesName || item.diseaseName || "",
    severity: normalizeSeverity(item.severity ?? item.diseaseSeverity),
  };
}

function normalizeMedication(item = {}) {
  const timing = firstValue(item.timing, item.medicationTiming);
  return {
    id: item.id ?? item.medicineId ?? item.medicationId ?? "",
    name:
      item.name ||
      item.medicineName ||
      item.medicationName ||
      item.drugName ||
      "",
    dose: item.dose || "",
    form: item.form || "",
    frequency: item.frequency || item.freq || "",
    timing: timing || "",
    days: toNumber(item.days ?? item.duration, 0),
    quantity: toNumber(item.quantity, 0),
  };
}

function normalizeRedFlag(item = {}) {
  if (typeof item === "string") return { name: item, description: "" };
  return {
    name: item.name || "",
    description: item.description || item.category || "",
  };
}

function normalizeVisit(visit = {}) {
  return {
    date: visit.date || "",
    diagnoses: Array.isArray(visit.diagnoses)
      ? visit.diagnoses.map(normalizeDiagnosis)
      : [],
    medications: Array.isArray(visit.medications)
      ? visit.medications.map(normalizeMedication)
      : [],
    redFlags: Array.isArray(visit.redFlags)
      ? visit.redFlags.map(normalizeRedFlag)
      : [],
    notes: visit.notes || "",
    prescription: visit.prescription || "",
  };
}

function normalizePatient(patient = {}) {
  const nested = patient.patient || {};
  const patientId = firstValue(
    patient.patientId,
    patient.id,
    nested.patientId,
    nested.id,
  );
  return {
    id: String(patientId || DB.genId()),
    name: firstValue(
      patient.name,
      patient.patientName,
      nested.name,
      nested.patientName,
      nested.fullName,
    ),
    age: toNumber(
      firstValue(
        patient.age,
        patient.patientAge,
        nested.age,
        nested.patientAge,
      ),
    ),
    gender: toGender(
      firstValue(
        patient.gender,
        patient.patientGender,
        nested.gender,
        nested.patientGender,
      ),
    ),
    phone: firstValue(
      patient.phone,
      patient.patientPhone,
      nested.phone,
      nested.patientPhone,
    ),
    city: firstValue(
      patient.city,
      patient.patientCity,
      nested.city,
      nested.patientCity,
    ),
    married: toMarried(
      firstValue(
        patient.married,
        patient.patientMarried,
        nested.married,
        nested.patientMarried,
      ),
    ),
    bloodType: firstValue(
      patient.bloodType,
      patient.patientBloodType,
      patient.patientBloodtype,
      patient.blood,
      nested.bloodType,
      nested.patientBloodtype,
    ),
    height: toNumber(
      firstValue(
        patient.height,
        patient.patientHeight,
        nested.height,
        nested.patientHeight,
      ),
    ),
    weight: toNumber(
      firstValue(
        patient.weight,
        patient.patientWeight,
        nested.weight,
        nested.patientWeight,
      ),
    ),
    chronic: firstValue(
      patient.chronic,
      patient.patientChronic,
      patient.allergies,
      patient.patientAllergies,
      nested.chronic,
      nested.patientChronic,
      nested.allergies,
    ),
    medicalHistory: toMedicalHistory({
      ...nested,
      ...patient,
      hypertension: firstValue(
        patient.hypertension,
        patient.patientHypertension,
        nested.hypertension,
        nested.patientHypertension,
      ),
      diabetes: firstValue(
        patient.diabetes,
        patient.patientDiabetes,
        nested.diabetes,
        nested.patientDiabetes,
      ),
      anaemia: firstValue(
        patient.anaemia,
        patient.patientAnaemia,
        nested.anaemia,
        nested.patientAnaemia,
      ),
    }),
    visits: Array.isArray(patient.visits)
      ? patient.visits.map(normalizeVisit)
      : [],
    lastVisit: firstValue(
      patient.lastVisit,
      patient.appointmentDate,
      patient.date,
    ),
    notes: firstValue(
      patient.notes,
      patient.patientNotes,
      nested.notes,
      nested.patientNotes,
    ),
  };
}

function toTimeValue(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (!Number.isFinite(hours)) return "";
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function toClinicId(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function toWorkingDaysArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
}

function normalizeClinic(clinic = {}, index = 0) {
  const workingDays = toWorkingDaysArray(clinic.workingDays);
  const fallbackId = index + 1 || nextNumericId("clinics");
  return {
    clinicId: toClinicId(clinic.clinicId ?? clinic.id, fallbackId),
    clinicName: clinic.clinicName || clinic.name || "",
    clinicPhone: clinic.clinicPhone || clinic.phone || "",
    clinicEmail: clinic.clinicEmail || clinic.email || "",
    location: clinic.location || clinic.address || "",
    workingDays: workingDays.join(","),
    workStartTime: toTimeValue(clinic.workStartTime || clinic.startTime),
    workEndTime: toTimeValue(clinic.workEndTime || clinic.endTime),
    doctorPrice: toNumber(
      clinic.doctorPrice ?? clinic.consultationFee ?? clinic.fee,
    ),
    slotDurationMinutes: toNumber(
      clinic.slotDurationMinutes ?? clinic.consultationDuration,
      30,
    ),
  };
}

function normalizeAppointmentStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["completed", "complete", "done"].includes(value)) return "Completed";
  if (["cancelled", "canceled"].includes(value)) return "Cancelled";
  return "Pending";
}

function statusKey(status) {
  return normalizeAppointmentStatus(status).toLowerCase();
}

function normalizeAppointment(appt = {}) {
  const patients = DB.get("patients").map(normalizePatient);
  const clinics = DB.get("clinics").map((clinic, index) =>
    normalizeClinic(clinic, index),
  );
  const nestedPatient = appt.patient || {};
  const appointmentId = firstValue(appt.id, appt.appointmentId);
  const patientId = String(
    firstValue(appt.patientId, nestedPatient.patientId, nestedPatient.id),
  );
  const patient = patients.find((p) => p.id === patientId);
  const defaultClinic = clinics[0] || {};
  const clinicId = toClinicId(
    firstValue(appt.clinicId, appt.clinic?.clinicId, appt.clinic?.id),
    defaultClinic.clinicId || 0,
  );
  const clinic = clinics.find((c) => c.clinicId === clinicId) || defaultClinic;
  return {
    id: String(appointmentId || nextPrefixedId("appointments", "A")),
    patientId: String(patientId || ""),
    clinicId,
    patientName: firstValue(
      appt.patientName,
      patient?.name,
      nestedPatient.name,
      nestedPatient.patientName,
      nestedPatient.fullName,
    ),
    date: firstValue(appt.date, appt.appointmentDate),
    time: toTimeValue(
      firstValue(appt.time, appt.appointmentTime, appt.startTime),
    ),
    status: normalizeAppointmentStatus(appt.status),
    clinicName: firstValue(
      appt.clinicName,
      appt.clinic?.clinicName,
      appt.clinic?.name,
      clinic?.clinicName,
    ),
    durationMinutes: toNumber(
      appt.durationMinutes ?? appt.duration ?? clinic?.slotDurationMinutes,
      30,
    ),
    price: toNumber(appt.price ?? appt.fee ?? clinic?.doctorPrice, 0),
    notes: firstValue(appt.notes, appt.appointmentNotes),
  };
}

function normalizeDoctor(doctor = {}) {
  const doctorId = firstValue(
    doctor.doctorId,
    doctor.id,
    doctor.userId,
    doctor.doctor?.doctorId,
    doctor.doctor?.id,
  );
  const averageRating = toNumber(doctor.averageRating ?? doctor.rating, 0);
  const rawImage = firstValue(
    doctor.doctorImageUrl,
    doctor.image,
    doctor.doctorImage,
    doctor.photo,
    doctor.imageUrl,
  );
  const image =
    typeof apiAbsoluteUrl === "function" ? apiAbsoluteUrl(rawImage) : rawImage;
  return {
    id: doctorId,
    doctorId,
    name: firstValue(doctor.doctorName, doctor.name, doctor.fullName),
    email: firstValue(doctor.doctorEmail, doctor.email),
    phone: firstValue(doctor.doctorPhone, doctor.phone),
    city: firstValue(doctor.doctorCity, doctor.city, doctor.governorate),
    specialty: firstValue(doctor.specialtyName, doctor.specialty),
    certificate: doctor.certificate || "",
    licenseNumber: doctor.licenseNumber || doctor.license || "",
    nationalNumber: doctor.nationalNumber || doctor.nationalId || "",
    averageRating,
    consultationFee: toNumber(doctor.consultationFee ?? doctor.doctorPrice, 0),
    image,
    doctorImage: image,
    password: doctor.password || "",
  };
}

function createPatientFromApiAppointment(appt = {}, index = 0) {
  const nestedPatient = appt.patient || {};
  const patientId = firstValue(
    appt.patientId,
    nestedPatient.patientId,
    nestedPatient.id,
  );
  if (!patientId) return null;
  return normalizePatient({
    ...nestedPatient,
    id: patientId,
    patientId,
    name: firstValue(
      appt.patientName,
      nestedPatient.name,
      nestedPatient.patientName,
      nestedPatient.fullName,
    ),
    age: firstValue(
      appt.patientAge,
      nestedPatient.age,
      nestedPatient.patientAge,
    ),
    gender: firstValue(
      appt.patientGender,
      nestedPatient.gender,
      nestedPatient.patientGender,
    ),
    phone: firstValue(
      appt.patientPhone,
      nestedPatient.phone,
      nestedPatient.patientPhone,
    ),
    city: firstValue(
      appt.patientCity,
      nestedPatient.city,
      nestedPatient.patientCity,
    ),
    married: firstValue(
      appt.patientMarried,
      nestedPatient.married,
      nestedPatient.patientMarried,
    ),
    bloodType: firstValue(
      appt.patientBloodType,
      appt.patientBloodtype,
      nestedPatient.bloodType,
      nestedPatient.patientBloodtype,
    ),
    height: firstValue(
      appt.patientHeight,
      nestedPatient.height,
      nestedPatient.patientHeight,
    ),
    weight: firstValue(
      appt.patientWeight,
      nestedPatient.weight,
      nestedPatient.patientWeight,
    ),
    chronic: firstValue(
      appt.chronic,
      appt.patientChronic,
      nestedPatient.chronic,
      nestedPatient.patientChronic,
      nestedPatient.allergies,
    ),
    medicalHistory: {
      hypertension: firstValue(
        appt.patientHypertension,
        nestedPatient.hypertension,
        nestedPatient.patientHypertension,
      ),
      diabetes: firstValue(
        appt.patientDiabetes,
        nestedPatient.diabetes,
        nestedPatient.patientDiabetes,
      ),
      anaemia: firstValue(
        appt.patientAnaemia,
        nestedPatient.anaemia,
        nestedPatient.patientAnaemia,
      ),
    },
    lastVisit: firstValue(appt.appointmentDate, appt.date),
    notes: firstValue(
      appt.patientNotes,
      nestedPatient.notes,
      nestedPatient.patientNotes,
    ),
  });
}

function storeApiAppointments(apiAppointments = []) {
  const patients = DB.get("patients").map(normalizePatient);
  const appts = apiAppointments
    .map((appt, index) => {
      const apiPatient = createPatientFromApiAppointment(appt, index);
      if (apiPatient?.id) {
        const patientIndex = patients.findIndex((p) => p.id === apiPatient.id);
        if (patientIndex >= 0) {
          patients[patientIndex] = normalizePatient({
            ...patients[patientIndex],
            ...apiPatient,
            visits: patients[patientIndex].visits || [],
            lastVisit: apiPatient.lastVisit || patients[patientIndex].lastVisit,
          });
        } else {
          patients.push(apiPatient);
        }
      }
      return normalizeAppointment({
        ...appt,
        patientId:
          apiPatient?.id ||
          firstValue(appt.patientId, appt.patient?.patientId, appt.patient?.id),
      });
    })
    .filter((appt) => appt.id);
  DB.set("patients", patients);
  DB.set("appointments", appts);
}

async function refreshAppointmentsFromApi() {
  const apptLoader = apiFn("getDoctorAppointments");
  if (!apptLoader || !localStorage.getItem("authToken")) return false;
  const appointments = normalizeApiArray(await apptLoader());
  storeApiAppointments(appointments);
  return true;
}

async function syncApiAfterAuth(authResponse, credentials = {}) {
  const doctorId = extractDoctorId(authResponse);
  const profileLoader = apiFn("getProfileData");
  if (!doctorId || !profileLoader) {
    throw new Error("Doctor profile is unavailable. Please login again.");
  }

  localStorage.removeItem("doctor");
  const profile = await profileLoader(doctorId);
  const doctor = normalizeDoctor(unpackApiResponse(profile) || {});
  if (!doctor.id) doctor.id = doctor.doctorId = Number(doctorId) || doctorId;
  localStorage.setItem("doctorId", doctor.doctorId);
  DB.set("doctor", doctor);

  const clinicsLoader = apiFn("getMyClinics");
  if (clinicsLoader) {
    try {
      const clinics = normalizeApiArray(await clinicsLoader()).map(
        (clinic, index) => normalizeClinic(clinic, index),
      );
      DB.set("clinics", clinics);
    } catch (error) {
      console.warn("Clinic API sync failed:", error);
    }
  }

  if (apiFn("getDoctorAppointments")) {
    try {
      await refreshAppointmentsFromApi();
    } catch (error) {
      console.warn("Appointment API sync failed:", error);
    }
  }

  return doctor;
}

function latestPatientVisitDate(patientId) {
  const appts = DB.get("appointments").map(normalizeAppointment);
  const consultations = DB.get("consultations");
  const dates = [
    ...appts.filter((a) => a.patientId === patientId).map((a) => a.date),
    ...consultations
      .filter((c) => c.patientId === patientId)
      .map((c) => c.date),
  ].filter(Boolean);
  return dates.sort((a, b) => b.localeCompare(a))[0] || "";
}

function syncPatientLastVisit(patientId) {
  const patients = DB.get("patients").map(normalizePatient);
  const idx = patients.findIndex((p) => p.id === patientId);
  if (idx < 0) return;
  patients[idx].lastVisit = latestPatientVisitDate(patientId);
  DB.set("patients", patients);
}

function addPatientVisit(consult) {
  const patients = DB.get("patients").map(normalizePatient);
  const idx = patients.findIndex((p) => p.id === consult.patientId);
  if (idx < 0) return;
  const visit = normalizeVisit(consult);
  patients[idx].visits = [
    visit,
    ...patients[idx].visits.filter(
      (v) => v.date !== visit.date || v.notes !== visit.notes,
    ),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  patients[idx].lastVisit = consult.date || patients[idx].lastVisit;
  DB.set("patients", patients);
}

function migrateStoredData() {
  const consultations = DB.get("consultations");
  DB.set(
    "patients",
    DB.get("patients").map((patient) => {
      const normalized = normalizePatient(patient);
      if (!normalized.visits.length) {
        normalized.visits = consultations
          .filter((c) => c.patientId === normalized.id)
          .map(normalizeVisit);
      }
      normalized.lastVisit =
        normalized.lastVisit || latestPatientVisitDate(normalized.id);
      return normalized;
    }),
  );
  DB.set(
    "clinics",
    DB.get("clinics").map((clinic, index) => normalizeClinic(clinic, index)),
  );
  DB.set("appointments", DB.get("appointments").map(normalizeAppointment));
  DB.set(
    "consultations",
    consultations.map((consult) => ({
      id: consult.id || DB.genId(),
      apptId: consult.apptId || "",
      patientId: consult.patientId || "",
      ...normalizeVisit(consult),
    })),
  );
  const doctor = DB.get("doctor", null);
  if (doctor) DB.set("doctor", normalizeDoctor(doctor));
}

// ============================================================
// STATE
// ============================================================
let currentPage = "login";
let currentAppPage = "dashboard";
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;

// ============================================================
// NAVIGATION
// ============================================================
function showApp(page) {
  const pages = [
    "dashboard",
    "calendar",
    "patients",
    "profile",
    "consultation",
    "patientDetails",
  ];
  pages.forEach((p) => {
    const el = document.getElementById(
      "app" + p.charAt(0).toUpperCase() + p.slice(1),
    );
    if (el) el.classList.add("hidden");
  });

  const el = document.getElementById(
    "app" + page.charAt(0).toUpperCase() + page.slice(1),
  );
  if (el) el.classList.remove("hidden");
  currentAppPage = page;

  // Update nav active state
  document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  // Update topbar
  const titles = {
    dashboard: ["Dashboard", "Welcome back, Doctor"],
    calendar: ["Appointments", "Manage your schedule"],
    patients: ["Patients", "Your patient registry"],
    profile: ["My Profile", "Manage your account"],
    consultation: ["Consultation", "Patient examination"],
    patientDetails: ["Patient Details", "Full medical record"],
  };
  const t = titles[page] || ["—", ""];
  const titleEl = document.getElementById("topbarTitle");
  const subEl = document.getElementById("topbarSubtitle");
  titleEl.style.animation = "none";
  titleEl.offsetHeight;
  titleEl.style.animation = "";
  titleEl.textContent = t[0];

  // Typewriter for subtitle
  const subtitleText = page === "dashboard" ? getGreeting() : t[1];
  typewriterEffect(subEl, subtitleText, 28);

  resetPageScroll();
  updatePendingBadge();

  if (page === "dashboard") {
    renderDashboard();
    setTimeout(addRipples, 400);
  }
  if (page === "calendar") {
    renderCalendar();
    setTimeout(() => gsapRevealCards(".calendar-cell"), 100);
  }
  if (page === "patients") {
    renderPatientsTable();
    setTimeout(() => gsapRevealCards("tbody tr"), 80);
  }
  if (page === "profile") {
    renderProfile();
    setTimeout(() => gsapRevealCards(".info-card, .clinic-card"), 100);
  }

  // Add data-status to appointment items after render
  setTimeout(addApptDataStatus, 100);
}

function setAvatarContent(el, text) {
  const onlineDot = el.querySelector(".online-dot");
  el.textContent = text;
  if (onlineDot) el.appendChild(onlineDot);
}

function setDoctorAvatarImage(el, doc) {
  if (!el) return;
  const doctor = normalizeDoctor(doc);
  const initials = getInitials(doctor.name) || "DR";
  const showInitials = () => {
    el.style.backgroundImage = "none";
    setAvatarContent(el, initials);
  };

  if (!doctor.image) {
    showInitials();
    return;
  }

  const img = new Image();
  img.onload = () => {
    setAvatarContent(el, "");
    el.style.backgroundImage = `url("${doctor.image.replace(/"/g, "%22")}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  };
  img.onerror = showInitials;
  img.src = doctor.image;
}

function updateSidebarDoctor() {
  const doc = normalizeDoctor(DB.get("doctor", {}));
  document.getElementById("sidebarDoctorName").textContent =
    doc.name || "Doctor";
  document.getElementById("sidebarDoctorSpecialty").textContent =
    doc.specialty || "";
  setDoctorAvatarImage(document.querySelector(".doctor-avatar"), doc);
}

// ============================================================
// THEME
// ============================================================
let isDark = false;
let apptChart = null;
let condChart = null;

function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light",
  );
  // Keep checkbox in sync (in case called programmatically)
  const cb = document.getElementById("themeCheckboxTop");
  if (cb) cb.checked = isDark;
  // Redraw charts if on dashboard
  if (currentAppPage === "dashboard") setTimeout(renderCharts, 100);
}

// ============================================================
// CHARTS
// ============================================================
function getChartColors() {
  return {
    primary: "#0ea5e9",
    success: "#10b981",
    warning: "#f59e0b",
    purple: "#8b5cf6",
    danger: "#ef4444",
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    text: isDark ? "#7a90b0" : "#64748b",
  };
}

function renderCharts() {
  const appts = DB.get("appointments");
  const patients = DB.get("patients").map(normalizePatient);
  const c = getChartColors();
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  // — Appointments last 7 days —
  const days = [];
  const dayCounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const str = d.toISOString().slice(0, 10);
    days.push(
      d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
    );
    dayCounts.push(appts.filter((a) => a.date === str).length);
  }

  const appointmentData = {
    labels: days,
    datasets: [
      {
        data: dayCounts,
        backgroundColor: dayCounts.map((v, i) =>
          i === 6
            ? c.primary
            : isDark
              ? "rgba(14,165,233,0.25)"
              : "rgba(14,165,233,0.15)",
        ),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  // First time: create appointments chart
  if (!ChartManager.charts.appointments) {
    ChartManager.charts.appointments = ChartManager.initChart(
      "chartAppts",
      "bar",
      appointmentData,
      {
        ...chartDefaults,
        scales: {
          x: {
            grid: { color: c.grid },
            ticks: { color: c.text, font: { family: "DM Sans", size: 11 } },
          },
          y: {
            grid: { color: c.grid },
            ticks: {
              color: c.text,
              font: { family: "DM Sans", size: 11 },
              stepSize: 1,
            },
            beginAtZero: true,
          },
        },
      },
    );
  } else {
    // Update existing chart
    ChartManager.updateChart("appointments", appointmentData);
  }

  // — Patient Conditions Doughnut —
  const hyp = patients.filter((p) => p.medicalHistory.hypertension).length;
  const dia = patients.filter((p) => p.medicalHistory.diabetes).length;
  const ana = patients.filter((p) => p.medicalHistory.anaemia).length;
  const healthy = Math.max(0, patients.length - hyp - dia - ana);

  const conditionData = {
    labels: ["Hypertension", "Diabetes", "Anaemia", "Healthy"],
    datasets: [
      {
        data: [hyp, dia, ana, Math.max(healthy, patients.length ? 0 : 1)],
        backgroundColor: [c.danger, c.warning, c.purple, c.success],
        borderWidth: 2,
        borderColor: isDark ? "#111c2d" : "#ffffff",
        hoverOffset: 6,
      },
    ],
  };

  // First time: create conditions chart
  if (!ChartManager.charts.conditions) {
    ChartManager.charts.conditions = ChartManager.initChart(
      "chartConditions",
      "doughnut",
      conditionData,
      {
        ...chartDefaults,
        cutout: "68%",
        plugins: {
          legend: {
            display: true,
            position: "right",
            labels: {
              color: c.text,
              font: { family: "DM Sans", size: 11 },
              padding: 12,
              boxWidth: 12,
              borderRadius: 4,
            },
          },
        },
      },
    );
  } else {
    // Update existing chart
    ChartManager.updateChart("conditions", conditionData);
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const patients = DB.get("patients").map(normalizePatient);
  const appts = DB.get("appointments").map(normalizeAppointment);
  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter((a) => a.date === today);
  const pending = appts.filter((a) => a.status === "Pending");
  const done = appts.filter((a) => a.status === "Completed");

  animateCounter(document.getElementById("statTotalPatients"), patients.length);
  animateCounter(document.getElementById("statTodayAppts"), todayAppts.length);
  animateCounter(document.getElementById("statPending"), pending.length);
  animateCounter(document.getElementById("statDone"), done.length);

  document.getElementById("todayDateLabel").textContent =
    new Date().toLocaleDateString("en-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Welcome banner
  updateWelcomeBanner();

  // Render charts after a tick so canvas is visible
  setTimeout(renderCharts, 50);
  // GSAP reveal
  setTimeout(gsapRevealPage, 30);
  // Re-init tilt on quick action buttons
  setTimeout(initTilt, 200);

  const list = document.getElementById("dashTodayList");
  if (!todayAppts.length) {
    list.innerHTML =
      '<div class="empty-state"><div class="icon">📅</div><h3>No appointments today</h3><p>Your schedule is clear for today</p></div>';
    return;
  }
  list.innerHTML = todayAppts
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((a, idx) => {
      const p = patients.find((x) => x.id === a.patientId);
      if (!p) return "";
      return `<div class="appointment-item" data-status="${statusKey(a.status)}" style="animation-delay:${idx * 0.06}s;">
      <div class="appt-time">${formatTime(a.time)}</div>
      <div class="patient-initials" style="background:linear-gradient(135deg,${["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"][idx % 5]},${["#0284c7", "#059669", "#7c3aed", "#d97706", "#dc2626"][idx % 5]});">${getInitials(p.name)}</div>
      <div class="appt-info">
        <div class="appt-name">${valueOrDash(p.name)}</div>
        <div class="appt-meta">${valueOrDash(p.age)}y · ${valueOrDash(p.gender)} · ${valueOrDash(a.clinicName)} · ${a.notes || "No notes"}</div>
      </div>
      ${badgeHtml(a.status)}
      <div class="appt-actions">
        ${
          a.status === "Pending"
            ? `<button class="btn btn-success" onclick="startConsultation('${a.id}')" data-tip="Start consultation" style="padding:7px 12px;font-size:12px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Consult</button>`
            : `<span class="badge ${a.status === "Completed" ? "badge-done" : "badge-cancelled"}">${a.status === "Completed" ? "✓ Completed" : "Unavailable"}</span>`
        }
        <button class="btn btn-secondary" onclick="editAppt('${a.id}')" data-tip="Edit" style="padding:7px 10px;font-size:12px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-danger" onclick="deleteAppt('${a.id}')" data-tip="Delete" style="padding:7px 10px;font-size:12px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
    })
    .join("");
  setTimeout(addApptDataStatus, 50);
}

// Validate national ID on input
const niInput = document.getElementById("sNationalId");
if (niInput) {
  niInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 14);
    const err = document.getElementById("nationalIdError");
    if (err)
      err.classList.toggle(
        "hidden",
        this.value.length === 14 || this.value.length === 0,
      );
  });
}

// ============================================================
// 💎 PREMIUM FEATURES JS
// ============================================================

// 3. KEYBOARD SHORTCUT — N = New Appointment
document.addEventListener("keydown", (e) => {
  if (document.getElementById("mainApp")?.classList.contains("hidden")) return;
  // ignore if typing in an input
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  if (e.key === "n" || e.key === "N") openNewAppointment();
  if (e.key === "1") showApp("dashboard");
  if (e.key === "2") showApp("calendar");
  if (e.key === "3") showApp("patients");
  if (e.key === "4") showApp("profile");
});

// 5. PENDING BADGE — update on data change
function updatePendingBadge() {
  const appts = DB.get("appointments").map(normalizeAppointment);
  const pending = appts.filter((a) => a.status === "Pending").length;
  const badge = document.getElementById("pendingBadge");
  if (!badge) return;
  if (pending > 0) {
    badge.textContent = pending > 9 ? "9+" : pending;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

// 8. APPOINTMENT ITEMS — add data-status attribute
function addApptDataStatus() {
  document.querySelectorAll(".appointment-item").forEach((item) => {
    const badge = item.querySelector(".badge");
    if (!badge) return;
    const cls = badge.className;
    if (cls.includes("pending")) item.dataset.status = "pending";
    else if (cls.includes("done")) item.dataset.status = "completed";
    else if (cls.includes("cancelled")) item.dataset.status = "cancelled";
  });
}

// 10. AUTO GREETING in topbar subtitle
function getGreeting() {
  const h = new Date().getHours();
  const doc = normalizeDoctor(DB.get("doctor", {}));
  const name = (doc.name || "Doctor").split(" ").slice(0, 2).join(" ");
  if (h < 12) return `Good morning, ${name} ☀️`;
  if (h < 17) return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 🌙`;
}

// ============================================================
// ⌨️ KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener("keydown", (e) => {
  if (document.getElementById("mainApp")?.classList.contains("hidden")) return;
  const tag = e.target.tagName;
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    showApp("patients");
    setTimeout(() => document.getElementById("patientSearch")?.focus(), 200);
    return;
  }
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      openNewAppointment();
    }
    if (e.key === "1") showApp("dashboard");
    if (e.key === "2") showApp("calendar");
    if (e.key === "3") showApp("patients");
    if (e.key === "4") showApp("profile");
    if (e.key === "Escape")
      document
        .querySelectorAll(".modal-overlay:not(.hidden)")
        .forEach((m) => m.classList.add("hidden"));
  }
});

// ============================================================
// 📊 WELCOME BANNER
// ============================================================
function updateWelcomeBanner() {
  const patients = DB.get("patients").map(normalizePatient);
  const appts = DB.get("appointments").map(normalizeAppointment);
  const today = new Date().toISOString().slice(0, 10);
  const todayA = appts.filter((a) => a.date === today);
  const done = appts.filter((a) => a.status === "Completed");
  const doc = normalizeDoctor(DB.get("doctor", {}));
  const firstName =
    (doc.name || "Doctor").replace(/^Dr\.?\s*/i, "").split(" ")[0] || "Doctor";
  const h = new Date().getHours();
  const greeting =
    h < 12
      ? `Good morning, ${firstName}! ☀️`
      : h < 17
        ? `Good afternoon, ${firstName}! 👋`
        : `Good evening, ${firstName}! 🌙`;

  const wbTitle = document.getElementById("wbTitle");
  if (wbTitle) wbTitle.textContent = greeting;
  const wbSub = document.getElementById("wbSub");
  if (wbSub)
    wbSub.textContent = todayA.length
      ? `You have ${todayA.length} appointment${todayA.length > 1 ? "s" : ""} today`
      : "Your schedule is clear today ✓";
  const wbDate = document.getElementById("wbDate");
  if (wbDate)
    wbDate.textContent = new Date().toLocaleDateString("en-EG", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  animateCountUp("wbPatients", patients.length);
  animateCountUp("wbToday", todayA.length);
  animateCountUp("wbDone", done.length);
}
// ============================================================
// INIT
// ============================================================
migrateStoredData();
spawnParticles("loginParticles");
spawnParticles("signupParticles");

document.getElementById("loginEmail").placeholder = "doctor@example.com";
document.getElementById("loginPassword").placeholder = "Enter your password";
