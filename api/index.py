import os
import random
from flask import Flask, request, render_template, make_response, jsonify, session, redirect

# Fallback import logic for local running and Vercel serverless execution
try:
    from database import (
        init_db, create_complaint, get_complaint, get_all_complaints,
        get_provider_complaints, update_status, escalate_complaint, get_stats
    )
except ImportError:
    from api.database import (
        init_db, create_complaint, get_complaint, get_all_complaints,
        get_provider_complaints, update_status, escalate_complaint, get_stats
    )

# Define explicit template directory relative to this script for Vercel Serverless Functions
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
app = Flask(__name__, template_folder=template_dir)

# Set app secret key for Flask signed session cookies
app.secret_key = 'bou_consumer_protection_ledger_secure_secret_key_2026'

# Initialize database on application startup
init_db()

# --- WEB PORTALS & AUTHENTICATION ---

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/user')
def user_portal():
    return render_template('user.html')

@app.route('/login/<role>', methods=['GET', 'POST'])
def login(role):
    role_clean = role.lower()
    if role_clean not in ['mtn', 'airtel', 'bou']:
        return "Invalid Role Portal", 404
        
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        authorized = False
        if role_clean == 'mtn' and username == 'mtn_compliance' and password == 'mtn123':
            session['role'] = 'MTN'
            authorized = True
        elif role_clean == 'airtel' and username == 'airtel_compliance' and password == 'airtel123':
            session['role'] = 'AIRTEL'
            authorized = True
        elif role_clean == 'bou' and username == 'bou_supervisor' and password == 'bou123':
            session['role'] = 'BOU'
            authorized = True
            
        if authorized:
            if role_clean == 'bou':
                return redirect('/bou')
            return redirect(f'/provider/{role_clean.upper()}')
        else:
            return render_template('login.html', role=role_clean, error=True)
            
    return render_template('login.html', role=role_clean, error=False)

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/provider/<provider_name>')
def provider_portal(provider_name):
    p_name = provider_name.upper()
    if p_name not in ['MTN', 'AIRTEL']:
        return "Invalid Provider Desk", 404
        
    # Enforce role access control: must match MTN or AIRTEL
    if session.get('role') != p_name:
        return redirect(f'/login/{p_name.lower()}')
        
    return render_template('provider.html', provider_name=p_name)

@app.route('/bou')
def bou_portal():
    # Enforce role access control: must match BOU
    if session.get('role') != 'BOU':
        return redirect('/login/bou')
        
    return render_template('bou.html')

# --- API ENDPOINTS ---

@app.route('/api/complaints', methods=['POST'])
def api_create_complaint():
    phone_number = request.values.get("phone_number")
    provider = request.values.get("provider")
    fraud_type = request.values.get("fraud_type")
    amount = request.values.get("amount", 0.0)
    notes = request.values.get("notes", "")

    if not phone_number or not provider or not fraud_type:
        return jsonify({"error": "Missing required fields"}), 400

    # Generate a unique Incident ID: FG-XXXX
    complaint_id = f"FG-{random.randint(1000, 9999)}"
    while get_complaint(complaint_id) is not None:
        complaint_id = f"FG-{random.randint(1000, 9999)}"

    # Save to SQLite
    create_complaint(complaint_id, phone_number, provider, fraud_type, amount, language='Web')
    
    # Update notes
    if notes:
        update_status(complaint_id, 'PENDING', notes)

    return jsonify({"id": complaint_id})

@app.route('/api/complaints', methods=['GET'])
def api_get_all_complaints():
    return jsonify(get_all_complaints())

@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def api_get_complaint(complaint_id):
    complaint = get_complaint(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify(complaint)

@app.route('/api/provider/<provider_name>/complaints', methods=['GET'])
def api_get_provider_complaints(provider_name):
    p_name = provider_name.upper()
    return jsonify(get_provider_complaints(p_name))

@app.route('/api/complaints/<complaint_id>/status', methods=['POST'])
def api_update_status(complaint_id):
    status = request.values.get("status")
    notes = request.values.get("notes")
    
    if not status or not notes:
        return jsonify({"error": "Missing status or notes"}), 400

    update_status(complaint_id, status, notes)
    return jsonify({"status": "success"})

@app.route('/api/complaints/<complaint_id>/escalate', methods=['POST'])
def api_escalate(complaint_id):
    escalate_complaint(complaint_id)
    return jsonify({"status": "success"})

@app.route('/api/stats', methods=['GET'])
def api_get_stats():
    return jsonify(get_stats())

# --- USSD WEBHOOK ---

@app.route("/ussd", methods=['POST'])
def ussd():
    session_id   = request.values.get("sessionId", None)
    serviceCode  = request.values.get("serviceCode", None)
    phone_number = request.values.get("phoneNumber", None)
    text         = request.values.get("text", "")

    response = ""

    if text == '':
        response = ("CON BoU Consumer Protection\n"
                    "1. Report Mobile Money Fraud\n"
                    "2. Track Active Complaint\n"
                    "3. Change Language / Ennimi")
   
    # --- BRANCH 1: REPORT FRAUD ---
    elif text == '1':
        response = ("CON Select Affected Provider:\n"
                    "1. MTN Uganda\n"
                    "2. Airtel Uganda")
                    
    elif text == '1*1' or text == '1*2':
        provider = 'MTN' if text == '1*1' else 'Airtel'
        
        # Generate a unique Incident ID: FG-XXXX for the USSD ticket
        complaint_id = f"FG-{random.randint(1000, 9999)}"
        while get_complaint(complaint_id) is not None:
            complaint_id = f"FG-{random.randint(1000, 9999)}"
            
        # Create a database record for this USSD filing
        create_complaint(
            complaint_id, phone_number, provider, 'Mobile Money Fraud', 0.0, language='USSD'
        )
        update_status(complaint_id, 'PENDING', f"[USSD Ingestion] Citizen reported {provider} MM fraud from handset.")
        
        response = (f"END Thank you. The Bank of Uganda platform is calling your number ({phone_number}) "
                    f"immediately to record your voice complaint. Ticket: {complaint_id}.")
        
        # Trigger background microservices
        trigger_ivr_voice_callback(phone_number, provider, session_id)

    # --- BRANCH 2: TRACK COMPLAINT ---
    elif text == '2':
        # Lookup database for active complaints associated with this phone number
        all_cases = get_all_complaints()
        user_cases = [c for c in all_cases if c['phone_number'] == phone_number]
        
        if len(user_cases) > 0:
            # Show status of the most recent complaint
            latest = user_cases[0]
            status_clean = latest['status'].replace('_', ' ')
            response = f"END Active Case ({latest['id']}): {status_clean}.\nDetails: {latest['notes'][:40]}..."
        else:
            response = f"END No active complaints found for your phone number ({phone_number})."
            
        trigger_status_audio_call(phone_number)

    # --- BRANCH 3: LANGUAGE PREFERENCE ---
    elif text == '3':
        response = ("CON Londa Ennimi / Choose Language:\n"
                    "1. English\n"
                    "2. Luganda\n"
                    "3. Runyakitara")
                    
    elif text.startswith('3*') and len(text.split('*')) == 2:
        lang_choice = text.split('*')[1]
        chosen_lang = 'English'
        
        if lang_choice == '2':
            chosen_lang = 'Luganda'
        elif lang_choice == '3':
            chosen_lang = 'Runyakitara'

        response = f"END Preferred language updated to {chosen_lang}. Your future automated interactions will reflect this."
        update_user_language(phone_number, chosen_lang)

    # --- FALLBACK ERROR STATE ---
    else:
        response = f"END Invalid entry selection. Please redial {serviceCode}"

    resp = make_response(response)
    resp.headers['Content-Type'] = 'text/plain'
    return resp

# --- SIMULATED ASYNC BACKGROUND HOOKS ---
def trigger_ivr_voice_callback(phone, provider, session):
    print(f"[LEDGER EVENT] Ticket created dynamically via USSD.")
    print(f"[ROUTING] Dual-routing payload to BoU and {provider} dashboards.")
    print(f"[IVR ENGINE] Pinging Telephony Gateway to dial {phone} for local speech capture.")

def trigger_status_audio_call(phone):
    print(f"[DATABASE] Checking active ticket status for subscriber: {phone}")
    print(f"[IVR ENGINE] Outbound status callback queued.")

def update_user_language(phone, lang):
    print(f"[USER LOG] Profile {phone} mapped to language preference: {lang}")

if __name__ == '__main__':
    app.run(debug=True)
