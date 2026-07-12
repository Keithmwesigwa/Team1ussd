// API Integration Tests for BoU & Telecom Compliance Hub
// Run using: node server/test_api.js

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

// Override global fetch to disable keep-alive connections on Windows
const originalFetch = global.fetch;
global.fetch = (url, options = {}) => {
  options.headers = options.headers || {};
  options.headers['Connection'] = 'close';
  return originalFetch(url, options);
};

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🚀 Starting BoU & Telecom API Automated Tests...');
  console.log(`📡 Target API Endpoint: ${BASE_URL}`);
  console.log('--------------------------------------------------');

  let testPassed = 0;
  let testFailed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      testFailed++;
    }
  };

  try {
    // Test 1: Ingestion with Slang Translation
    console.log('\n--- Test 1: Complaint Ingestion & Slang Correction ---');
    const ingestPayload = {
      caller_number: '+256779998887',
      audio_recording_url: 'http://example.com/recordings/test.mp3',
      network_provider: 'mtn',
      raw_transcript: 'Kussa ssente zange ku simu naye sim yange ekyusiddwa mu ma-veelo',
      category: 'sim_swap',
      district: 'Gulu',
      channel_source: 'ivr',
      amount_ugx: 500000
    };

    const ingestRes = await fetch(`${BASE_URL}/ingest/complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingestPayload)
    });
    
    assert(ingestRes.status === 201, 'Ingest complaint returns HTTP 201 Created');
    const ingestData = await ingestRes.json();
    
    assert(ingestData.complaint !== undefined, 'Ingest response includes complaint object');
    const complaint = ingestData.complaint;
    
    // Check SLA deadline (48 hours later)
    const createdTime = new Date(complaint.created_at);
    const deadlineTime = new Date(complaint.sla_deadline);
    const timeDiffHours = (deadlineTime - createdTime) / (1000 * 60 * 60);
    assert(Math.round(timeDiffHours) === 48, 'SLA deadline is calculated to exactly 48 hours ahead');

    // Check semantic slang correction
    assert(
      complaint.corrected_transcript.includes('swapped') && 
      complaint.corrected_transcript.includes('deposited'),
      'Slang interceptor successfully normalized Luganda terms to legal English'
    );
    console.log(`🔍 Corrected Transcript: "${complaint.corrected_transcript}"`);


    // Test 2: Multi-Tenancy Boundary Isolation (MTN operator trying to access/mutate Airtel complaint)
    console.log('\n--- Test 2: Multi-Tenancy Boundary Isolation ---');
    
    // First, let's ingest an Airtel complaint
    const airtelComplaintPayload = {
      caller_number: '+256701111222',
      network_provider: 'airtel',
      category: 'voice_scam',
      district: 'Kampala',
      channel_source: 'ussd',
      amount_ugx: 200000
    };
    
    const airtelIngestRes = await fetch(`${BASE_URL}/ingest/complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(airtelComplaintPayload)
    });
    const airtelComplaintData = await airtelIngestRes.json();
    const airtelComplaintId = airtelComplaintData.complaint.id;

    // Now, attempt to resolve this Airtel complaint with MTN operator identity headers
    const illegalActionRes = await fetch(`${BASE_URL}/telecom/action`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Operator-Identity': 'mtn' // Attempting to act as MTN
      },
      body: JSON.stringify({
        action: 'resolve_dispute',
        complaint_id: airtelComplaintId,
        operator_identity: 'mtn_agent_fake'
      })
    });

    assert(illegalActionRes.status === 403, 'Cross-tenant mutation returns HTTP 403 Forbidden');
    const illegalData = await illegalActionRes.json();
    assert(illegalData.error.includes('Access Denied'), 'Error message states Access Denied');


    // Test 3: Authorized Telecom Operations (Airtel operator acting on Airtel complaint)
    console.log('\n--- Test 3: Authorized Operator Actions ---');
    
    // 3a. Wallet Freeze
    const freezeRes = await fetch(`${BASE_URL}/telecom/action`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Operator-Identity': 'airtel' // Correct provider
      },
      body: JSON.stringify({
        action: 'wallet_freeze',
        complaint_id: airtelComplaintId,
        operator_identity: 'airtel_agent_valid',
        target_phone: '+256701111222'
      })
    });
    assert(freezeRes.status === 200, 'Wallet Freeze by authorized operator returns HTTP 200 OK');
    const freezeData = await freezeRes.json();
    assert(freezeData.message.includes('frozen successfully'), 'Wallet freeze reports success message');

    // 3b. Flash SMS Intercept Nudge
    const flashRes = await fetch(`${BASE_URL}/telecom/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operator-Identity': 'airtel'
      },
      body: JSON.stringify({
        action: 'flash_sms_intercept',
        complaint_id: airtelComplaintId,
        operator_identity: 'airtel_agent_valid',
        target_phone: '+256701111222'
      })
    });
    assert(flashRes.status === 200, 'Flash SMS Intercept returns HTTP 200 OK');
    const flashData = await flashRes.json();
    assert(flashData.message.includes('Class 0 Flash SMS Intercept nudge delivered'), 'Flash SMS reports delivery message');

    // 3c. Resolve Dispute
    const resolveRes = await fetch(`${BASE_URL}/telecom/action`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Operator-Identity': 'airtel'
      },
      body: JSON.stringify({
        action: 'resolve_dispute',
        complaint_id: airtelComplaintId,
        operator_identity: 'airtel_agent_valid'
      })
    });
    assert(resolveRes.status === 200, 'Resolve dispute returns HTTP 200 OK');
    const resolveData = await resolveRes.json();
    assert(resolveData.complaint.status === 'resolved', 'Complaint status in database is now resolved');


    // Test 4: BoU Regulatory Surveillance Aggregation
    console.log('\n--- Test 4: BoU Surveillance Aggregation ---');
    const surveillanceRes = await fetch(`${BASE_URL}/bou/surveillance`);
    assert(surveillanceRes.status === 200, 'Surveillance endpoint returns HTTP 200 OK');
    
    const aggregates = await surveillanceRes.json();
    assert(aggregates.totalLossSwingsUGX > 0, 'Total loss swings aggregate returns a positive sum');
    assert(aggregates.districtAggregates !== undefined, 'Response includes district aggregates');
    assert(aggregates.channelAggregates !== undefined, 'Response includes channel aggregates');
    assert(aggregates.complianceRankings.length > 0, 'Response includes SLA compliance rankings per operator');
    console.log('🔍 Compliance Rankings:', aggregates.complianceRankings);


    // Test 5: SLA Enforce Sanction Check
    console.log('\n--- Test 5: SLA Enforce & Escalation Timer ---');
    const sanctionRes = await fetch(`${BASE_URL}/bou/enforce/sanction`, { method: 'POST' });
    assert(sanctionRes.status === 200, 'Sanction cron enforcement returns HTTP 200 OK');
    const sanctionData = await sanctionRes.json();
    assert(sanctionData.message.includes('SLA compliance check completed'), 'Sanction run reports compliance check completion');
    
    console.log('--------------------------------------------------');
    console.log(`🏁 Test Summary: Passed ${testPassed}/${testPassed + testFailed} tests`);
    console.log('--------------------------------------------------');

    if (testFailed > 0) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }

  } catch (err) {
    console.error('💥 Test Execution Error:', err.message);
    process.exitCode = 1;
  }
}

// Run tests directly
runTests();
