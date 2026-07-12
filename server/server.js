const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets if any
app.use('/static', express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api/v1', routes);

// Base route for server healthcheck
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'Telecom & Regulator Compliance Hub API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Automated SLA Compliance Checker (Background Cron Simulation)
// Runs every 30 seconds to automatically flags expired tickets, escalate them, and log non-compliance notices
const SLA_CHECK_INTERVAL_MS = 30000;
setInterval(async () => {
  try {
    const url = `http://localhost:${PORT}/api/v1/bou/enforce/sanction`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (result.sanctionsIssuedCount > 0) {
      console.log(`[Auto SLA Compliance Timer] Executed scan. Issued ${result.sanctionsIssuedCount} non-compliance sanctions:`, result.sanctionsIssued);
    }
  } catch (err) {
    // If external call fails, run the sanction engine directly
    try {
      const complaints = await db.getComplaints();
      const now = new Date();
      let count = 0;
      for (const c of complaints) {
        if (c.status !== 'resolved' && c.status !== 'escalated') {
          const deadline = new Date(c.sla_deadline);
          if (deadline < now) {
            await db.updateComplaintStatus(c.id, 'escalated');
            await db.createAuditLog({
              id: 'log-' + Math.random().toString(36).substring(2, 11),
              complaint_id: c.id,
              action_taken: `Notice of Non-Compliance Sanction Issued: Ticket ${c.ticket_reference} breached 48-Hour SLA limit. (Direct Enforcement)`,
              operator_identity: 'BOU_DIRECT_ENFORCEMENT_SYSTEM',
              timestamp: now.toISOString()
            });
            count++;
          }
        }
      }
      if (count > 0) {
        console.log(`[Auto SLA Compliance Timer] Direct run finished: ${count} ticket(s) escalated to BoU due to SLA breach.`);
      }
    } catch (directErr) {
      console.error('[Auto SLA Compliance Timer] direct scan error:', directErr);
    }
  }
}, SLA_CHECK_INTERVAL_MS);

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`  BOU Compliance Express Server running on: http://localhost:${PORT}`);
  console.log(`  Background SLA compliance scan running every 30 seconds`);
  console.log(`=============================================================`);
});
