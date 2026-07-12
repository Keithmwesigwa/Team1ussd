const express = require('express');
const router = express.Router();
const db = require('./db');
const { correctTranscript } = require('./slang_dictionary');

/**
 * 1. DUAL-ROUTING COMPLAINT INGESTION PIPELINE
 * POST /api/v1/ingest/complaint
 */
router.post('/ingest/complaint', async (req, res) => {
  try {
    const {
      caller_number,
      audio_recording_url,
      network_provider,
      raw_transcript,
      category,
      district,
      channel_source,
      amount_ugx
    } = req.body;

    if (!caller_number || !network_provider || !category) {
      return res.status(400).json({ error: 'Missing mandatory complaint parameters.' });
    }

    // 1. Resolve or Create Subscriber
    let subscriber = await db.getSubscriberByPhone(caller_number);
    if (!subscriber) {
      const generatedImsi = 'IMSI' + Math.floor(100000000000000 + Math.random() * 900000000000000);
      subscriber = await db.createSubscriber({
        id: 'sub-' + Math.random().toString(36).substring(2, 11),
        phone_number: caller_number,
        identity_imsi: generatedImsi,
        language_preference: 'en',
        primary_wallet_provider: network_provider
      });
    }

    // 2. Set strict SLA 48-Hour Deadline
    const createdAt = new Date();
    const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);

    // 3. Automated Semantic Correction Interceptor
    const correctedText = correctTranscript(raw_transcript || '');

    // 4. Create Complaint object
    const ticketRef = `BOU-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const complaintId = 'complaint-' + Math.random().toString(36).substring(2, 11);
    
    const newComplaint = {
      id: complaintId,
      ticket_reference: ticketRef,
      subscriber_id: subscriber.id,
      subscriber_phone: subscriber.phone_number,
      network_provider,
      category,
      raw_audio_url: audio_recording_url || '',
      initial_transcript: raw_transcript || '',
      corrected_transcript: correctedText,
      status: 'under_review',
      district: district || 'Kampala',
      channel_source: channel_source || 'ussd',
      amount_ugx: Number(amount_ugx) || 0,
      sla_deadline: slaDeadline.toISOString(),
      created_at: createdAt.toISOString()
    };

    // 5. Transactional Mock Broadcast Simulation
    // In production, this writes to the central Postgres database and synchronously triggers a message bus/replica
    // to update the telecom operator's isolated tenant partition.
    console.log(`[Multi-Tenant Ingestion] Broadcasting ticket ${ticketRef} to Central BoU Ledger and isolated ${network_provider.toUpperCase()} tenant database...`);
    
    await db.createComplaint(newComplaint);

    return res.status(201).json({
      message: 'Complaint ingested and broadcast successfully.',
      complaint: newComplaint
    });
  } catch (error) {
    console.error('Error ingesting complaint:', error);
    return res.status(500).json({ error: 'Internal Server Error during ingestion.' });
  }
});

/**
 * 2. TELECOM OPERATOR SERVICE MODULES
 * POST /api/v1/telecom/action
 */
router.post('/telecom/action', async (req, res) => {
  try {
    const { action, complaint_id, operator_identity, target_phone } = req.body;
    
    // We assume header 'X-Operator-Identity' or request body 'operator_identity' (e.g. 'mtn', 'airtel')
    const operatorRole = req.headers['x-operator-identity'] || req.body.operator_role;

    if (!action || !operator_identity || !operatorRole) {
      return res.status(400).json({ error: 'Missing parameters. Ensure action, operator_identity, and operator_role are set.' });
    }

    // Resolve complaint to check boundaries
    let complaint = null;
    if (complaint_id) {
      complaint = await db.getComplaintById(complaint_id);
      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found.' });
      }

      // STRICT MULTI-TENANT ISOLATION BOUNDARY CHECK
      // If an operator tries to view/modify a complaint assigned to a different operator, reject immediately.
      if (complaint.network_provider !== operatorRole) {
        return res.status(403).json({
          error: `Access Denied: Tenant ${operatorRole.toUpperCase()} cannot perform operations on ${complaint.network_provider.toUpperCase()} complaints.`
        });
      }
    }

    if (action === 'wallet_freeze') {
      const phone = target_phone || (complaint ? complaint.subscriber_phone : null);
      if (!phone) {
        return res.status(400).json({ error: 'Target phone number required for wallet freeze.' });
      }
      
      // Simulate network request to Mobile Money Core API
      console.log(`[Core Network API] Sending POST /api/momocore/wallet/lock for phone: ${phone}`);
      const updatedSub = await db.updateSubscriberWalletFreeze(phone, true);

      // Log SLA audit trail
      const auditLog = {
        id: 'log-' + Math.random().toString(36).substring(2, 11),
        complaint_id: complaint_id || null,
        action_taken: `wallet_freeze targeting ${phone}`,
        operator_identity,
        timestamp: new Date().toISOString()
      };
      await db.createAuditLog(auditLog);

      return res.json({
        message: `Wallet for ${phone} frozen successfully. Core systems synchronized.`,
        subscriber: updatedSub
      });
    }

    if (action === 'flash_sms_intercept') {
      const phone = target_phone || (complaint ? complaint.subscriber_phone : null);
      if (!phone) {
        return res.status(400).json({ error: 'Target phone number required for Class 0 SMS.' });
      }

      // Simulate sending a Class 0 Flash SMS pop-up nudge to block user input and trigger warning
      console.log(`[SMS Gateway API] Triggering Class 0 Flash Intercept to ${phone}: "WARNING: Ongoing suspicious activity detected. Please cancel your transaction immediately."`);
      
      const auditLog = {
        id: 'log-' + Math.random().toString(36).substring(2, 11),
        complaint_id: complaint_id || null,
        action_taken: `flash_sms_intercept targeting ${phone}`,
        operator_identity,
        timestamp: new Date().toISOString()
      };
      await db.createAuditLog(auditLog);

      return res.json({
        message: `Class 0 Flash SMS Intercept nudge delivered to ${phone}.`
      });
    }

    if (action === 'resolve_dispute') {
      if (!complaint_id) {
        return res.status(400).json({ error: 'Complaint ID is required to resolve dispute.' });
      }

      // Update complaint status to resolved, halting SLA countdown timer
      const updatedComplaint = await db.updateComplaintStatus(complaint_id, 'resolved');

      // Record in SLA Audit Log
      const auditLog = {
        id: 'log-' + Math.random().toString(36).substring(2, 11),
        complaint_id,
        action_taken: 'resolve_dispute (escalation halted)',
        operator_identity,
        timestamp: new Date().toISOString()
      };
      await db.createAuditLog(auditLog);

      return res.json({
        message: `Complaint ${complaint.ticket_reference} marked as resolved. SLA countdown halted.`,
        complaint: updatedComplaint
      });
    }

    return res.status(400).json({ error: 'Unsupported action.' });
  } catch (error) {
    console.error('Error executing operator action:', error);
    return res.status(500).json({ error: 'Internal Server Error during action processing.' });
  }
});

/**
 * 3. BANK OF UGANDA SURVEILLANCE & ENFORCEMENT ENGINE
 * GET /api/v1/bou/surveillance
 */
router.get('/bou/surveillance', async (req, res) => {
  try {
    const complaints = await db.getComplaints();
    const auditLogs = await db.getAuditLogs();

    // 1. Group aggregates by district
    const districtAggregates = {};
    // 2. Group aggregates by telecom channel
    const channelAggregates = {};
    // 3. Group aggregates by provider
    const providerAggregates = {
      mtn: { totalLossUGX: 0, resolved: 0, total: 0 },
      airtel: { totalLossUGX: 0, resolved: 0, total: 0 }
    };

    let totalLossSwingsUGX = 0;

    complaints.forEach(c => {
      const amount = Number(c.amount_ugx) || 0;
      totalLossSwingsUGX += amount;

      // District
      const dist = c.district || 'Other';
      if (!districtAggregates[dist]) {
        districtAggregates[dist] = { count: 0, totalLossUGX: 0 };
      }
      districtAggregates[dist].count += 1;
      districtAggregates[dist].totalLossUGX += amount;

      // Channel
      const chan = c.channel_source || 'ussd';
      if (!channelAggregates[chan]) {
        channelAggregates[chan] = { count: 0, totalLossUGX: 0 };
      }
      channelAggregates[chan].count += 1;
      channelAggregates[chan].totalLossUGX += amount;

      // Provider
      const prov = c.network_provider || 'mtn';
      if (providerAggregates[prov]) {
        providerAggregates[prov].totalLossUGX += amount;
        providerAggregates[prov].total += 1;
        if (c.status === 'resolved') {
          providerAggregates[prov].resolved += 1;
        }
      }
    });

    // Compute SLA Compliance Rankings
    const complianceRankings = Object.keys(providerAggregates).map(prov => {
      const { resolved, total } = providerAggregates[prov];
      const rate = total > 0 ? Math.round((resolved / total) * 100) : 100;
      return {
        provider: prov.toUpperCase(),
        complianceRate: rate,
        ticketsCount: total,
        resolvedCount: resolved
      };
    });

    // Mock Fintech Sandbox Target Transaction Volumes (analytics widget)
    const sandboxMetrics = {
      targetVolume: 5000000000, // 5B UGX target
      currentVolume: 3820500100, // 3.82B UGX current
      complianceStatus: 'On Track'
    };

    return res.json({
      totalLossSwingsUGX,
      districtAggregates,
      channelAggregates,
      complianceRankings,
      sandboxMetrics,
      complaints,
      auditLogs
    });
  } catch (error) {
    console.error('Error compiling surveillance data:', error);
    return res.status(500).json({ error: 'Internal Server Error during surveillance aggregate calculation.' });
  }
});

/**
 * POST /api/v1/bou/enforce/sanction
 */
router.post('/bou/enforce/sanction', async (req, res) => {
  try {
    const complaints = await db.getComplaints();
    const now = new Date();
    const sanctionsIssued = [];

    for (const c of complaints) {
      // Check if complaint is not resolved, and SLA deadline has passed
      if (c.status !== 'resolved' && c.status !== 'escalated') {
        const deadline = new Date(c.sla_deadline);
        if (deadline < now) {
          // Escalate the ticket status
          await db.updateComplaintStatus(c.id, 'escalated');
          
          // Log Notice of Non-Compliance Sanction entry
          const logId = 'log-' + Math.random().toString(36).substring(2, 11);
          const sanctionNotice = {
            id: logId,
            complaint_id: c.id,
            action_taken: `Notice of Non-Compliance Sanction Issued: Ticket ${c.ticket_reference} breached 48-Hour SLA limit.`,
            operator_identity: 'BOU_ENFORCEMENT_SYSTEM',
            timestamp: now.toISOString()
          };
          await db.createAuditLog(sanctionNotice);
          sanctionsIssued.push({
            ticket: c.ticket_reference,
            operator: c.network_provider,
            deadline: c.sla_deadline,
            elapsed: Math.round((now - deadline) / (1000 * 60 * 60)) + ' hours'
          });
        }
      }
    }

    return res.json({
      message: 'Automatic SLA compliance check completed.',
      sanctionsIssuedCount: sanctionsIssued.length,
      sanctionsIssued
    });
  } catch (error) {
    console.error('Error enforcing SLA sanctions:', error);
    return res.status(500).json({ error: 'Internal Server Error during compliance sanctioning.' });
  }
});

/**
 * GET /api/v1/analytics/spatial-stream
 * Server-Sent Events (SSE) broadcast stream for live fraud heatmap
 */
router.get('/analytics/spatial-stream', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Extract operator identity if provided, otherwise null (BoU sees all)
  const operatorRole = req.headers['x-operator-identity'] || req.query.operator_role || null;

  // Initial immediate send
  const sendMetrics = async () => {
    try {
      const payload = await db.getLiveGeospatialMetrics(operatorRole);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      console.error('Error fetching geospatial metrics for SSE:', error);
    }
  };

  sendMetrics();

  // Establish heartbeat interval every 5 seconds
  const intervalId = setInterval(sendMetrics, 5000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    console.log('SSE connection closed, interval cleared.');
  });
});

/**
 * 3. CITIZEN PWA PORTAL ENDPOINTS
 */

// POST /api/v1/complaints/ingest
router.post('/complaints/ingest', async (req, res) => {
  try {
    const { phone_number, category, provider, transaction_id, narrative } = req.body;

    if (!phone_number || !category || !provider || !narrative) {
      return res.status(400).json({ error: 'Missing mandatory complaint fields.' });
    }

    // Generate ticket_reference format: BOU-PWA-2026-X[Random]
    const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digit number
    const ticketRef = `BOU-PWA-2026-X${randomSuffix}`;

    const newComplaint = {
      id: 'pwa-comp-' + Math.random().toString(36).substring(2, 11),
      ticket_reference: ticketRef,
      phone_number,
      category,
      provider,
      transaction_id: transaction_id || null,
      narrative,
      status: 'ingested',
      created_at: new Date().toISOString()
    };

    const saved = await db.createPwaComplaint(newComplaint);
    console.log(`[PWA Ingestion] Saved complaint reference: ${ticketRef}`);

    return res.status(201).json(saved);
  } catch (error) {
    console.error('Error in PWA ingestion endpoint:', error);
    return res.status(500).json({ error: 'Internal Server Error during PWA ingestion.' });
  }
});

// GET /api/v1/complaints/history
router.get('/complaints/history', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number parameter is required.' });
    }

    const complaints = await db.getPwaComplaints(phone);
    return res.json(complaints);
  } catch (error) {
    console.error('Error fetching PWA complaints history:', error);
    return res.status(500).json({ error: 'Internal Server Error fetching history.' });
  }
});

// GET /api/v1/chat/messages
router.get('/chat/messages', async (req, res) => {
  try {
    const { ticket } = req.query;
    if (!ticket) {
      return res.status(400).json({ error: 'Ticket reference parameter is required.' });
    }

    const rawMsgs = await db.getPwaChatMessages(ticket);
    // Low-bandwidth strip down: only return fields needed
    const strippedMsgs = rawMsgs.map(m => ({
      s: m.sender_type === 'citizen' ? 'c' : 'o', // c: citizen, o: operator
      t: m.message_text,
      d: m.created_at
    }));

    return res.json(strippedMsgs);
  } catch (error) {
    console.error('Error fetching PWA chat messages:', error);
    return res.status(500).json({ error: 'Internal Server Error fetching chat messages.' });
  }
});

// POST /api/v1/chat/message
router.post('/chat/message', async (req, res) => {
  try {
    const { ticket_reference, sender_type, message_text } = req.body;

    if (!ticket_reference || !sender_type || !message_text) {
      return res.status(400).json({ error: 'Missing chat message parameters.' });
    }

    const newMsg = {
      id: 'chat-' + Math.random().toString(36).substring(2, 11),
      ticket_reference,
      sender_type,
      message_text,
      created_at: new Date().toISOString()
    };

    const saved = await db.createPwaChatMessage(newMsg);

    // If sent by citizen, trigger simulated response after 2.5 seconds to make chat interactive
    if (sender_type === 'citizen') {
      setTimeout(async () => {
        try {
          const complaint = await db.getPwaComplaintByReference(ticket_reference);
          let responseText = "We are reviewing your request. A compliance officer will update you shortly.";
          if (complaint) {
            const providerName = complaint.provider.toUpperCase();
            if (complaint.category === 'fraud') {
              responseText = `[Tulinde Guard] ${providerName} Fraud Desk is auditing the reported transaction (${complaint.transaction_id || 'N/A'}). Wallet action is pending.`;
            } else if (complaint.category === 'overcharge') {
              responseText = `[Audit Log] Escalating overcharging dispute to ${providerName} customer accounts panel.`;
            }
          }
          await db.createPwaChatMessage({
            ticket_reference,
            sender_type: 'operator',
            message_text: responseText,
            created_at: new Date().toISOString()
          });
          console.log(`[PWA Chat Auto-Responder] Sent reply for ${ticket_reference}`);
        } catch (autoErr) {
          console.error('Error in chat auto-responder:', autoErr);
        }
      }, 2500);
    }

    return res.status(201).json(saved);
  } catch (error) {
    console.error('Error saving chat message:', error);
    return res.status(500).json({ error: 'Internal Server Error sending chat message.' });
  }
});

/**
 * 4. ROLE-BASED ACCESS CONTROL (RBAC) AUTH ENDPOINTS
 */

// POST /api/v1/auth/login
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const emailLower = username.toLowerCase().trim();
  let inferredRole = null;

  if (emailLower.endsWith('bou.go.ug')) {
    inferredRole = 'bou';
  } else if (emailLower.endsWith('mtn.co.ug')) {
    inferredRole = 'mtn';
  } else if (emailLower.endsWith('airtel.co.ug')) {
    inferredRole = 'airtel';
  }

  if (!inferredRole) {
    return res.status(401).json({ error: 'Invalid username domain. Use an authorized institution email.' });
  }

  // Preseeded users
  const adminUsers = {
    bou: { email: 'admin@bou.go.ug', pass: 'bouadmin123' },
    mtn: { email: 'agent@mtn.co.ug', pass: 'mtnagent123' },
    airtel: { email: 'agent@airtel.co.ug', pass: 'airtelagent123' }
  };

  const user = adminUsers[inferredRole];
  if (!user || user.email !== emailLower || user.pass !== password) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  return res.json({
    success: true,
    token: `mock-token-${inferredRole}-${Math.random().toString(36).substring(2, 9)}`,
    username: user.email,
    role: inferredRole
  });
});

// POST /api/v1/auth/otp/send
router.post('/auth/otp/send', (req, res) => {
  const { phone_number } = req.body;

  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Simulate SMS dispatch
  const code = '123456';
  console.log(`\n======================================================`);
  console.log(`  [SMS GATEWAY] Dispatching verification code to: ${phone_number}`);
  console.log(`  Verification Code: ${code}`);
  console.log(`======================================================\n`);

  return res.json({
    success: true,
    message: `OTP code dispatched via SMS. (Simulated OTP: ${code})`
  });
});

// POST /api/v1/auth/otp/verify
router.post('/auth/otp/verify', (req, res) => {
  const { phone_number, code } = req.body;

  if (!phone_number || !code) {
    return res.status(400).json({ error: 'Phone number and verification code are required.' });
  }

  if (code !== '123456') {
    return res.status(401).json({ error: 'Invalid verification code.' });
  }

  return res.json({
    success: true,
    token: `mock-token-citizen-${Math.random().toString(36).substring(2, 9)}`,
    phone_number
  });
});

module.exports = router;
