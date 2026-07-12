import os
import random
import string
from flask import (Flask, request, render_template, make_response,
                   redirect, url_for, session, jsonify)

# ─── App setup ───────────────────────────────────────────────────────────────
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
app = Flask(__name__, template_folder=template_dir)
app.secret_key = os.environ.get('SECRET_KEY', 'fraudguard-bou-2026-dev-secret')

# Support running as `python api/index.py` (local) or as Vercel serverless (api/)
try:
    from api.database import (init_db, create_complaint, get_complaint,
                              get_all_complaints, get_provider_complaints,
                              update_status, escalate_complaint, get_stats,
                              check_phone_number)
except ImportError:
    from database import (init_db, create_complaint, get_complaint,
                          get_all_complaints, get_provider_complaints,
                          update_status, escalate_complaint, get_stats,
                          check_phone_number)

# Initialise DB + seed sample rows on cold start
init_db()

# ─── Portal credentials (must match hints shown in login.html) ────────────────
PORTAL_CREDS = {
    'mtn':    {'username': 'mtn_compliance',   'password': 'mtn123'},
    'airtel': {'username': 'airtel_compliance', 'password': 'airtel123'},
    'bou':    {'username': 'bou_supervisor',    'password': 'bou123'},
}

# ─── USSD in-memory session store ─────────────────────────────────────────────
user_session_store = {}

translation_matrix = {
    'en': {
        'welcome':          "Welcome to BoU Consumer Protection",
        'opt1':             "1. Report Mobile Money Fraud",
        'opt2':             "2. Track Active Complaint",
        'opt3':             "3. Change Language / Ennimi",
        'channel_choice':   "How would you like to report?\n1. Continue with USSD\n2. Switch to a Voice Call",
        'select_fraud_type':"Choose fraud type:\n1. Unauthorised transaction\n2. Scammers pretending to be {provider} staff\n3. Scammers pretending to have sent money to you",
        'ivr_redirect':     "Thank you. Your fraud incident under {provider} for {fraud_type} has been filed. The Bank of Uganda platform is calling you back right now to record your voice complaint. Please answer.",
        'ivr_switch':       "Connecting you to a fraud reporting voice call. Please answer your phone.",
        'status_redirect':  "Fetching status. You will receive an automated voice update call shortly.",
        'active_case':      "Active Case ({id}): {status}.\nDetails: {notes}...",
        'no_case':          "No active complaints found for your phone number ({phone}).",
        'lang_select':      "Londa Ennimi / Choose Language:",
        'invalid':          "Invalid selection. Please try again.",
    },
    'lg': {
        'welcome':          "Tusanyuse okulaba",
        'opt1':             "1. Loopa obufere",
        'opt2':             "2. Manya okugenda mu maaso kw'omusango",
        'opt3':             "3. Kyusa olulimi / Change Language",
        'channel_choice':   "Oyagala kukola mutya?\n1. Endedeeza mu USSD\n2. Talikira essimu",
        'select_fraud_type':"Londa ekika ky'obufere:\n1. Ssente ezitakkiriziddwa\n2. Abafere abeeyita abakozi ba {provider}\n3. Abafere abeeyita abakusindikidde ssente",
        'ivr_redirect':     "Weebale. Omusango gwo ogw'obufere ku {provider} ku {fraud_type} guwandiikiddwa. Banka enkulu eya Uganda (BoU) ekukubira essimu kaakano osodole okukwata eddoboozi lyo ery'okwemulugunya.",
        'ivr_switch':       "Tukukubirira essimu gy'okwemulugunya. Teeka essimu.",
        'status_redirect':  "Tukyakunonyeza omusango. Ojja kufuna essimu ekuwa ebirowoozo kaakano.",
        'active_case':      "Active Case ({id}) - Manya okugenda mu maaso: {status}.\nEbirowoozo: {notes}...",
        'no_case':          "Active Case: Tewali musango gwonna ogusangiddwa ku ssimu yo ({phone}).",
        'lang_select':      "Londa Ennimi / Choose Language:",
        'invalid':          "Okoze ensobi. Kyeyongere okugezaako.",
    },
    'rny': {
        'welcome':          "Nyamwanga ha weebura ya BoU y'okurinda abaguzi",
        'opt1':             "1. Handiika okwiba kw'esente z'omumasingo",
        'opt2':             "2. Mazima omusango gwawe oku guri",
        'opt3':             "3. Hindura Orurimi / Change Language",
        'channel_choice':   "Oyagala kuhandiika mutya?\n1. Endeeza mu USSD\n2. Gwata esimu",
        'select_fraud_type':"Toorana ekika ky'okwiba:\n1. Okwiha esente omu buryo butahikire\n2. Abashuma abeetwarra nka bakozi ba {provider}\n3. Abashuma abeetwarra ngu bakusindikira esente",
        'ivr_redirect':     "Webare. Omusango gwawe gw'okwiba ahari {provider} ku {fraud_type} gwahandiikwa. Banka enkulu eya Uganda ekuteerera esimu hati ngu okwate eiraka ryawe ry'okwemurugunya.",
        'ivr_switch':       "Tukuteererera esimu y'okwemurugunya. Gwata esimu yawe.",
        'status_redirect':  "Tukyaserura omusango gwawe. Noza kutunga esimu ekumanyisa hati.",
        'active_case':      "Active Case ({id}) - Manya omusango gwawe: {status}.\nEbirowoozo: {notes}...",
        'no_case':          "Active Case: Tihariho musango gw'okwiba ogusangirwe ahari esimu yawe ({phone}).",
        'lang_select':      "Toorana Orurimi / Choose Language:",
        'invalid':          "Okora enshobi. Yegarukemu.",
    },
}


def detect_provider(phone_number):
    """Infer mobile provider from Ugandan phone number prefix."""
    n = phone_number.replace(' ', '').replace('-', '')
    if n.startswith('+256'):
        prefix = n[4:6]
    elif n.startswith('256'):
        prefix = n[3:5]
    elif n.startswith('0'):
        prefix = n[1:3]
    else:
        prefix = n[:2]

    MTN_PREFIXES    = {'77', '78', '76', '39', '31'}
    AIRTEL_PREFIXES = {'70', '75', '74', '20'}

    if prefix in MTN_PREFIXES:
        return ('MTN Uganda', 'MTN')
    elif prefix in AIRTEL_PREFIXES:
        return ('Airtel Uganda', 'AIRTEL')
    else:
        return ('MTN Uganda', 'MTN')  # default fallback

# ═══════════════════════════════════════════════════════════════════════════════
# PORTAL ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def home():
    return render_template('index.html')

# ── Login ──────────────────────────────────────────────────────────────────────
@app.route('/login/<role>', methods=['GET', 'POST'])
def login(role):
    if role not in PORTAL_CREDS:
        return redirect(url_for('home'))

    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        creds    = PORTAL_CREDS[role]

        if username == creds['username'] and password == creds['password']:
            session['role']    = role
            session['user']    = username
            session.permanent  = True

            if role == 'bou':
                return redirect(url_for('bou_dashboard'))
            elif role in ('mtn', 'airtel'):
                provider = 'MTN' if role == 'mtn' else 'AIRTEL'
                return redirect(url_for('provider_dashboard', provider=provider))
        else:
            error = 'Invalid username or password. Please try again.'

    return render_template('login.html', role=role, error=error)

# ── Logout ─────────────────────────────────────────────────────────────────────
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# ── End-User Portal ────────────────────────────────────────────────────────────
@app.route('/user')
def user_portal():
    return render_template('user.html')

# ── Provider (MTN / Airtel) Dashboard ─────────────────────────────────────────
@app.route('/provider/<provider>')
def provider_dashboard(provider):
    if session.get('role') not in ('mtn', 'airtel'):
        role = 'mtn' if provider.upper() == 'MTN' else 'airtel'
        return redirect(url_for('login', role=role))
    return render_template('provider.html', provider_name=provider.upper())

# ── Bank of Uganda Dashboard ───────────────────────────────────────────────────
@app.route('/bou')
def bou_dashboard():
    if session.get('role') != 'bou':
        return redirect(url_for('login', role='bou'))
    return render_template('bou.html')

# ═══════════════════════════════════════════════════════════════════════════════
# JSON API ROUTES  (consumed by dashboard JS via fetch())
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/stats')
def api_stats():
    return jsonify(get_stats())

@app.route('/api/complaints', methods=['GET'])
def api_complaints():
    return jsonify(get_all_complaints())

@app.route('/api/complaints', methods=['POST'])
def api_create_complaint():
    data        = request.values
    phone       = data.get('phone_number', '')
    provider    = data.get('provider', '')
    fraud_type  = data.get('fraud_type', '')
    amount      = data.get('amount', 0)
    language    = data.get('language', 'English')
    notes_text  = data.get('notes', '')

    # Generate unique ticket ID
    suffix = ''.join(random.choices(string.digits, k=4))
    ticket_id = f"FG-{suffix}"

    create_complaint(ticket_id, phone, provider, fraud_type, amount, language)

    # Append extra notes if provided
    if notes_text:
        update_status(ticket_id, 'PENDING', notes_text)

    return jsonify(get_complaint(ticket_id))

@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def api_get_complaint(complaint_id):
    c = get_complaint(complaint_id)
    if not c:
        return jsonify({'error': 'Complaint not found'}), 404
    return jsonify(c)

@app.route('/api/complaints/<complaint_id>/status', methods=['POST'])
def api_update_status(complaint_id):
    data   = request.values
    status = data.get('status', 'PENDING')
    notes  = data.get('notes', '')
    update_status(complaint_id, status, notes)
    return jsonify({'ok': True, 'id': complaint_id, 'status': status})

@app.route('/api/complaints/<complaint_id>/escalate', methods=['POST'])
def api_escalate(complaint_id):
    escalate_complaint(complaint_id)
    update_status(complaint_id, 'ESCALATED', 'Case escalated to BoU enforcement desk.')
    return jsonify({'ok': True, 'id': complaint_id})

@app.route('/api/check-number/<phone>', methods=['GET'])
def api_check_number(phone):
    count = check_phone_number(phone)
    # Determine risk category
    if count == 0:
        status = "CLEAN"
        message = "No fraud incidents reported for this number."
    elif count == 1:
        status = "FLAGGED"
        message = f"Caution: Flagged in {count} fraud report."
    else:
        status = "HIGH_RISK"
        message = f"Warning: High risk! Flagged in {count} fraud reports."
        
    return jsonify({
        'phone': phone,
        'count': count,
        'status': status,
        'message': message
    })

@app.route('/api/provider/<provider>/complaints')
def api_provider_complaints(provider):
    return jsonify(get_provider_complaints(provider))

# ═══════════════════════════════════════════════════════════════════════════════
# USSD ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/ussd", methods=['POST'])
def ussd():
    session_id   = request.values.get("sessionId", None)
    service_code = request.values.get("serviceCode", None)
    phone_number = request.values.get("phoneNumber", "")
    text         = request.values.get("text", "")

    if phone_number not in user_session_store:
        user_session_store[phone_number] = {'lang': 'en'}

    current_lang = user_session_store[phone_number]['lang']
    t            = translation_matrix[current_lang]
    input_chain  = text.split('*')
    response     = ""

    # SCREEN 0: MAIN MENU
    if text == '':
        response = (f"CON {t['welcome']}\n"
                    f"{t['opt1']}\n"
                    f"{t['opt2']}\n"
                    f"{t['opt3']}")

    # BRANCH 1: REPORT FRAUD – channel choice (USSD or Voice Call)
    elif text == '1':
        response = f"CON {t['channel_choice']}"

    # BRANCH 1*1: fraud type selection (USSD reporting path)
    elif text == '1*1':
        provider_name, _ = detect_provider(phone_number)
        response = f"CON {t['select_fraud_type'].format(provider=provider_name)}"

    # BRANCH 1*2: switch to voice call
    elif text == '1*2':
        provider_name, _ = detect_provider(phone_number)
        trigger_outbound_ivr(phone_number, provider_name, current_lang)
        response = f"END {t['ivr_switch']}"

    # BRANCH 1*1*[fraud]: file complaint via USSD
    elif input_chain[0] == '1' and len(input_chain) == 3 and input_chain[1] == '1':
        fraud_choice = input_chain[2]
        provider_name, provider_short = detect_provider(phone_number)

        if fraud_choice in ('1', '2', '3'):
            fraud_types = {
                'en':  {'1': "Unauthorised transaction",
                        '2': "Scammers pretending to be staff",
                        '3': "Scammers pretending to have sent money"},
                'lg':  {'1': "Ssente ezitakkiriziddwa",
                        '2': "Abafere abeeyita abakozi",
                        '3': "Abafere abeeyita abakusindikidde ssente"},
                'rny': {'1': "Okwiha esente omu buryo butahikire",
                        '2': "Abashuma abeetwarra nka bakozi",
                        '3': "Abashuma abeetwarra ngu bakusindikira esente"},
            }
            lang_map = {'en': 'English', 'lg': 'Luganda', 'rny': 'Runyakitara'}
            fraud_label = fraud_types[current_lang][fraud_choice]

            # Save complaint to DB
            suffix    = ''.join(random.choices(string.digits, k=4))
            ticket_id = f"FG-{suffix}"
            create_complaint(ticket_id, phone_number, provider_short,
                             fraud_label, 0, lang_map[current_lang])

            response = f"END {t['ivr_redirect'].format(provider=provider_name, fraud_type=fraud_label)}\nTicket: {ticket_id}."
            trigger_outbound_ivr(phone_number, provider_name, current_lang)
        else:
            response = f"END {t['invalid']}"

    # BRANCH 2: TRACK STATUS
    elif text == '2':
        # Lookup database for active complaints associated with this phone number
        all_cases = get_all_complaints()
        user_cases = [c for c in all_cases if c['phone_number'] == phone_number]
        
        if len(user_cases) > 0:
            # Show status of the most recent complaint
            latest = user_cases[0]
            status_clean = latest['status'].replace('_', ' ')
            response = f"END {t['active_case'].format(id=latest['id'], status=status_clean, notes=latest['notes'][:40])}"
        else:
            response = f"END {t['no_case'].format(phone=phone_number)}"
            
        trigger_status_callback_call(phone_number, current_lang)

    # BRANCH 3: LANGUAGE MENU
    elif text == '3':
        response = (f"CON {t['lang_select']}\n"
                    "1. English\n"
                    "2. Luganda\n"
                    "3. Runyakitara")

    # BRANCH 3*[1|2|3]: set language
    elif input_chain[0] == '3' and len(input_chain) == 2:
        choice = input_chain[1]
        lang   = {'1': 'en', '2': 'lg', '3': 'rny'}.get(choice, 'en')
        user_session_store[phone_number]['lang'] = lang
        new_t    = translation_matrix[lang]
        response = f"END {new_t['welcome']}."

    else:
        response = f"END {t['invalid']}"

    resp = make_response(response)
    resp.headers['Content-Type'] = 'text/plain'
    return resp

# ═══════════════════════════════════════════════════════════════════════════════
# IVR VOICE WEBHOOKS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/voice-outbound', methods=['POST'])
def voice_outbound():
    destination_number = request.values.get("destinationNumber", "")
    user_profile = user_session_store.get(destination_number, {'lang': 'en'})
    user_lang    = user_profile['lang']

    audio_urls = {
        'en':  'https://your-server-storage.com/audio/welcome_en.mp3',
        'lg':  'https://your-server-storage.com/audio/welcome_lg.mp3',
        'rny': 'https://your-server-storage.com/audio/welcome_rny.mp3',
    }
    target_audio = audio_urls.get(user_lang, audio_urls['en'])

    xml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play url="{target_audio}"/>
    <Record finishOnKey="#" maxLength="120" trimSilence="true" playBeep="true"
        callbackUrl="https://your-ngrok-link.ngrok-free.app/voice-capture-callback"/>
</Response>"""

    resp = make_response(xml_response)
    resp.headers['Content-Type'] = 'application/xml'
    return resp, 200

@app.route('/voice-capture-callback', methods=['POST'])
def voice_capture_callback():
    recording_url = request.values.get("recordingUrl", "")
    caller_number = request.values.get("callerNumber", "")
    duration      = request.values.get("duration", "0")
    print(f"[VOICE] Recording from {caller_number} ({duration}s): {recording_url}")

    xml_closing = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="woman">Your complaint has been successfully recorded and shared securely with the Bank of Uganda.</Say>
</Response>"""

    resp = make_response(xml_closing)
    resp.headers['Content-Type'] = 'application/xml'
    return resp, 200

# ═══════════════════════════════════════════════════════════════════════════════
# MOCK MICROSERVICE HOOKS
# ═══════════════════════════════════════════════════════════════════════════════

def trigger_outbound_ivr(phone, provider, lang):
    print(f"[IVR] Dialling {phone} for {provider} complaint (lang={lang})")

def trigger_status_callback_call(phone, lang):
    print(f"[IVR] Status callback queued for {phone} (lang={lang})")

if __name__ == '__main__':
    app.run(debug=True)
