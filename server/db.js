const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Check if PostgreSQL environment variables are configured
const isPgConfigured = process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD);
let pool = null;

if (isPgConfigured) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 5432,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    console.log('PostgreSQL Pool initialized.');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool, falling back to Mock DB:', err.message);
    pool = null;
  }
}

// Mock Database Path
const mockDbPath = path.join(__dirname, 'mock_db.json');

// Initialize Mock Database File if it doesn't exist
const initialSubscribers = [
  { id: 'sub-uuid-1', phone_number: '+256772123456', identity_imsi: 'IMSI624010123456789', language_preference: 'lg', primary_wallet_provider: 'mtn', wallet_frozen: false },
  { id: 'sub-uuid-2', phone_number: '+256701987654', identity_imsi: 'IMSI624020987654321', language_preference: 'en', primary_wallet_provider: 'airtel', wallet_frozen: false },
  { id: 'sub-uuid-3', phone_number: '+256752555666', identity_imsi: 'IMSI624020555666777', language_preference: 'rny', primary_wallet_provider: 'airtel', wallet_frozen: false },
  { id: 'sub-uuid-4', phone_number: '+256788111222', identity_imsi: 'IMSI624010111222333', language_preference: 'en', primary_wallet_provider: 'mtn', wallet_frozen: false },
  { id: 'sub-uuid-5', phone_number: '+256777888999', identity_imsi: 'IMSI624010777888999', language_preference: 'lg', primary_wallet_provider: 'mtn', wallet_frozen: false }
];

const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
const hoursAhead = (h) => new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();

const initialComplaints = [
  {
    id: 'complaint-uuid-1',
    ticket_reference: 'BOU-2026-004821',
    subscriber_id: 'sub-uuid-1',
    subscriber_phone: '+256772123456',
    network_provider: 'mtn',
    category: 'sim_swap',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004821.mp3',
    initial_transcript: 'Kussa ssente zange ku simu naye nfunye sms nti sim yange ekyusiddwa mu ma-veelo awatali kussa PIN ye y\'ekyama yange',
    corrected_transcript: 'I deposited money on my phone but I received an SMS that my SIM card was swapped under the table without entering my secret PIN.',
    status: 'escalated',
    district: 'Kampala',
    channel_source: 'app',
    amount_ugx: 450000,
    sla_deadline: hoursAhead(2.5), // < 6 hours left, will trigger warning animation
    created_at: hoursAgo(45.5)
  },
  {
    id: 'complaint-uuid-2',
    ticket_reference: 'BOU-2026-004810',
    subscriber_id: 'sub-uuid-2',
    subscriber_phone: '+256701987654',
    network_provider: 'airtel',
    category: 'voice_scam',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004810.mp3',
    initial_transcript: 'Aba airtel bankubidde essimu nti ntwangudde emmotoka naye bampise kussa PIN ye y\'ekyama yange ne batwala ssente zange zonna ku wallet',
    corrected_transcript: 'Someone from Airtel called saying I won a car, but they coerced me to enter my secret PIN and they took all the money from my wallet.',
    status: 'under_review',
    district: 'Gulu',
    channel_source: 'ivr',
    amount_ugx: 780000,
    sla_deadline: hoursAhead(4.2), // < 6 hours left, will trigger warning animation
    created_at: hoursAgo(43.8)
  },
  {
    id: 'complaint-uuid-3',
    ticket_reference: 'BOU-2026-004819',
    subscriber_id: 'sub-uuid-5',
    subscriber_phone: '+256777888999',
    network_provider: 'mtn',
    category: 'overcharge',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004819.mp3',
    initial_transcript: 'Nabadde ntuma ssente naye bankubye sente nyingi nnyo ku transaction fee',
    corrected_transcript: 'I was sending money but they charged me too much transaction fees.',
    status: 'resolved',
    district: 'Masaka',
    channel_source: 'ussd',
    amount_ugx: 50000,
    sla_deadline: hoursAhead(38),
    created_at: hoursAgo(10)
  },
  {
    id: 'complaint-uuid-4',
    ticket_reference: 'BOU-2026-004818',
    subscriber_id: 'sub-uuid-3',
    subscriber_phone: '+256752555666',
    network_provider: 'airtel',
    category: 'sim_swap',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004818.mp3',
    initial_transcript: 'Simu yange evuddeko service ne banyaga ssente zange ku mobile money ku ssimu endala',
    corrected_transcript: 'My SIM card lost service and they stole my money on Mobile Money using another phone.',
    status: 'under_review',
    district: 'Mbarara',
    channel_source: 'sms',
    amount_ugx: 1200000,
    sla_deadline: hoursAhead(46.2),
    created_at: hoursAgo(1.8)
  },
  {
    id: 'complaint-uuid-5',
    ticket_reference: 'BOU-2026-004817',
    subscriber_id: 'sub-uuid-4',
    subscriber_phone: '+256788111222',
    network_provider: 'mtn',
    category: 'voice_scam',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004817.mp3',
    initial_transcript: 'Omusajja ampikye kussa ssente ku nnamba endala nti mwana wange ali mu ddwaliro',
    corrected_transcript: 'A man coerced me to deposit money on another number claiming my child is in the hospital.',
    status: 'resolved',
    district: 'Jinja',
    channel_source: 'pwa',
    amount_ugx: 300000,
    sla_deadline: hoursAhead(18),
    created_at: hoursAgo(30)
  }
];

const initialAuditLogs = [
  { id: 'log-uuid-1', complaint_id: 'complaint-uuid-3', action_taken: 'resolve_dispute', operator_identity: 'mtn_agent_99', timestamp: hoursAgo(9) },
  { id: 'log-uuid-2', complaint_id: 'complaint-uuid-5', action_taken: 'resolve_dispute', operator_identity: 'mtn_agent_45', timestamp: hoursAgo(28) }
];

const initialPwaComplaints = [
  {
    id: 'pwa-complaint-uuid-1',
    ticket_reference: 'BOU-PWA-2026-X982',
    phone_number: '+256772123456',
    category: 'fraud',
    provider: 'mtn',
    transaction_id: 'TXN100200300',
    narrative: 'A caller claiming to be an MTN agent tricked me into swapping my SIM card and stole money.',
    status: 'escalated',
    created_at: hoursAgo(2)
  },
  {
    id: 'pwa-complaint-uuid-2',
    ticket_reference: 'BOU-PWA-2026-Y479',
    phone_number: '+256772123456',
    category: 'overcharge',
    provider: 'airtel',
    transaction_id: 'TXN998877',
    narrative: 'I was charged twice for a mobile money sending transaction of 50000 UGX.',
    status: 'resolved',
    created_at: hoursAgo(72)
  }
];

const initialPwaChatMessages = [
  {
    id: 'chat-uuid-1',
    ticket_reference: 'BOU-PWA-2026-X982',
    sender_type: 'citizen',
    message_text: 'Hello, my MTN wallet was frozen but the fraudster still managed to swap my SIM card. Please check.',
    created_at: hoursAgo(1.8)
  },
  {
    id: 'chat-uuid-2',
    ticket_reference: 'BOU-PWA-2026-X982',
    sender_type: 'operator',
    message_text: 'Thank you for reporting. We have escalated the issue to the MTN Fraud Risk team.',
    created_at: hoursAgo(1.2)
  }
];

function loadMockDb() {
  const defaultData = {
    subscribers: initialSubscribers,
    complaints: initialComplaints,
    auditLogs: initialAuditLogs,
    pwaComplaints: initialPwaComplaints,
    pwaChatMessages: initialPwaChatMessages
  };
  
  if (!fs.existsSync(mockDbPath)) {
    fs.writeFileSync(mockDbPath, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }
  try {
    const dataStr = fs.readFileSync(mockDbPath, 'utf8');
    const parsed = JSON.parse(dataStr);
    
    // Ensure all tables exist in parsed object
    let modified = false;
    if (!parsed.pwaComplaints) {
      parsed.pwaComplaints = initialPwaComplaints;
      modified = true;
    }
    if (!parsed.pwaChatMessages) {
      parsed.pwaChatMessages = initialPwaChatMessages;
      modified = true;
    }
    if (modified) {
      saveMockDb(parsed);
    }
    return parsed;
  } catch (err) {
    console.error('Failed to parse mock_db.json, recreating...', err);
    fs.writeFileSync(mockDbPath, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }
}

function saveMockDb(data) {
  try {
    fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save mock database file:', err);
  }
}

// Create db directory if it doesn't exist
const dbDir = path.dirname(mockDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Database helper functions (unified interface for PostgreSQL and Mock DB)
const db = {
  // Subscribers
  async getSubscriberByPhone(phoneNumber) {
    if (pool) {
      const res = await pool.query('SELECT * FROM Subscribers WHERE phone_number = $1', [phoneNumber]);
      return res.rows[0];
    } else {
      const data = loadMockDb();
      return data.subscribers.find(s => s.phone_number === phoneNumber);
    }
  },

  async createSubscriber(sub) {
    if (pool) {
      const res = await pool.query(
        'INSERT INTO Subscribers(id, phone_number, identity_imsi, language_preference, primary_wallet_provider) VALUES($1, $2, $3, $4, $5) RETURNING *',
        [sub.id, sub.phone_number, sub.identity_imsi, sub.language_preference, sub.primary_wallet_provider]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      data.subscribers.push({ ...sub, wallet_frozen: false });
      saveMockDb(data);
      return sub;
    }
  },

  async updateSubscriberWalletFreeze(phoneNumber, frozen) {
    if (pool) {
      const res = await pool.query(
        'UPDATE Subscribers SET wallet_frozen = $1 WHERE phone_number = $2 RETURNING *',
        [frozen, phoneNumber]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      const sub = data.subscribers.find(s => s.phone_number === phoneNumber);
      if (sub) {
        sub.wallet_frozen = frozen;
        saveMockDb(data);
      }
      return sub;
    }
  },

  // Complaints
  async getComplaints(operator = null) {
    if (pool) {
      let query = 'SELECT c.*, s.phone_number as subscriber_phone FROM Complaints c JOIN Subscribers s ON c.subscriber_id = s.id';
      const params = [];
      if (operator) {
        query += ' WHERE c.network_provider = $1';
        params.push(operator);
      }
      query += ' ORDER BY c.created_at DESC';
      const res = await pool.query(query, params);
      return res.rows;
    } else {
      const data = loadMockDb();
      let complaints = data.complaints;
      if (operator) {
        complaints = complaints.filter(c => c.network_provider === operator);
      }
      return complaints.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async getComplaintById(id) {
    if (pool) {
      const res = await pool.query(
        'SELECT c.*, s.phone_number as subscriber_phone FROM Complaints c JOIN Subscribers s ON c.subscriber_id = s.id WHERE c.id = $1',
        [id]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      return data.complaints.find(c => c.id === id);
    }
  },

  async createComplaint(complaint) {
    if (pool) {
      const res = await pool.query(
        `INSERT INTO Complaints(id, ticket_reference, subscriber_id, network_provider, category, raw_audio_url, 
          initial_transcript, corrected_transcript, status, district, channel_source, amount_ugx, sla_deadline, created_at) 
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          complaint.id, complaint.ticket_reference, complaint.subscriber_id, complaint.network_provider,
          complaint.category, complaint.raw_audio_url, complaint.initial_transcript, complaint.corrected_transcript,
          complaint.status, complaint.district, complaint.channel_source, complaint.amount_ugx, complaint.sla_deadline, complaint.created_at
        ]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      data.complaints.push(complaint);
      saveMockDb(data);
      return complaint;
    }
  },

  async updateComplaintStatus(id, status) {
    if (pool) {
      const res = await pool.query(
        'UPDATE Complaints SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      const complaint = data.complaints.find(c => c.id === id);
      if (complaint) {
        complaint.status = status;
        saveMockDb(data);
      }
      return complaint;
    }
  },

  // Audit Logs
  async getAuditLogs() {
    if (pool) {
      const res = await pool.query('SELECT * FROM SLA_Audit_Logs ORDER BY timestamp DESC');
      return res.rows;
    } else {
      const data = loadMockDb();
      return data.auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  },

  async createAuditLog(log) {
    if (pool) {
      const res = await pool.query(
        'INSERT INTO SLA_Audit_Logs(id, complaint_id, action_taken, operator_identity, timestamp) VALUES($1, $2, $3, $4, $5) RETURNING *',
        [log.id, log.complaint_id, log.action_taken, log.operator_identity, log.timestamp]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      data.auditLogs.push(log);
      saveMockDb(data);
      return log;
    }
  },

  // PWA Complaints Methods
  async getPwaComplaints(phone) {
    if (pool) {
      const res = await pool.query(
        'SELECT * FROM PWA_Complaints WHERE phone_number = $1 ORDER BY created_at DESC',
        [phone]
      );
      return res.rows;
    } else {
      const data = loadMockDb();
      return (data.pwaComplaints || []).filter(c => c.phone_number === phone).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async getPwaComplaintByReference(ref) {
    if (pool) {
      const res = await pool.query(
        'SELECT * FROM PWA_Complaints WHERE ticket_reference = $1',
        [ref]
      );
      return res.rows[0] || null;
    } else {
      const data = loadMockDb();
      return (data.pwaComplaints || []).find(c => c.ticket_reference === ref) || null;
    }
  },

  async createPwaComplaint(complaint) {
    if (pool) {
      const res = await pool.query(
        'INSERT INTO PWA_Complaints(id, ticket_reference, phone_number, category, provider, transaction_id, narrative, status, created_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [
          complaint.id,
          complaint.ticket_reference,
          complaint.phone_number,
          complaint.category,
          complaint.provider,
          complaint.transaction_id || null,
          complaint.narrative,
          complaint.status || 'ingested',
          complaint.created_at || new Date().toISOString()
        ]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      data.pwaComplaints = data.pwaComplaints || [];
      const newComp = {
        id: complaint.id,
        ticket_reference: complaint.ticket_reference,
        phone_number: complaint.phone_number,
        category: complaint.category,
        provider: complaint.provider,
        transaction_id: complaint.transaction_id || null,
        narrative: complaint.narrative,
        status: complaint.status || 'ingested',
        created_at: complaint.created_at || new Date().toISOString()
      };
      data.pwaComplaints.push(newComp);
      saveMockDb(data);
      return newComp;
    }
  },

  // PWA Chat Messages Methods
  async getPwaChatMessages(ref) {
    if (pool) {
      const res = await pool.query(
        'SELECT id, ticket_reference, sender_type, message_text, created_at FROM PWA_Chat_Messages WHERE ticket_reference = $1 ORDER BY created_at ASC',
        [ref]
      );
      return res.rows;
    } else {
      const data = loadMockDb();
      return (data.pwaChatMessages || [])
        .filter(m => m.ticket_reference === ref)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(m => ({
          id: m.id,
          ticket_reference: m.ticket_reference,
          sender_type: m.sender_type,
          message_text: m.message_text,
          created_at: m.created_at
        }));
    }
  },

  async createPwaChatMessage(msg) {
    if (pool) {
      const res = await pool.query(
        'INSERT INTO PWA_Chat_Messages(id, ticket_reference, sender_type, message_text, created_at) VALUES($1, $2, $3, $4, $5) RETURNING *',
        [
          msg.id || null,
          msg.ticket_reference,
          msg.sender_type,
          msg.message_text,
          msg.created_at || new Date().toISOString()
        ]
      );
      return res.rows[0];
    } else {
      const data = loadMockDb();
      data.pwaChatMessages = data.pwaChatMessages || [];
      const newMsg = {
        id: msg.id || 'chat-' + Math.random().toString(36).substring(2, 11),
        ticket_reference: msg.ticket_reference,
        sender_type: msg.sender_type,
        message_text: msg.message_text,
        created_at: msg.created_at || new Date().toISOString()
      };
      data.pwaChatMessages.push(newMsg);
      saveMockDb(data);
      return newMsg;
    }
  },

  // Helper to reset database
  resetMockDb() {
    if (fs.existsSync(mockDbPath)) {
      fs.unlinkSync(mockDbPath);
    }
    loadMockDb();
  },

  // Analytics
  async getLiveGeospatialMetrics(operator = null) {
    if (pool) {
      let baseFilter = operator ? "AND network_provider = $1" : "";
      const params = operator ? [operator] : [];
      
      const query = `
        WITH recent_60m AS (
          SELECT district, COUNT(*) as current_vol
          FROM Complaints
          WHERE created_at >= NOW() - INTERVAL '60 minutes'
          ${baseFilter}
          GROUP BY district
        ),
        baseline_12h AS (
          SELECT district, COUNT(*)::float / 12.0 as avg_hourly_vol
          FROM Complaints
          WHERE created_at >= NOW() - INTERVAL '12 hours'
            AND created_at < NOW() - INTERVAL '60 minutes'
          ${baseFilter}
          GROUP BY district
        )
        SELECT 
          COALESCE(r.district, b.district) as district,
          COALESCE(r.current_vol, 0) as current_vol,
          COALESCE(b.avg_hourly_vol, 0) as avg_hourly_vol
        FROM recent_60m r
        FULL OUTER JOIN baseline_12h b ON r.district = b.district
      `;
      
      const res = await pool.query(query, params);
      
      return res.rows.map(row => {
        const current = parseInt(row.current_vol);
        const baseline = parseFloat(row.avg_hourly_vol);
        
        let surge_percent = 0;
        let hazard_state = 'MONITORING';
        
        if (baseline > 0) {
          surge_percent = ((current - baseline) / baseline) * 100;
        } else if (current > 0) {
          surge_percent = 100;
        }
        
        if (surge_percent > 20) {
          hazard_state = 'CRITICAL';
        } else if (surge_percent > 10) {
          hazard_state = 'WARNING';
        }
        
        return {
          district: row.district,
          current_vol: current,
          baseline_vol: baseline.toFixed(2),
          surge_percent: surge_percent.toFixed(2),
          hazard_state
        };
      });
    } else {
      const data = loadMockDb();
      let complaints = data.complaints;
      if (operator) {
        complaints = complaints.filter(c => c.network_provider === operator);
      }
      
      const now = new Date();
      const past60m = new Date(now.getTime() - 60 * 60 * 1000);
      const past12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      
      const recent = {};
      const baseline = {};
      
      complaints.forEach(c => {
        const d = new Date(c.created_at);
        const dist = c.district || 'Other';
        if (d >= past60m) {
          recent[dist] = (recent[dist] || 0) + 1;
        } else if (d >= past12h && d < past60m) {
          baseline[dist] = (baseline[dist] || 0) + 1;
        }
      });
      
      const districts = [...new Set([...Object.keys(recent), ...Object.keys(baseline)])];
      return districts.map(dist => {
        const current = recent[dist] || 0;
        const baseAvg = (baseline[dist] || 0) / 12.0;
        
        let surge = 0;
        let hazard_state = 'MONITORING';
        if (baseAvg > 0) surge = ((current - baseAvg) / baseAvg) * 100;
        else if (current > 0) surge = 100;
        
        if (surge > 20) hazard_state = 'CRITICAL';
        else if (surge > 10) hazard_state = 'WARNING';
        
        return {
          district: dist,
          current_vol: current,
          baseline_vol: baseAvg.toFixed(2),
          surge_percent: surge.toFixed(2),
          hazard_state
        };
      });
    }
  }
};

module.exports = db;
