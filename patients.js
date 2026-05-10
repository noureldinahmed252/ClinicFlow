// ============================================================
// PATIENTS
// ============================================================

// 🎯 DEBOUNCED SEARCH
const debouncedRenderPatients = debounce(renderPatientsTable, 400);

function renderPatientsTable() {
  const patients = DB.get("patients").map(normalizePatient);
  const appts = DB.get("appointments").map(normalizeAppointment);
  const search = (
    document.getElementById("patientSearch")?.value || ""
  ).toLowerCase();

  const filtered = patients.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search) ||
      (p.phone || "").includes(search) ||
      (p.id || "").toLowerCase().includes(search),
  );

  const countLabel = document.getElementById("patientCountLabel");
  if (countLabel)
    countLabel.textContent = filtered.length
      ? `Showing ${filtered.length} of ${patients.length} patient${patients.length !== 1 ? "s" : ""}`
      : "";

  const tbody = document.getElementById("patientsBody");
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="icon">🔍</span><h3>No patients found</h3><p>Try a different search term or add a new patient</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((p, idx) => {
      const lastVisit =
        p.lastVisit ||
        appts
          .filter((a) => a.patientId === p.id)
          .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ||
        "";
      return `<tr style="animation-delay:${idx * 0.04}s;">
      <td><span class="row-num">${idx + 1}</span></td>
      <td>
        <div class="patient-cell">
          <div class="patient-initials">${getInitials(p.name || "")}</div>
          <div>
            <div class="patient-name">${valueOrDash(p.name)}</div>
            <div class="patient-id">#${(p.id || "").slice(-6)}</div>
          </div>
        </div>
      </td>
      <td>${valueOrDash(p.age)}y / <span style="text-transform:capitalize;">${valueOrDash(p.gender)}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:13px;">${valueOrDash(p.phone)}</td>
      <td>${p.bloodType ? `<span class="badge badge-confirmed">🩸 ${p.bloodType}</span>` : '<span style="color:var(--text-muted);">-</span>'}</td>
      <td>${lastVisit ? `<span style="font-size:12.5px;">${formatDate(lastVisit)}</span>` : '<span style="color:var(--text-muted);">-</span>'}</td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-secondary" onclick="viewPatient('${p.id}')" style="padding:6px 10px;font-size:12px;" title="View full record">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View
          </button>
          <button class="btn btn-ghost" onclick="openEditPatient('${p.id}')" style="padding:6px 10px;font-size:12px;" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger" onclick="deletePatient('${p.id}')" style="padding:6px 10px;font-size:12px;" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

function openAddPatient() {
  document.getElementById("patientModalTitle").textContent = "New Patient";
  document.getElementById("patientId").value = "";
  document.getElementById("patientForm").reset();
  openModal("patientModal");
}

function openEditPatient(id) {
  const rawPatient = DB.get("patients").find((x) => x.id === id);
  if (!rawPatient) return;
  const p = normalizePatient(rawPatient);
  const history = p.medicalHistory;
  document.getElementById("patientModalTitle").textContent =
    "Edit Patient — " + p.name;
  document.getElementById("patientId").value = p.id;
  document.getElementById("pName").value = p.name;
  document.getElementById("pAge").value = p.age;
  document.getElementById("pGender").value = p.gender;
  document.getElementById("pPhone").value = p.phone;
  document.getElementById("pCity").value = p.city || "";
  document.getElementById("pMarried").value = p.married ? "married" : "single";
  document.getElementById("pBlood").value = p.bloodType || "";
  document.getElementById("pHeight").value = p.height || "";
  document.getElementById("pWeight").value = p.weight || "";
  document.getElementById("pHypertension").checked = !!history.hypertension;
  document.getElementById("pDiabetes").checked = !!history.diabetes;
  document.getElementById("pAnaemia").checked = !!history.anaemia;
  document.getElementById("pChronic").value = p.chronic || "";
  document.getElementById("pNotes").value = p.notes || "";
  openModal("patientModal");
}

function showEditPatientModal(id) {
  openEditPatient(id);
}

function savePatient(e) {
  e.preventDefault();
  const id = document.getElementById("patientId").value;
  const patients = DB.get("patients").map(normalizePatient);
  const existing = id ? patients.find((x) => x.id === id) : null;
  const p = {
    id: id || nextPrefixedId("patients", "P"),
    name: document.getElementById("pName").value.trim(),
    age: toNumber(document.getElementById("pAge").value),
    gender: toGender(document.getElementById("pGender").value),
    phone: document.getElementById("pPhone").value.trim(),
    city: document.getElementById("pCity").value,
    married: document.getElementById("pMarried").value === "married",
    bloodType: document.getElementById("pBlood").value,
    height: toNumber(document.getElementById("pHeight").value),
    weight: toNumber(document.getElementById("pWeight").value),
    medicalHistory: {
      hypertension: document.getElementById("pHypertension").checked,
      diabetes: document.getElementById("pDiabetes").checked,
      anaemia: document.getElementById("pAnaemia").checked,
    },
    lastVisit: existing?.lastVisit || "",
    visits: existing?.visits || [],
    notes: document.getElementById("pNotes").value.trim(),
    chronic: document.getElementById("pChronic").value.trim(),
  };
  if (id) {
    const i = patients.findIndex((x) => x.id === id);
    if (i >= 0) patients[i] = p;
  } else {
    patients.push(p);
  }
  DB.set("patients", patients);
  closeModal("patientModal");
  toast(id ? "Patient updated!" : "Patient added!", "success");
  renderPatientsTable();
}

function saveEditedPatient(e) {
  savePatient(e);
}

function deletePatient(id) {
  if (!confirm("Delete this patient and all their data?")) return;
  const patients = DB.get("patients").filter((x) => x.id !== id);
  const appts = DB.get("appointments")
    .map(normalizeAppointment)
    .filter((a) => a.patientId !== id);
  const consultations = DB.get("consultations").filter(
    (c) => c.patientId !== id,
  );
  DB.set("patients", patients);
  DB.set("appointments", appts);
  DB.set("consultations", consultations);
  toast("Patient deleted", "info");
  renderPatientsTable();
}

function viewPatient(id) {
  const rawPatient = DB.get("patients").find((x) => x.id === id);
  const p = rawPatient ? normalizePatient(rawPatient) : null;
  const appts = DB.get("appointments")
    .map(normalizeAppointment)
    .filter((a) => a.patientId === id);
  const consultations = DB.get("consultations")
    .filter((c) => c.patientId === id)
    .map(normalizeVisit);
  if (!p) return;
  const visits = p.visits.length ? p.visits : consultations;

  const bmi = calcBMI(p.height, p.weight);
  const history = p.medicalHistory;
  const conditions = [];
  if (history.hypertension) conditions.push("Hypertension");
  if (history.diabetes) conditions.push("Diabetes");
  if (history.anaemia) conditions.push("Anaemia");

  document.getElementById("patientDetailsContent").innerHTML = `
    <div class="patient-detail-hero">
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        <div style="width:80px;height:80px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;color:white;">${getInitials(p.name || "")}</div>
        <div>
          <h2 style="font-family:'Fraunces',serif;font-size:28px;font-weight:700;">${valueOrDash(p.name)}</h2>
          <p style="color:#94a3b8;margin-top:4px;">${valueOrDash(p.age)} years · ${valueOrDash(p.gender)} · ${marriedLabel(p.married)} · ${valueOrDash(p.city)}</p>
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
            ${conditions.map((c) => `<span class="badge badge-pending">${c}</span>`).join("")}
            ${p.bloodType ? `<span class="badge badge-confirmed">🩸 ${p.bloodType}</span>` : ""}
            ${bmi ? `<span class="bmi-display ${bmi.cls}">${bmi.bmi} BMI — ${bmi.label}</span>` : ""}
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:10px;">
          <button class="btn btn-primary" onclick="openEditPatient('${p.id}');showApp('patients')">✏️ Edit</button>
          <button class="btn btn-success" onclick="openNewApptForPatient('${p.id}')">➕ Appointment</button>
        </div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-title">📞 Contact</div>
        <div class="info-item"><div class="info-icon">📱</div><div><div class="info-label">Phone</div><div class="info-value">${valueOrDash(p.phone)}</div></div></div>
        <div class="info-item"><div class="info-icon">📍</div><div><div class="info-label">City</div><div class="info-value">${valueOrDash(p.city)}</div></div></div>
        <div class="info-item"><div class="info-icon">💍</div><div><div class="info-label">Status</div><div class="info-value">${marriedLabel(p.married)}</div></div></div>
      </div>
      <div class="info-card">
        <div class="info-card-title">📏 Measurements</div>
        <div class="info-item"><div class="info-icon">📐</div><div><div class="info-label">Height</div><div class="info-value">${p.height ? p.height + " cm" : "-"}</div></div></div>
        <div class="info-item"><div class="info-icon">⚖️</div><div><div class="info-label">Weight</div><div class="info-value">${p.weight ? p.weight + " kg" : "-"}</div></div></div>
        <div class="info-item"><div class="info-icon">📊</div><div><div class="info-label">BMI</div><div class="info-value">${bmi ? `${bmi.bmi} (${bmi.label})` : "-"}</div></div></div>
      </div>
      <div class="info-card">
        <div class="info-card-title">🩺 Medical Info</div>
        <div class="info-item"><div class="info-icon">🩸</div><div><div class="info-label">Blood Type</div><div class="info-value">${valueOrDash(p.bloodType)}</div></div></div>
        <div class="info-item"><div class="info-icon">📋</div><div><div class="info-label">Conditions</div><div class="info-value">${conditions.join(", ") || "-"}</div></div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:24px;">
      <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;margin-bottom:16px;">📅 Appointment History (${appts.length})</div>
      ${
        appts.length
          ? appts
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(
                (a) => `
        <div class="appointment-item">
          <div class="appt-time" style="font-size:12px;min-width:55px;">${formatTime(a.time)}</div>
          <div class="appt-info">
            <div class="appt-name">${formatDate(a.date)}</div>
            <div class="appt-meta">${a.notes || "No notes"}</div>
          </div>
          ${badgeHtml(a.status)}
        </div>`,
              )
              .join("")
          : '<p style="color:var(--text-muted);">No appointments yet</p>'
      }
    </div>
    <div class="card">
      <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;margin-bottom:16px;">📋 Consultation Records (${visits.length})</div>
      ${
        visits.length
          ? visits
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
              .map(
                (c) => `
        <div class="visit-item">
          <div class="visit-date">${formatDate(c.date)}</div>
          <div class="visit-diagnosis">${(c.diagnoses || []).map((d) => d.name || d).join(", ") || "-"}</div>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
            ${(c.medications || []).map((m) => `<span class="badge badge-confirmed">💊 ${m.name}</span>`).join("")}
          </div>
          <div class="visit-condition" style="color:var(--text-muted);">${c.notes || ""}</div>
        </div>`,
              )
              .join("")
          : '<p style="color:var(--text-muted);">No consultations yet</p>'
      }
    </div>
  `;
  showApp("patientDetails");
}

function openPatientPage(id) {
  viewPatient(id);
}

function openNewApptForPatient(pid) {
  document.getElementById("apptModalTitle").textContent = "New Appointment";
  document.getElementById("apptId").value = "";
  document.getElementById("apptForm").reset();
  document.getElementById("apptDate").value = new Date()
    .toISOString()
    .slice(0, 10);
  populatePatientSelect("apptPatient", pid);
  populateClinicSelect("apptClinic");
  const firstClinic = DB.get("clinics").map((clinic, index) =>
    normalizeClinic(clinic, index),
  )[0];
  if (firstClinic)
    document.getElementById("apptClinic").value = firstClinic.clinicId;
  document.getElementById("apptDuration").value =
    firstClinic?.slotDurationMinutes || 30;
  document.getElementById("apptPrice").value = firstClinic?.doctorPrice || 0;
  syncApptStatusPicker("Pending");
  openModal("apptModal");
}
