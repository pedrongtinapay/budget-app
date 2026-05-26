// Simple budget app with server-backed SQLite storage. Converts amounts to weekly equivalents.
const WEEKS_PER_MONTH = 52/12; // ~=4.3333
const WEEKS_PER_YEAR = 52;

// API endpoints
const API_DATA = '/api/data'
const API_CALC = '/api/calculate'

function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

function makeRow(name='', amount='', freq='monthly'){
  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td><input type="text" class="name" value="${name}"></td>
    <td><input type="number" class="amount" step="0.01" value="${amount}"></td>
    <td>
      <select class="freq">
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
        <option value="yearly">yearly</option>
      </select>
    </td>
    <td><button class="remove">Remove</button></td>
  `
  const freqEl = tr.querySelector('.freq')
  freqEl.value = freq
  const removeBtn = tr.querySelector('.remove')

  // Debounced save helper
  let saveTimer = null
  const debouncedSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async ()=>{
      try{ await saveDataToServer(snapshotFromUI()); const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json()) }catch(e){console.warn('Debounced save failed',e)}
    }, 600)
  }

  // Attach autosave on input changes
  const nameInput = tr.querySelector('.name')
  const amountInput = tr.querySelector('.amount')
  nameInput.addEventListener('input', debouncedSave)
  amountInput.addEventListener('input', debouncedSave)
  freqEl.addEventListener('change', debouncedSave)

  removeBtn.addEventListener('click', async ()=>{
    tr.remove()
    try{ await saveDataToServer(snapshotFromUI()); const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json()) }catch(e){console.warn('Remove save failed',e)}
  })
  return tr
}

async function loadData(){
  try{
    const res = await fetch(API_DATA)
    if(!res.ok) throw new Error('Failed to load')
    return await res.json()
  }catch(e){console.warn('Load failed',e); return {income:0,fixed:[],variable:[]}}
}

async function saveDataToServer(data){
  try{
    await fetch(API_DATA, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)})
  }catch(e){console.warn('Save failed',e)}
}

async function populate(){
  const data = await loadData()
  qs('#income-input').value = data.income || ''
  const fixedBody = qs('#fixed-table tbody')
  const varBody = qs('#variable-table tbody')
  fixedBody.innerHTML=''
  varBody.innerHTML=''
  (data.fixed||[]).forEach(f=>fixedBody.appendChild(makeRow(f.name,f.amount,f.freq)))
  (data.variable||[]).forEach(v=>varBody.appendChild(makeRow(v.name,v.amount,v.freq)))
}

function readTable(tbody){
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>({
    name:tr.querySelector('.name').value||'',
    amount:parseFloat(tr.querySelector('.amount').value)||0,
    freq:tr.querySelector('.freq').value||'weekly'
  }))
}

function convertToWeekly(amount,freq){
  if(!amount) return 0
  switch(freq){
    case 'weekly': return amount
    case 'monthly': return amount / WEEKS_PER_MONTH
    case 'yearly': return amount / WEEKS_PER_YEAR
    default: return amount
  }
}

function calculate(){
  // Income input is biweekly; convert to weekly for budgeting
  const biweekly = parseFloat(qs('#income-input').value) || 0
  const income = biweekly / 2
  const fixed = readTable(qs('#fixed-table tbody'))
  const variable = readTable(qs('#variable-table tbody'))
  const fixedWeekly = fixed.reduce((s,i)=>s+convertToWeekly(i.amount,i.freq),0)
  const varWeekly = variable.reduce((s,i)=>s+convertToWeekly(i.amount,i.freq),0)
  const total = fixedWeekly + varWeekly
  const leftover = income - total
  const out = document.getElementById('results')
  out.innerHTML = `Weekly income: ${income.toFixed(2)} · Fixed: ${fixedWeekly.toFixed(2)} · Variable: ${varWeekly.toFixed(2)} · Total expenses: ${total.toFixed(2)} · Leftover: ${leftover.toFixed(2)}`
}

async function exportCSV(){
  const data = await loadData()
  const rows = [['type','name','amount','frequency']]
  (data.fixed||[]).forEach(f=>rows.push(['fixed',f.name,f.amount,f.freq]))
  ;(data.variable||[]).forEach(v=>rows.push(['variable',v.name,v.amount,v.freq]))
  rows.push(['income','',data.income,'biweekly'])
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv],{type:'text/csv'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'budget.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

function snapshotFromUI(){
  const incomeRaw = qs('#income-input').value
  const income = (incomeRaw === '' || incomeRaw === null) ? null : (parseFloat(incomeRaw) || 0)
  return {
    income: income,
    fixed: readTable(qs('#fixed-table tbody')),
    variable: readTable(qs('#variable-table tbody'))
  }
}

let expenseChart = null

function formatPeso(n){
  const x = Number(n) || 0
  return '₱' + x.toFixed(2)
}

function renderOverview(calc){
  // calc from server: incomeWeekly, fixedWeekly, variableWeekly, total, leftover
  qs('#weekly-income').textContent = formatPeso(calc.incomeWeekly)
  // monthly income should be biweekly * 2
  const biweekly = parseFloat(qs('#income-input').value) || (calc.incomeWeekly * 2)
  const monthly = biweekly * 2
  qs('#monthly-income').textContent = 'Monthly: ' + formatPeso(monthly)
  qs('#expense-totals').textContent = `Fixed: ${formatPeso(calc.fixedWeekly)} · Variable: ${formatPeso(calc.variableWeekly)} · Total: ${formatPeso(calc.total)}`

  // Pie chart: fixed vs variable
  const ctx = document.getElementById('expenseChart')
  const data = {
    labels: ['Fixed','Variable'],
    datasets:[{data:[calc.fixedWeekly, calc.variableWeekly],backgroundColor:['#2b7cff','#7fc3ff']}]
  }
  if(expenseChart) expenseChart.destroy()
  expenseChart = new Chart(ctx, {type:'pie',data,options:{plugins:{legend:{position:'bottom'}}}})

  // Allocation: include fixed and variable, rest of weekly income is distributed
  const tbody = qs('#alloc-table tbody')
  tbody.innerHTML = ''

  // Add fixed and variable rows first
  const trFixed = document.createElement('tr')
  trFixed.innerHTML = `<td>Fixed</td><td class="currency">${formatPeso(calc.fixedWeekly)}</td><td>${formatPeso(calc.fixedWeekly * (52/12))}</td><td>${((calc.fixedWeekly / Math.max(calc.incomeWeekly,1)) * 100).toFixed(0)}%</td>`
  tbody.appendChild(trFixed)
  const trVar = document.createElement('tr')
  trVar.innerHTML = `<td>Variable</td><td class="currency">${formatPeso(calc.variableWeekly)}</td><td>${formatPeso(calc.variableWeekly * (52/12))}</td><td>${((calc.variableWeekly / Math.max(calc.incomeWeekly,1)) * 100).toFixed(0)}%</td>`
  tbody.appendChild(trVar)

  const leftover = calc.leftover
  if(leftover <= 0){
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>Deficit (no allocation)</td><td class="currency">${formatPeso(leftover)}</td><td>${formatPeso(leftover * (52/12))}</td><td>—</td>`
    tbody.appendChild(tr)
    return
  }

  // Recommended allocation percentages of leftover (applied to leftover only)
  const allocs = [
    {k:'Savings',p:0.30},
    {k:'Emergency Fund',p:0.10},
    {k:'Debt Repayment',p:0.15},
    {k:'Investments',p:0.10},
    {k:'Discretionary',p:0.35}
  ]
  allocs.forEach(a=>{
    const weekly = leftover * a.p
    const monthly = weekly * (52/12)
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${a.k}</td><td class="currency">${formatPeso(weekly)}</td><td>${formatPeso(monthly)}</td><td>${Math.round(a.p*100)}% of leftover</td>`
    tbody.appendChild(tr)
  })
}

// init
window.addEventListener('DOMContentLoaded',()=>{
  (async ()=>{
    await populate()
    // after load, fetch calculate and render overview
    try{
      const res = await fetch(API_CALC)
      if(res.ok){
        const calc = await res.json()
        renderOverview(calc)
      }
    }catch(e){console.warn('Calc failed',e)}
  })()

  qs('#add-fixed').addEventListener('click', async ()=>{
    const tbody = qs('#fixed-table tbody');
    const newRow = makeRow();
    tbody.appendChild(newRow);
    const nameInput = newRow.querySelector('.name'); if(nameInput) nameInput.focus();
    await saveDataToServer(snapshotFromUI());
    const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json())
  })
  qs('#add-variable').addEventListener('click', async ()=>{
    const tbody = qs('#variable-table tbody');
    const newRow = makeRow();
    tbody.appendChild(newRow);
    const nameInput = newRow.querySelector('.name'); if(nameInput) nameInput.focus();
    await saveDataToServer(snapshotFromUI());
    const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json())
  })
  qs('#save-income').addEventListener('click', async ()=>{
    const s = snapshotFromUI(); await saveDataToServer(s); alert('Saved');
    const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json())
  })
  qs('#export-csv').addEventListener('click',exportCSV)
  qs('#clear').addEventListener('click',async ()=>{if(confirm('Clear all saved data?')){await saveDataToServer({income:0,fixed:[],variable:[]});await populate();qs('#weekly-income').textContent='₱0.00';qs('#monthly-income').textContent='Monthly: ₱0.00';qs('#expense-totals').textContent='Fixed: ₱0.00 · Variable: ₱0.00 · Total: ₱0.00';const tbody=qs('#alloc-table tbody');tbody.innerHTML=''; if(expenseChart){expenseChart.destroy(); expenseChart=null}}})
})
