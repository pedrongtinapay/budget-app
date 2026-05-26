const path = require('path')
const Database = require('better-sqlite3')
const db = new Database(path.join(__dirname, 'budget.db'))

// initialize tables
db.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)').run()
db.prepare('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, type TEXT, name TEXT, amount REAL, freq TEXT)').run()

function getData(){
  const incomeRow = db.prepare('SELECT v FROM meta WHERE k = ?').get('income')
  const income = incomeRow ? parseFloat(incomeRow.v) : 0
  const fixed = db.prepare('SELECT id,name,amount,freq FROM items WHERE type = ?').all('fixed')
  const variable = db.prepare('SELECT id,name,amount,freq FROM items WHERE type = ?').all('variable')
  return {income, fixed, variable}
}

function saveData(data){
  const income = typeof data.income === 'number' ? data.income : parseFloat(data.income) || 0
  const fixed = Array.isArray(data.fixed) ? data.fixed : []
  const variable = Array.isArray(data.variable) ? data.variable : []

  const insertItem = db.prepare('INSERT INTO items (type,name,amount,freq) VALUES (?,?,?,?)')
  const del = db.prepare('DELETE FROM items WHERE type = ?')

  const tx = db.transaction(()=>{
    db.prepare('INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)').run('income', String(income))
    del.run('fixed')
    del.run('variable')
    for(const f of fixed){ insertItem.run('fixed', f.name || '', Number(f.amount) || 0, f.freq || 'weekly') }
    for(const v of variable){ insertItem.run('variable', v.name || '', Number(v.amount) || 0, v.freq || 'weekly') }
  })

  tx()
}

function convertToWeekly(amount, freq){
  const WEEKS_PER_MONTH = 52/12
  const WEEKS_PER_YEAR = 52
  if(!amount) return 0
  switch(freq){
    case 'weekly': return amount
    case 'monthly': return amount / WEEKS_PER_MONTH
    case 'yearly': return amount / WEEKS_PER_YEAR
    default: return amount
  }
}

function calculate(){
  const data = getData()
  const incomeWeekly = (data.income || 0) / 2 // income stored as biweekly
  const fixedWeekly = (data.fixed || []).reduce((s,i)=>s+convertToWeekly(i.amount,i.freq),0)
  const variableWeekly = (data.variable || []).reduce((s,i)=>s+convertToWeekly(i.amount,i.freq),0)
  const total = fixedWeekly + variableWeekly
  const leftover = incomeWeekly - total
  return {
    incomeWeekly,
    fixedWeekly,
    variableWeekly,
    total,
    leftover
  }
}

module.exports = { getData, saveData, calculate }
