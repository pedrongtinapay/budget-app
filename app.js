// Simple budget app with server-backed SQLite storage. Converts amounts to weekly equivalents.
const WEEKS_PER_MONTH = 52/12; // ~=4.3333
const WEEKS_PER_YEAR = 52;

// API endpoints
const API_DATA = '/api/data'
const API_CALC = '/api/calculate'

function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

function makeFixedRow(name='', amount='', freq='monthly'){
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
    }, 1200)
  }

  // Attach autosave on input changes
  tr.querySelector('.name').addEventListener('input', debouncedSave)
  tr.querySelector('.amount').addEventListener('input', debouncedSave)
  freqEl.addEventListener('change', debouncedSave)

  removeBtn.addEventListener('click', async ()=>{
    tr.remove()
    try{ await saveDataToServer(snapshotFromUI()); const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json()) }catch(e){console.warn('Remove save failed',e)}
  })
  return tr
}

function makeVariableRow(name='', min='', max='', freq='monthly'){
  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td><input type="text" class="name" value="${name}"></td>
    <td><input type="number" class="min" step="0.01" value="${min}"></td>
    <td><input type="number" class="max" step="0.01" value="${max}"></td>
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
    }, 1200)
  }

  // Attach autosave on input changes
  tr.querySelector('.name').addEventListener('input', debouncedSave)
  tr.querySelector('.min').addEventListener('input', debouncedSave)
  tr.querySelector('.max').addEventListener('input', debouncedSave)
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
  // Only send keys that differ from server to avoid overwriting identical stored values.
  try{
    const server = await loadData()
    const payload = {}
    // income: send only if provided (not null) and different beyond 0.01
    if(data.income !== null && data.income !== undefined){
      const sIncome = typeof server.income === 'number' ? server.income : parseFloat(server.income || 0)
      if(Math.abs((data.income || 0) - (sIncome || 0)) > 0.005){ payload.income = data.income }
    }
    // normalize and compare fixed
    const normFixed = (data.fixed||[]).map(f=>({name:String(f.name||'').trim(), amount: Number(f.amount||0), freq: String(f.freq||'weekly')}))
    const srvFixed = (server.fixed||[]).map(f=>({name:String(f.name||'').trim(), amount: Number(f.amount||0), freq: String(f.freq||'weekly')}))
    if(JSON.stringify(normFixed) !== JSON.stringify(srvFixed)) payload.fixed = normFixed

    // normalize and compare variable (min/max)
    const normVar = (data.variable||[]).map(v=>({name:String(v.name||'').trim(), min: v.min==null?null: Number(v.min), max: v.max==null?null:Number(v.max), amount: v.amount==null?null:Number(v.amount), freq: String(v.freq||'weekly')}))
    const srvVar = (server.variable||[]).map(v=>({name:String(v.name||'').trim(), min: v.min_amount==null?null: Number(v.min_amount), max: v.max_amount==null?null:Number(v.max_amount), amount: v.amount==null?null:Number(v.amount), freq: String(v.freq||'weekly')}))
    if(JSON.stringify(normVar) !== JSON.stringify(srvVar)) payload.variable = normVar

    // if nothing changed, return server snapshot without POST
    if(Object.keys(payload).length === 0){
      return server
    }

    const res = await fetch(API_DATA, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
    if(!res.ok) throw new Error('Save failed')
    const saved = await res.json()
    return saved
  }catch(e){console.warn('Save failed',e); throw e}
}

async function populate(){
  const data = await loadData()
  // Ensure input shows persisted income with two decimals when present
  if (data.income !== undefined && data.income !== null) {
    qs('#income-input').value = Number(data.income).toFixed(2)
  } else {
    qs('#income-input').value = ''
  }
  const fixedBody = qs('#fixed-table tbody')
  const varBody = qs('#variable-table tbody')
  fixedBody.innerHTML=''
  varBody.innerHTML=''
  (data.fixed||[]).forEach(f=>fixedBody.appendChild(makeFixedRow(f.get('name') || f['name'], f.get('amount') || f['amount'], f.get('freq') || f['freq'])))
  (data.variable||[]).forEach(v=>varBody.appendChild(makeVariableRow(v.get('name') || v['name'], v.get('min_amount') || v['min_amount'] || v['min'] || '', v.get('max_amount') || v['max_amount'] || v['max'] || '', v.get('freq') || v['freq'])))
}

function readTable(tbody, type='fixed'){
  if(type === 'fixed'){
    return Array.from(tbody.querySelectorAll('tr')).map(tr=>({
      name:tr.querySelector('.name').value||'',
      amount:parseFloat(tr.querySelector('.amount').value)||0,
      freq:tr.querySelector('.freq').value||'weekly'
    }))
  } else {
    return Array.from(tbody.querySelectorAll('tr')).map(tr=>({
      name:tr.querySelector('.name').value||'',
      min:tr.querySelector('.min').value === '' ? null : parseFloat(tr.querySelector('.min').value),
      max:tr.querySelector('.max').value === '' ? null : parseFloat(tr.querySelector('.max').value),
      freq:tr.querySelector('.freq').value||'weekly'
    }))
  }
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

// remove local calculate; rely on server-side calculate

async function exportCSV(){
  const data = await loadData()
  const rows = [['type','name','amount','min','max','frequency']]
  (data.fixed||[]).forEach(f=>rows.push(['fixed',f.name,f.amount,'','',f.freq]))
  ;(data.variable||[]).forEach(v=>rows.push(['variable',v.name,'',v.min_amount || v.min || '', v.max_amount || v.max || '', v.freq]))
  rows.push(['income','',data.income,'','','biweekly'])
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
    fixed: readTable(qs('#fixed-table tbody'), 'fixed'),
    variable: readTable(qs('#variable-table tbody'), 'variable')
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

  // Build monthly breakdown for chart: fixed (monthly) and each variable (monthly average)
  const fixedMonthly = calc.fixedWeekly * (52/12)
  // fetch full data to get variable names and min/max
  (async ()=>{
    try{
      const res = await fetch(API_DATA)
      if(!res.ok) return
      const d = await res.json()
      const labels = []
      const data = []
      // fixed as one slice
      labels.push('Fixed')
      data.push(fixedMonthly)
      (d.variable||[]).forEach(v=>{
        // compute avg monthly for each variable
        const min = v.min_amount || v.min || null
        const max = v.max_amount || v.max || null
        let avg = 0
        if(min !== null && max !== null){ avg = (min + max)/2 }
        else if(v.amount !== null && v.amount !== undefined){ avg = v.amount }
        else if(min !== null){ avg = min }
        else if(max !== null){ avg = max }
        const weeklyAvg = (function(){
          switch(v.freq){
            case 'weekly': return avg
            case 'monthly': return avg / (52/12)
            case 'yearly': return avg / 52
            default: return avg
          }
        })()
        const monthlyAvg = weeklyAvg * (52/12)
        labels.push(v.name || 'Variable')
        data.push(monthlyAvg)
      })
      const totalMonthlyExpenses = data.reduce((s,x)=>s+x,0)
      const remaining = Math.max(0, monthly - totalMonthlyExpenses)
      labels.push('Remaining')
      data.push(remaining)

      const ctx = document.getElementById('expenseChart')
      const chartData = { labels, datasets:[{data, backgroundColor:['#2b7cff','#7fc3ff','#6fd08a','#ffb86b','#cf6fff','#f56991','#bbbbbd']} ] }
      if(expenseChart) expenseChart.destroy()
      expenseChart = new Chart(ctx, {type:'doughnut',data:chartData,options:{plugins:{legend:{position:'bottom'}}}})

      // update allocation table by re-fetching server calc (already have calc)
      const tbody = qs('#alloc-table tbody')
      tbody.innerHTML = ''
      // fixed and variable rows
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

    }catch(e){console.warn('Overview build failed',e)}
  })()
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
    const newRow = makeFixedRow();
    tbody.appendChild(newRow);
    const nameInput = newRow.querySelector('.name'); if(nameInput) nameInput.focus();
    await saveDataToServer(snapshotFromUI());
    const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json())
  })
  qs('#add-variable').addEventListener('click', async ()=>{
    const tbody = qs('#variable-table tbody');
    const newRow = makeVariableRow();
    tbody.appendChild(newRow);
    const nameInput = newRow.querySelector('.name'); if(nameInput) nameInput.focus();
    await saveDataToServer(snapshotFromUI());
    const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json())
  })
  qs('#save-income').addEventListener('click', async ()=>{
    const s = snapshotFromUI(); await saveDataToServer(s); alert('Saved');
    const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json())
  })
  // autosave income on change
  let incomeTimer = null
  qs('#income-input').addEventListener('input', ()=>{
    clearTimeout(incomeTimer)
    incomeTimer = setTimeout(async ()=>{ try{ await saveDataToServer(snapshotFromUI()); const r = await fetch(API_CALC); if(r.ok) renderOverview(await r.json()) }catch(e){console.warn('Income save failed',e)} }, 1500)
  })
  qs('#export-csv').addEventListener('click',exportCSV)
  qs('#clear').addEventListener('click',async ()=>{if(confirm('Clear all saved data?')){await saveDataToServer({income:0,fixed:[],variable:[]});await populate();qs('#weekly-income').textContent='₱0.00';qs('#monthly-income').textContent='Monthly: ₱0.00';qs('#expense-totals').textContent='Fixed: ₱0.00 · Variable: ₱0.00 · Total: ₱0.00';const tbody=qs('#alloc-table tbody');tbody.innerHTML=''; if(expenseChart){expenseChart.destroy(); expenseChart=null}}})
})
