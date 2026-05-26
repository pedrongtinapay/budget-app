const path = require('path')
const express = require('express')
const bodyParser = require('express').json
const db = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

app.use(bodyParser())
app.use(express.static(path.join(__dirname)))

// API: get saved data
app.get('/api/data', (req, res) => {
  res.json(db.getData())
})

// API: save snapshot (income, fixed, variable)
app.post('/api/data', (req, res) => {
  const payload = req.body || {}
  db.saveData(payload)
  res.json({ok:true})
})

// API: calculate weekly totals on the server (returns same shape as client-side)
app.get('/api/calculate', (req, res) => {
  const calc = db.calculate()
  res.json(calc)
})

app.listen(PORT, ()=>{
  console.log(`Budget app server listening on http://localhost:${PORT}`)
})
