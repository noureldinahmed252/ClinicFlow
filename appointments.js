// ============================================================
// CALENDAR
// ============================================================
function goToday() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  calSelectedDate = now.toISOString().slice(0, 10);
  renderCalendar();
}

function updateCalStats() {
  const currentDoctorId = getCurrentDoctorId();
  const appts = SafeDB.get("appointments").map(normalizeAppointment);
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const monthAppts = appts.filter((a) => a.date.startsWith(monthStr));
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl(
    "calStatPending",
    monthAppts.filter((a) => a.status === "Pending").length,
  );
  setEl(
    "calStatConfirmed",
    monthAppts.filter((a) => a.status === "Cancelled").length,
  );
  setEl(
    "calStatDone",
    monthAppts.filter((a) => a.status === "Completed").length,
  );
}

function renderCalendar() {
  const currentDoctorId = getCurrentDoctorId();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const grid = document.getElementById("calGrid");
  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const appts = SafeDB.get("appointments").map(normalizeAppointment);

  // 📈 PRE-INDEX APPOINTMENTS BY DATE (O(n))
  const apptsByDate = {};
  appts.forEach((a) => {
    if (!apptsByDate[a.date]) {
      apptsByDate[a.date] = [];
    }
    apptsByDate[a.date].push(a);
  });

  document.getElementById("calTitle").textContent = firstDay.toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  updateCalStats();

  let html = days
    .map((d) => `<div class="calendar-day-label">${d}</div>`)
    .join("");

  for (let i = 0; i < firstDay.getDay(); i++)
    html += `<div class="calendar-cell other-month"></div>`;

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayAppts = apptsByDate[dateStr] || []; // O(1) lookup instead of O(n)
    const isToday =
      d === today.getDate() &&
      calMonth === today.getMonth() &&
      calYear === today.getFullYear();
    const isSelected = dateStr === calSelectedDate;
    const dow = new Date(calYear, calMonth, d).getDay();
    const isWeekend = dow === 5 || dow === 6; // Fri/Sat
    const statuses = [...new Set(dayAppts.map((a) => statusKey(a.status)))];

    let dotsHtml = "";
    if (dayAppts.length === 1) {
      dotsHtml = '<div class="dot"></div>';
    } else if (dayAppts.length > 1) {
      const colors = statuses.slice(0, 3).map(
        (s) =>
          ({
            pending: "var(--warning)",
            completed: "var(--purple)",
            cancelled: "var(--danger)",
          })[s] || "var(--primary)",
      );
      dotsHtml = `<div class="dot-multi">${colors.map((c) => `<div class="dot-mini" style="background:${c};"></div>`).join("")}</div>`;
    }

    html += `<div class="calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isWeekend && !isToday ? "weekend" : ""}"
      onclick="selectCalDate('${dateStr}')"
      ${dayAppts.length ? `data-tip="${dayAppts.length} appt${dayAppts.length > 1 ? "s" : ""}"` : ""}>
      ${d}${dotsHtml}
    </div>`;
  }

  grid.innerHTML = html;
  renderCalAppts();
}

function selectCalDate(d) {
  calSelectedDate = d === calSelectedDate ? null : d;
  renderCalendar();
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
}

function renderCalAppts() {
  const currentDoctorId = getCurrentDoctorId();
  const appts = SafeDB.get("appointments").map(normalizeAppointment);
  const patients = SafeDB.get("patients").map(normalizePatient);
  const filtered = calSelectedDate
    ? appts.filter((a) => a.date === calSelectedDate)
    : appts.filter((a) =>
        a.date.startsWith(
          `${calYear}-${String(calMonth + 1).padStart(2, "0")}`,
        ),
      );

  document.getElementById("calSelectedLabel").textContent = calSelectedDate
    ? formatDate(calSelectedDate)
    : "This Month";

  const countEl = document.getElementById("calApptCount");
  if (countEl)
    countEl.textContent = filtered.length
      ? `${filtered.length} appointment${filtered.length !== 1 ? "s" : ""}`
      : "";

  const list = document.getElementById("calApptList");
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px 0;">
      <span class="icon">📅</span>
      <h3>${calSelectedDate ? "No appointments this day" : "No appointments this month"}</h3>
      <p>Click a day or add a new appointment</p>
    </div>`;
    return;
  }

  const sorted = filtered.sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );
  const statusColors = {
    Pending: {
      border: "var(--warning)",
      bg: "var(--warning-light)",
      text: "var(--warning)",
    },
    Completed: {
      border: "var(--purple)",
      bg: "var(--purple-light)",
      text: "var(--purple)",
    },
    Cancelled: {
      border: "var(--danger)",
      bg: "var(--danger-light)",
      text: "var(--danger)",
    },
  };

  list.innerHTML = sorted
    .map((a, idx) => {
      const p = patients.find((x) => x.id === a.patientId);
      if (!p) return "";
      const sc = statusColors[a.status] || statusColors.Pending;
      const gradients = [
        "#0ea5e9,#0284c7",
        "#10b981,#059669",
        "#8b5cf6,#7c3aed",
        "#f59e0b,#d97706",
        "#ef4444,#dc2626",
      ];
      const grad = gradients[idx % gradients.length];
      const apptIdArg = escapeJsString(a.id);
      const safeInitials = escapeHtml(getInitials(p.name));
      const safePatientName = escapeHtml(valueOrDash(p.name));
      const safeAge = escapeHtml(valueOrDash(p.age));
      const safeGender = escapeHtml(valueOrDash(p.gender));
      const safeClinicName = escapeHtml(valueOrDash(a.clinicName));
      const safeStatus = escapeHtml(a.status);
      const safeDatePrefix = !calSelectedDate
        ? `${escapeHtml(formatDate(a.date))}  ·  `
        : "";
      const safeNotes = escapeHtml(a.notes);

      return `<div class="cal-appt-card" style="animation-delay:${idx * 0.05}s;border-left-color:${sc.border};" data-status="${statusKey(a.status)}">
      <!-- Time + Avatar row -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div class="cal-appt-time">${formatTime(a.time)}</div>
        <div class="cal-appt-avatar" style="background:linear-gradient(135deg,${grad});">${safeInitials}</div>
        <div style="flex:1;min-width:0;">
          <div class="cal-appt-name">${safePatientName}</div>
          <div class="cal-appt-date">${safeDatePrefix}${safeAge}y · ${safeGender} · ${safeClinicName}</div>
        </div>
        <span class="cal-appt-badge" style="background:${sc.bg};color:${sc.text};">${safeStatus}</span>
      </div>
      <!-- Notes -->
      ${a.notes ? `<div class="cal-appt-notes">${safeNotes}</div>` : ""}
      <!-- Actions -->
      <div class="cal-appt-actions">
        ${
          a.status === "Pending"
            ? `
          <button class="cal-action-btn cal-action-consult" onclick="startConsultation('${apptIdArg}')" data-tip="Start consultation">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Consult
          </button>`
            : `<span class="cal-done-tag">${a.status === "Completed" ? "✓ Completed" : "Unavailable"}</span>`
        }
        <button class="cal-action-btn" onclick="editAppt('${apptIdArg}')" data-tip="Edit">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="cal-action-btn cal-action-del" onclick="deleteAppt('${apptIdArg}')" data-tip="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
    })
    .join("");
}

// APPOINTMENTS
// ============================================================
// Status picker helper
function setApptStatus(btn, val) {
  document
    .querySelectorAll(".appt-status-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("apptStatus").value = normalizeAppointmentStatus(val);
}

function syncApptStatusPicker(status) {
  const normalized = normalizeAppointmentStatus(status);
  document.querySelectorAll(".appt-status-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.val === normalized);
  });
  document.getElementById("apptStatus").value = normalized;
}

function populateClinicSelect(selId, selectedId = "") {
  const clinics = DB.get("clinics").map((clinic, index) =>
    normalizeClinic(clinic, index),
  );
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML =
    '<option value="">-- Choose clinic --</option>' +
    clinics
      .map(
        (c) =>
          `<option value="${escapeHtml(c.clinicId)}" ${String(c.clinicId) === String(selectedId) ? "selected" : ""}>${escapeHtml(valueOrDash(c.clinicName))}</option>`,
      )
      .join("");
}

function syncClinicAppointmentDefaults() {
  const clinics = DB.get("clinics").map((clinic, index) =>
    normalizeClinic(clinic, index),
  );
  const clinicId = toClinicId(document.getElementById("apptClinic")?.value);
  const clinic = clinics.find((c) => c.clinicId === clinicId);
  if (!clinic) return;
  const durationEl = document.getElementById("apptDuration");
  const priceEl = document.getElementById("apptPrice");
  if (durationEl && !durationEl.value)
    durationEl.value = clinic.slotDurationMinutes || 30;
  if (priceEl && !priceEl.value) priceEl.value = clinic.doctorPrice || 0;
}

function openNewAppointment() {
  document.getElementById("apptModalTitle").textContent = "New Appointment";
  document.getElementById("apptId").value = "";
  document.getElementById("apptForm").reset();
  document.getElementById("apptDate").value = new Date()
    .toISOString()
    .slice(0, 10);
  populatePatientSelect("apptPatient");
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

function editAppt(id) {
  const currentDoctorId = getCurrentDoctorId();
  if (!currentDoctorId) {
    toast("User not logged in.", "error");
    return;
  }
  const appts = SafeDB.get("appointments").map(normalizeAppointment);
  const a = appts.find((x) => x.id === id && x.doctorId === currentDoctorId);
  if (!a) {
    toast("Appointment not found or access denied.", "warning");
    return;
  }
  document.getElementById("apptModalTitle").textContent = "Edit Appointment";
  document.getElementById("apptId").value = a.id;
  populatePatientSelect("apptPatient", a.patientId);
  populateClinicSelect("apptClinic", a.clinicId);
  document.getElementById("apptDate").value = a.date;
  document.getElementById("apptTime").value = a.time;
  document.getElementById("apptDuration").value = a.durationMinutes;
  document.getElementById("apptPrice").value = a.price;
  document.getElementById("apptNotes").value = a.notes || "";
  syncApptStatusPicker(a.status || "Pending");
  openModal("apptModal");
}

function timeToMinutes(time) {
  // Use TimeValidator for safe conversion
  const minutes = TimeValidator.toMinutes(time);
  return minutes !== null ? minutes : 0;
}

function appointmentsOverlap(a, b) {
  // Use TimeValidator for safe overlap checking
  return TimeValidator.doOverlap(
    a.time,
    a.durationMinutes || 30,
    b.time,
    b.durationMinutes || 30,
  );
}

function hasAppointmentConflict(appt, existingId = "") {
  // Validate time first
  if (!TimeValidator.isValid(appt.time)) {
    console.warn("⚠️ Invalid appointment time:", appt.time);
    return false; // Invalid time, can't check conflict
  }

  const currentDoctorId = getCurrentDoctorId();
  const conflicts = SafeDB.get("appointments")
    .map(normalizeAppointment)
    .filter(
      (existing) =>
        existing.id !== existingId &&
        existing.status !== "Cancelled" &&
        existing.clinicId === appt.clinicId &&
        existing.date === appt.date &&
        existing.doctorId === currentDoctorId,
    )
    .filter((existing) => appointmentsOverlap(existing, appt));

  return conflicts.length > 0;
}

function saveAppointment(e) {
  e.preventDefault();
  const id = document.getElementById("apptId").value;
  const currentDoctorId = getCurrentDoctorId();
  if (!currentDoctorId) {
    toast("User not logged in.", "error");
    return;
  }
  const existing = id
    ? SafeDB.get("appointments")
        .map(normalizeAppointment)
        .find((a) => a.id === id && a.doctorId === currentDoctorId)
    : null;
  const patientId = document.getElementById("apptPatient").value;
  const clinicId = toClinicId(document.getElementById("apptClinic").value);
  const patient = SafeDB.get("patients")
    .map(normalizePatient)
    .find((p) => p.id === patientId && p.doctorId === currentDoctorId);
  const clinic = DB.get("clinics")
    .map((c, index) => normalizeClinic(c, index))
    .find((c) => c.clinicId === clinicId);

  // ⏰ VALIDATE TIME FIRST
  const timeValue = document.getElementById("apptTime").value;
  if (!TimeValidator.isValid(timeValue)) {
    toast("Invalid appointment time format. Please use HH:MM format.", "error");
    return;
  }

  const appt = normalizeAppointment({
    id: id || nextPrefixedId("appointments", "A"),
    doctorId: currentDoctorId,
    patientId,
    clinicId,
    patientName: patient?.name || "",
    clinicName: clinic?.clinicName || "",
    date: document.getElementById("apptDate").value,
    time: timeValue,
    status: document.getElementById("apptStatus").value,
    durationMinutes: document.getElementById("apptDuration").value,
    price: document.getElementById("apptPrice").value,
    notes: document.getElementById("apptNotes").value.trim(),
  });

  if (hasAppointmentConflict(appt, id)) {
    toast(
      "This clinic already has an overlapping appointment at that time.",
      "error",
    );
    return;
  }

  const appts = SafeDB.get("appointments").map(normalizeAppointment);
  if (id) {
    const i = appts.findIndex(
      (x) => x.id === id && x.doctorId === currentDoctorId,
    );
    if (i >= 0) appts[i] = appt;
  } else {
    appts.push(appt);
  }
  SafeDB.set("appointments", appts);
  syncPatientLastVisit(appt.patientId);
  if (existing?.patientId && existing.patientId !== appt.patientId)
    syncPatientLastVisit(existing.patientId);
  closeModal("apptModal");
  toast(id ? "Appointment updated!" : "Appointment added!", "success");
  updatePendingBadge();
  if (currentAppPage === "dashboard") renderDashboard();
  if (currentAppPage === "calendar") renderCalendar();
}

function deleteAppt(id) {
  if (!confirm("Delete this appointment?")) return;
  const currentDoctorId = getCurrentDoctorId();
  if (!currentDoctorId) {
    toast("User not logged in.", "error");
    return;
  }
  const deleted = SafeDB.get("appointments")
    .map(normalizeAppointment)
    .find((x) => x.id === id);
  // 🔐 Only delete if appointment belongs to current doctor
  if (!deleted || deleted.doctorId !== currentDoctorId) {
    toast("Cannot delete: appointment not found or access denied.", "warning");
    return;
  }
  const appts = SafeDB.get("appointments")
    .map(normalizeAppointment)
    .filter((x) => x.id !== id);
  SafeDB.set("appointments", appts);
  if (deleted?.patientId) syncPatientLastVisit(deleted.patientId);
  toast("Appointment deleted", "info");
  updatePendingBadge();
  if (currentAppPage === "dashboard") renderDashboard();
  if (currentAppPage === "calendar") renderCalendar();
}

function populatePatientSelect(selId, selectedId = "") {
  const currentDoctorId = getCurrentDoctorId();
  const patients = SafeDB.get("patients").map(normalizePatient);
  const sel = document.getElementById(selId);
  sel.innerHTML =
    '<option value="">-- Select Patient --</option>' +
    patients
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(valueOrDash(p.name))} (${escapeHtml(valueOrDash(p.age))}y)</option>`,
      )
      .join("");
}
