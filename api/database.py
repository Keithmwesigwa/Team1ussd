import os
import sqlite3
from datetime import datetime, timedelta

def get_db_path():
    # If running on Vercel, use /tmp (Vercel allows writing to /tmp)
    if os.environ.get('VERCEL') == '1':
        return '/tmp/complaints.db'
    # Locally, save it inside the api directory
    return os.path.abspath(os.path.join(os.path.dirname(__file__), 'complaints.db'))

def get_connection():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create Complaints Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            phone_number TEXT,
            provider TEXT,
            fraud_type TEXT,
            amount REAL,
            status TEXT DEFAULT 'PENDING',
            language TEXT DEFAULT 'English',
            created_at TEXT,
            updated_at TEXT,
            notes TEXT,
            sla_deadline TEXT,
            escalated INTEGER DEFAULT 0
        )
    ''')
    
    # Check if we have sample data, if not, insert some
    cursor.execute("SELECT COUNT(*) FROM complaints")
    if cursor.fetchone()[0] == 0:
        now = datetime.now()
        
        # 1. Active Telecom A Case (Reported 2 hours ago)
        created_1 = (now - timedelta(hours=2)).isoformat()
        deadline_1 = (now - timedelta(hours=2) + timedelta(hours=48)).isoformat()
        cursor.execute('''
            INSERT INTO complaints (id, phone_number, provider, fraud_type, amount, status, language, created_at, updated_at, notes, sla_deadline, escalated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'FG-8241', '+256770123456', 'TELECOM A', 'USSD Reported', 150000.0, 'PENDING', 'English',
            created_1, created_1, 'Subscriber reports unauthorized SIM swap on their line.', deadline_1, 0
        ))
        
        # 2. Resolved Telecom B Case (Reported 50 hours ago, resolved 10 hours ago)
        created_2 = (now - timedelta(hours=50)).isoformat()
        resolved_2 = (now - timedelta(hours=10)).isoformat()
        deadline_2 = (now - timedelta(hours=50) + timedelta(hours=48)).isoformat()
        cursor.execute('''
            INSERT INTO complaints (id, phone_number, provider, fraud_type, amount, status, language, created_at, updated_at, notes, sla_deadline, escalated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'FG-1001', '+256701987654', 'TELECOM B', 'Card/Bank Fraud', 500000.0, 'RESOLVED', 'Luganda',
            created_2, resolved_2, 'Reversal processed. Funds restored.', deadline_2, 0
        ))
        
        # 3. Overdue SLA-Breached Telecom A Case (Reported 72 hours ago, still pending)
        created_3 = (now - timedelta(hours=72)).isoformat()
        deadline_3 = (now - timedelta(hours=72) + timedelta(hours=48)).isoformat()
        cursor.execute('''
            INSERT INTO complaints (id, phone_number, provider, fraud_type, amount, status, language, created_at, updated_at, notes, sla_deadline, escalated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'FG-4099', '+256772223344', 'TELECOM A', 'Identity Theft', 2000000.0, 'PENDING', 'Runyakitara',
            created_3, created_3, 'Subscriber reports SIM takeover on Telecom A.', deadline_3, 0
        ))
        
        conn.commit()
    
    conn.close()

def create_complaint(complaint_id, phone_number, provider, fraud_type, amount, language='English', notes=None):
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now()
    created_at = now.isoformat()
    sla_deadline = (now + timedelta(hours=48)).isoformat()
    if notes is None:
        notes = "Complaint received and logged in FraudGuard ledger."
    
    cursor.execute('''
        INSERT INTO complaints (id, phone_number, provider, fraud_type, amount, status, language, created_at, updated_at, notes, sla_deadline, escalated)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 0)
    ''', (complaint_id, phone_number, provider.upper(), fraud_type, float(amount), language, created_at, created_at, notes, sla_deadline))
    
    conn.commit()
    conn.close()
    return complaint_id

def get_complaint(complaint_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_complaints():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_provider_complaints(provider):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE UPPER(provider) = UPPER(?) ORDER BY created_at DESC", (provider,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_status(complaint_id, status, notes):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute('''
        UPDATE complaints
        SET status = ?, notes = ?, updated_at = ?
        WHERE id = ?
    ''', (status, notes, now, complaint_id))
    
    conn.commit()
    conn.close()

def escalate_complaint(complaint_id):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE complaints
        SET escalated = 1
        WHERE id = ?
    ''', (complaint_id,))
    
    conn.commit()
    conn.close()

def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    
    now_str = datetime.now().isoformat()
    
    # Total
    cursor.execute("SELECT COUNT(*) FROM complaints")
    total = cursor.fetchone()[0]
    
    # Active (Pending & Under Investigation)
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status != 'RESOLVED'")
    active = cursor.fetchone()[0]
    
    # Resolved
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status = 'RESOLVED'")
    resolved = cursor.fetchone()[0]
    
    # SLA Breached (Not resolved and past deadline)
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status != 'RESOLVED' AND ? > sla_deadline", (now_str,))
    breached = cursor.fetchone()[0]
    
    # Telecom A Stats
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE UPPER(provider) = 'TELECOM A'")
    telecom_a_total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE UPPER(provider) = 'TELECOM A' AND status = 'RESOLVED'")
    telecom_a_resolved = cursor.fetchone()[0]
    
    # Telecom B Stats
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE UPPER(provider) = 'TELECOM B'")
    telecom_b_total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE UPPER(provider) = 'TELECOM B' AND status = 'RESOLVED'")
    telecom_b_resolved = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "total": total,
        "active": active,
        "resolved": resolved,
        "breached": breached,
        "telecom_a_total": telecom_a_total,
        "telecom_a_resolved": telecom_a_resolved,
        "telecom_b_total": telecom_b_total,
        "telecom_b_resolved": telecom_b_resolved
    }

def check_phone_number(phone):
    conn = get_connection()
    cursor = conn.cursor()
    clean_number = phone.strip()
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE phone_number = ? OR notes LIKE ?", (clean_number, f"%{clean_number}%"))
    count = cursor.fetchone()[0]
    conn.close()
    return count

