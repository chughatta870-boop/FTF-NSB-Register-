/* ===================== CONFIG ===================== */
const CLASSES = ["Kachi","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"];
const FTF_RATE = 20;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LS_FTF = "ftfRecords";
const LS_NSB = "nsbRecords";

/* ===================== STATE ===================== */
let currentMonth, currentYear;

/* ===================== INIT ===================== */
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  currentMonth = now.getMonth() + 1;
  currentYear = now.getFullYear();

  populatePeriodPickers();
  buildFTFRows();
  addExpenseRow(); // start NSB with one blank expense row
  wireTabs();
  wireGlobalInputs();
  updatePeriodLabels();
  calculateFTF();
  calculateNSB();
  renderHistory("ftf");
  registerServiceWorker();
});

function populatePeriodPickers(){
  const monthSel = document.getElementById("periodMonth");
  MONTH_NAMES.forEach((m,i)=>{
    const opt = document.createElement("option");
    opt.value = i+1;
    opt.textContent = m;
    monthSel.appendChild(opt);
  });
  monthSel.value = currentMonth;
  document.getElementById("periodYear").value = currentYear;

  monthSel.addEventListener("change", ()=>{ currentMonth = parseInt(monthSel.value); updatePeriodLabels(); });
  document.getElementById("periodYear").addEventListener("input", (e)=>{
    currentYear = parseInt(e.target.value) || currentYear;
    updatePeriodLabels();
  });
}

function updatePeriodLabels(){
  const label = `${MONTH_NAMES[currentMonth-1]} ${currentYear}`;
  document.getElementById("ftfPeriodLabel").textContent = label;
  document.getElementById("nsbPeriodLabel").textContent = label;
}

function wireGlobalInputs(){
  document.getElementById("schoolName").addEventListener("input", (e)=>{
    document.getElementById("ftfSchoolLabel").textContent = e.target.value || "School";
    document.getElementById("nsbSchoolLabel").textContent = e.target.value || "School";
  });
  document.getElementById("nsbOldGrant").addEventListener("input", calculateNSB);
  document.getElementById("nsbNewGrant").addEventListener("input", calculateNSB);
}

function wireTabs(){
  document.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
      if(btn.dataset.tab === "history") renderHistory(getActiveHistoryType());
    });
  });
  document.querySelectorAll(".subtab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".subtab-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      renderHistory(btn.dataset.history);
    });
  });
}
function getActiveHistoryType(){
  const active = document.querySelector(".subtab-btn.active");
  return active ? active.dataset.history : "ftf";
}

/* ===================== FTF ===================== */
function buildFTFRows(){
  document.getElementById("ftfRateLabel").textContent = FTF_RATE;
  const tbody = document.getElementById("ftfTableBody");
  tbody.innerHTML = "";
  CLASSES.forEach((cls, idx)=>{
    const tr = document.createElement("tr");
    tr.dataset.class = cls;
    tr.innerHTML = `
      <td class="class-name">${cls}</td>
      <td><input type="number" min="0" step="1" value="0" class="ftf-strength" data-idx="${idx}"></td>
      <td><input type="number" min="0" step="1" value="0" class="ftf-fine" data-idx="${idx}"></td>
      <td><input type="number" min="0" step="1" value="0" class="ftf-concession" data-idx="${idx}"></td>
      <td class="total-cell ftf-total" data-idx="${idx}">0</td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("input").forEach(inp=>{
    inp.addEventListener("input", calculateFTF);
  });
}

function getFTFRows(){
  const rows = [];
  document.querySelectorAll("#ftfTableBody tr").forEach((tr, idx)=>{
    const strength = parseFloat(tr.querySelector(".ftf-strength").value) || 0;
    const fine = parseFloat(tr.querySelector(".ftf-fine").value) || 0;
    const concession = parseFloat(tr.querySelector(".ftf-concession").value) || 0;
    const total = (strength * FTF_RATE) + fine - concession;
    rows.push({ class: tr.dataset.class, strength, fine, concession, total });
  });
  return rows;
}

function calculateFTF(){
  const rows = getFTFRows();
  let grandStrength=0, grandFine=0, grandConcession=0, grandTotal=0;
  rows.forEach((r, idx)=>{
    document.querySelector(`.ftf-total[data-idx="${idx}"]`).textContent = r.total.toLocaleString();
    grandStrength += r.strength;
    grandFine += r.fine;
    grandConcession += r.concession;
    grandTotal += r.total;
  });
  document.getElementById("ftfGrandStrength").textContent = grandStrength.toLocaleString();
  document.getElementById("ftfGrandFine").textContent = grandFine.toLocaleString();
  document.getElementById("ftfGrandConcession").textContent = grandConcession.toLocaleString();
  document.getElementById("ftfGrandTotal").textContent = grandTotal.toLocaleString();
  document.getElementById("ftfSummaryStrength").textContent = grandStrength.toLocaleString();
  document.getElementById("ftfSummaryAmount").textContent = "Rs " + grandTotal.toLocaleString();
  return { rows, grandStrength, grandFine, grandConcession, grandTotal };
}

function resetFTF(){
  if(!confirm("Reset all FTF entries for this period to zero?")) return;
  document.querySelectorAll("#ftfTableBody input").forEach(i=>i.value = 0);
  calculateFTF();
  toast("FTF register reset");
}

function saveFTF(){
  const data = calculateFTF();
  const key = periodKey();
  const all = JSON.parse(localStorage.getItem(LS_FTF) || "{}");
  all[key] = {
    schoolName: document.getElementById("schoolName").value || "School",
    month: currentMonth, year: currentYear,
    rate: FTF_RATE,
    rows: data.rows,
    grandStrength: data.grandStrength,
    grandFine: data.grandFine,
    grandConcession: data.grandConcession,
    grandTotal: data.grandTotal,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(LS_FTF, JSON.stringify(all));
  toast("FTF record saved for " + periodLabel());
}

function loadFTFRecord(key){
  const all = JSON.parse(localStorage.getItem(LS_FTF) || "{}");
  const rec = all[key];
  if(!rec) return;
  currentMonth = rec.month; currentYear = rec.year;
  document.getElementById("periodMonth").value = currentMonth;
  document.getElementById("periodYear").value = currentYear;
  document.getElementById("schoolName").value = rec.schoolName;
  document.getElementById("ftfSchoolLabel").textContent = rec.schoolName;
  document.getElementById("nsbSchoolLabel").textContent = rec.schoolName;
  updatePeriodLabels();
  rec.rows.forEach((r, idx)=>{
    const tr = document.querySelectorAll("#ftfTableBody tr")[idx];
    if(!tr) return;
    tr.querySelector(".ftf-strength").value = r.strength;
    tr.querySelector(".ftf-fine").value = r.fine;
    tr.querySelector(".ftf-concession").value = r.concession;
  });
  calculateFTF();
  switchToTab("ftf");
  toast("Loaded FTF record: " + periodLabelFor(rec.month, rec.year));
}

function deleteFTFRecord(key){
  if(!confirm("Delete this FTF record permanently?")) return;
  const all = JSON.parse(localStorage.getItem(LS_FTF) || "{}");
  delete all[key];
  localStorage.setItem(LS_FTF, JSON.stringify(all));
  renderHistory("ftf");
  toast("FTF record deleted");
}

/* ===================== NSB ===================== */
let expenseCounter = 0;

function addExpenseRow(desc="", amount=0){
  const id = "exp_" + (expenseCounter++);
  const tbody = document.getElementById("nsbExpenseBody");
  const tr = document.createElement("tr");
  tr.dataset.id = id;
  tr.innerHTML = `
    <td><input type="text" class="exp-desc" placeholder="e.g. Chalk, Stationery, Repairs" value="${escapeHtml(desc)}"></td>
    <td><input type="number" class="exp-amount" min="0" step="1" value="${amount}"></td>
    <td class="no-print"><button class="remove-row-btn" onclick="removeExpenseRow('${id}')">✕</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector(".exp-desc").addEventListener("input", calculateNSB);
  tr.querySelector(".exp-amount").addEventListener("input", calculateNSB);
  calculateNSB();
}

function removeExpenseRow(id){
  const tr = document.querySelector(`#nsbExpenseBody tr[data-id="${id}"]`);
  if(tr) tr.remove();
  calculateNSB();
}

function getNSBExpenses(){
  const expenses = [];
  document.querySelectorAll("#nsbExpenseBody tr").forEach(tr=>{
    const desc = tr.querySelector(".exp-desc").value.trim();
    const amount = parseFloat(tr.querySelector(".exp-amount").value) || 0;
    expenses.push({ desc, amount });
  });
  return expenses;
}

function calculateNSB(){
  const oldGrant = parseFloat(document.getElementById("nsbOldGrant").value) || 0;
  const newGrant = parseFloat(document.getElementById("nsbNewGrant").value) || 0;
  const total = oldGrant + newGrant;
  const expenses = getNSBExpenses();
  const consumption = expenses.reduce((s,e)=>s+e.amount, 0);
  const remaining = total - consumption;

  document.getElementById("nsbTotalAmount").textContent = total.toLocaleString();
  document.getElementById("nsbConsumptionTotal").textContent = consumption.toLocaleString();
  document.getElementById("nsbSummaryTotal").textContent = "Rs " + total.toLocaleString();
  document.getElementById("nsbSummaryConsumption").textContent = "Rs " + consumption.toLocaleString();
  document.getElementById("nsbSummaryRemaining").textContent = "Rs " + remaining.toLocaleString();

  return { oldGrant, newGrant, total, expenses, consumption, remaining };
}

function resetNSB(){
  if(!confirm("Reset NSB entries for this period?")) return;
  document.getElementById("nsbOldGrant").value = 0;
  document.getElementById("nsbNewGrant").value = 0;
  document.getElementById("nsbExpenseBody").innerHTML = "";
  addExpenseRow();
  calculateNSB();
  toast("NSB register reset");
}

function saveNSB(){
  const data = calculateNSB();
  const key = periodKey();
  const all = JSON.parse(localStorage.getItem(LS_NSB) || "{}");
  all[key] = {
    schoolName: document.getElementById("schoolName").value || "School",
    month: currentMonth, year: currentYear,
    oldGrant: data.oldGrant,
    newGrant: data.newGrant,
    total: data.total,
    expenses: data.expenses,
    consumption: data.consumption,
    remaining: data.remaining,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(LS_NSB, JSON.stringify(all));
  toast("NSB record saved for " + periodLabel());
}

function loadNSBRecord(key){
  const all = JSON.parse(localStorage.getItem(LS_NSB) || "{}");
  const rec = all[key];
  if(!rec) return;
  currentMonth = rec.month; currentYear = rec.year;
  document.getElementById("periodMonth").value = currentMonth;
  document.getElementById("periodYear").value = currentYear;
  document.getElementById("schoolName").value = rec.schoolName;
  document.getElementById("ftfSchoolLabel").textContent = rec.schoolName;
  document.getElementById("nsbSchoolLabel").textContent = rec.schoolName;
  updatePeriodLabels();
  document.getElementById("nsbOldGrant").value = rec.oldGrant;
  document.getElementById("nsbNewGrant").value = rec.newGrant;
  document.getElementById("nsbExpenseBody").innerHTML = "";
  (rec.expenses.length ? rec.expenses : [{desc:"",amount:0}]).forEach(e=> addExpenseRow(e.desc, e.amount));
  calculateNSB();
  switchToTab("nsb");
  toast("Loaded NSB record: " + periodLabelFor(rec.month, rec.year));
}

function deleteNSBRecord(key){
  if(!confirm("Delete this NSB record permanently?")) return;
  const all = JSON.parse(localStorage.getItem(LS_NSB) || "{}");
  delete all[key];
  localStorage.setItem(LS_NSB, JSON.stringify(all));
  renderHistory("nsb");
  toast("NSB record deleted");
}

/* ===================== HISTORY ===================== */
function renderHistory(type){
  const container = document.getElementById("historyList");
  const all = JSON.parse(localStorage.getItem(type === "ftf" ? LS_FTF : LS_NSB) || "{}");
  const keys = Object.keys(all).sort().reverse();
  if(keys.length === 0){
    container.innerHTML = `<p class="empty-note">No ${type.toUpperCase()} records saved yet.</p>`;
    return;
  }
  container.innerHTML = keys.map(key=>{
    const rec = all[key];
    const label = periodLabelFor(rec.month, rec.year);
    const amountLine = type === "ftf"
      ? `Strength: ${rec.grandStrength} | Total: Rs ${rec.grandTotal.toLocaleString()}`
      : `Total: Rs ${rec.total.toLocaleString()} | Remaining: Rs ${rec.remaining.toLocaleString()}`;
    return `
      <div class="history-item">
        <div class="hi-info"><b>${label}</b><br>${amountLine}</div>
        <div class="hi-actions">
          <button class="hi-load" onclick="${type}Load('${key}')">Load</button>
          <button class="hi-delete" onclick="${type}Del('${key}')">Delete</button>
        </div>
      </div>`;
  }).join("");
}
// small aliases so inline onclick strings stay short & valid
function ftfLoad(key){ loadFTFRecord(key); }
function ftfDel(key){ deleteFTFRecord(key); }
function nsbLoad(key){ loadNSBRecord(key); }
function nsbDel(key){ deleteNSBRecord(key); }

/* ===================== PDF EXPORT ===================== */
function downloadFTF(){
  const data = calculateFTF();
  const school = document.getElementById("schoolName").value || "School";
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont("times","bold"); doc.setFontSize(15);
  doc.text("Farogh-e-Taleem Fund (FTF) Register", 105, 15, { align:"center" });
  doc.setFontSize(11); doc.setFont("times","normal");
  doc.text(`${school}  —  ${periodLabel()}`, 105, 22, { align:"center" });
  doc.text(`Rate: Rs ${FTF_RATE} per student`, 105, 28, { align:"center" });

  const body = data.rows.map(r=>[r.class, r.strength, r.fine, r.concession, r.total.toLocaleString()]);
  body.push(["Grand Total", data.grandStrength, data.grandFine, data.grandConcession, data.grandTotal.toLocaleString()]);

  doc.autoTable({
    startY: 34,
    head: [["Class","Strength","Fine (Rs)","Concession (Rs)","Total Amount (Rs)"]],
    body,
    theme: "grid",
    headStyles: { fillColor:[27,58,43], textColor:255 },
    didParseCell: (d)=>{ if(d.row.index === body.length-1) d.cell.styles.fillColor = [201,161,59]; }
  });

  doc.save(`FTF_Register_${periodKey()}.pdf`);
  toast("FTF PDF downloaded");
}

function downloadNSB(){
  const data = calculateNSB();
  const school = document.getElementById("schoolName").value || "School";
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont("times","bold"); doc.setFontSize(15);
  doc.text("Non-Salary Budget (NSB) Register", 105, 15, { align:"center" });
  doc.setFontSize(11); doc.setFont("times","normal");
  doc.text(`${school}  —  ${periodLabel()}`, 105, 22, { align:"center" });

  doc.autoTable({
    startY: 30,
    theme: "plain",
    body: [
      ["Old Grant (Rs)", data.oldGrant.toLocaleString()],
      ["New Grant (Rs)", data.newGrant.toLocaleString()],
      ["NSB Total Amount (Rs)", data.total.toLocaleString()]
    ],
    styles:{ fontStyle:"bold" }
  });

  const expBody = data.expenses.filter(e=>e.desc || e.amount).map(e=>[e.desc || "-", e.amount.toLocaleString()]);
  expBody.push(["Total Consumption / Assets", data.consumption.toLocaleString()]);

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["Consumption / Assets", "Amount (Rs)"]],
    body: expBody,
    theme: "grid",
    headStyles: { fillColor:[27,58,43], textColor:255 },
    didParseCell: (d)=>{ if(d.row.index === expBody.length-1) d.cell.styles.fillColor = [201,161,59]; }
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    theme: "grid",
    body: [["Remaining Amount (Rs)", data.remaining.toLocaleString()]],
    headStyles: { fillColor:[27,58,43] },
    styles:{ fontStyle:"bold", fontSize:12 },
    didParseCell: (d)=>{ d.cell.styles.fillColor = [201,161,59]; }
  });

  doc.save(`NSB_Register_${periodKey()}.pdf`);
  toast("NSB PDF downloaded");
}

/* ===================== SHARE ===================== */
async function shareFTF(){
  const data = calculateFTF();
  const school = document.getElementById("schoolName").value || "School";
  const text = `FTF Register — ${school} — ${periodLabel()}\n` +
    `Grand Total Strength: ${data.grandStrength}\n` +
    `Grand Total Amount: Rs ${data.grandTotal.toLocaleString()}`;
  await shareText("FTF Register", text);
}

async function shareNSB(){
  const data = calculateNSB();
  const school = document.getElementById("schoolName").value || "School";
  const text = `NSB Register — ${school} — ${periodLabel()}\n` +
    `Total Amount: Rs ${data.total.toLocaleString()}\n` +
    `Consumption/Assets: Rs ${data.consumption.toLocaleString()}\n` +
    `Remaining Amount: Rs ${data.remaining.toLocaleString()}`;
  await shareText("NSB Register", text);
}

async function shareText(title, text){
  if(navigator.share){
    try{ await navigator.share({ title, text }); }
    catch(e){ /* user cancelled */ }
  } else if(navigator.clipboard){
    await navigator.clipboard.writeText(text);
    toast("Copied summary to clipboard");
  } else {
    alert(text);
  }
}

/* ===================== HELPERS ===================== */
function periodKey(){ return `${currentYear}-${String(currentMonth).padStart(2,"0")}`; }
function periodLabel(){ return `${MONTH_NAMES[currentMonth-1]} ${currentYear}`; }
function periodLabelFor(m,y){ return `${MONTH_NAMES[m-1]} ${y}`; }
function switchToTab(tab){
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active", p.id==="tab-"+tab));
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove("show"), 2200);
}

function registerServiceWorker(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}
