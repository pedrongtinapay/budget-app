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
  tr.querySelector('.freq').value = freq
  tr.querySelector('.remove').addEventListener('click',()=>tr.remove())
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
  return {
    income: parseFloat(qs('#income-input').value)||0,
    fixed: readTable(qs('#fixed-table tbody')),
    variable: readTable(qs('#variable-table tbody'))
  }
}

// init
window.addEventListener('DOMContentLoaded',()=>{
  populate()
  qs('#add-fixed').addEventListener('click',()=>qs('#fixed-table tbody').appendChild(makeRow()))
  qs('#add-variable').addEventListener('click',()=>qs('#variable-table tbody').appendChild(makeRow()))
  qs('#save-income').addEventListener('click', async ()=>{
    const s = snapshotFromUI(); await saveDataToServer(s); alert('Saved')
  })
  qs('#calculate').addEventListener('click', async ()=>{
    calculate()
    await saveDataToServer(snapshotFromUI())
  })
  qs('#export-csv').addEventListener('click',exportCSV)
  qs('#clear').addEventListener('click',()=>{if(confirm('Clear all saved data?')){localStorage.removeItem(STORAGE_KEY);populate();qs('#results').textContent='';}})
})
