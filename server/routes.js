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

module.exports = router;
