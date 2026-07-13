import os
import random
import string
import requests as http_requests
from flask import (Flask, request, render_template, make_response,
                   redirect, url_for, session, jsonify)

# ─── App setup ───────────────────────────────────────────────────────────────
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))


def create_app():
    app = Flask(__name__, template_folder=template_dir)
    app.secret_key = os.environ.get('SECRET_KEY', 'fraudguard-bou-2026-dev-secret')
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    return app


app = create_app()
application = app
AFRICASTALKING_SIMULATOR_URL = os.environ.get(
    'AFRICASTALKING_SIMULATOR_URL',
    'https://account.africastalking.com/apps/sandbox/ussd/simulator'
)

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
    'mtn':    {'username': 'telecomx_compliance', 'password': 'telecomx'},
    'airtel': {'username': 'telecomy_compliance', 'password': 'telecomy'},
    'bou':    {'username': 'bou_supervisor',    'password': 'bou123'},
}

ROLE_DISPLAY_NAMES = {
    'mtn': 'Telecom X',
    'airtel': 'Telecom Y',
    'bou': 'Bank of Uganda',
}

PROVIDER_ROUTE_MAP = {
    'mtn': {'slug': 'telecomx', 'code': 'MTN', 'display_name': 'Telecom X'},
    'airtel': {'slug': 'telecomy', 'code': 'AIRTEL', 'display_name': 'Telecom Y'},
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
        'write_description':"Please write a brief description of the incident:",
        'ivr_redirect':     "Thank you. Your fraud incident under {provider} has been filed. The Bank of Uganda platform is calling you back right now to record your voice complaint. Please answer.",
        'ivr_switch':       "Connecting you to a fraud reporting voice call. Please answer your phone.",
        'status_redirect':  "Fetching status. You will receive an automated voice update call shortly.",
        'active_case':      "Active Case ({id}) Status: {status}.\nInfo: A detailed report will be sent to you shortly.",
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
        'write_description':"Wandiika obusongofu ku nsonga eno mu bwangu:",
        'ivr_redirect':     "Weebale. Omusango gwo ogw'obufere ku {provider} guwandiikiddwa. Banka enkulu eya Uganda (BoU) ekukubira essimu kaakano osodole okukwata eddoboozi lyo ery'okwemulugunya.",
        'ivr_switch':       "Tukukubirira essimu gy'okwemulugunya. Teeka essimu.",
        'status_redirect':  "Tukyakunonyeza omusango. Ojja kufuna essimu ekuwa ebirowoozo kaakano.",
        'active_case':      "Active Case ({id}) Status: {status}.\nInfo: Omusango gwo gutekebwako ripoota eijjuvu mu bwangu.",
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
        'write_description':"Handiika ebirikukwata aha nsonga egi mu bugufu:",
        'ivr_redirect':     "Webare. Omusango gwawe gw'okwiba ahari {provider} gwahandiikwa. Banka enkulu eya Uganda ekuteerera esimu hati ngu okwate eiraka ryawe ry'okwemurugunya.",
        'ivr_switch':       "Tukuteererera esimu y'okwemurugunya. Gwata esimu yawe.",
        'status_redirect':  "Tukyaserura omusango gwawe. Noza kutunga esimu ekumanyisa hati.",
        'active_case':      "Active Case ({id}) Status: {status}.\nInfo: Ripoota ejwire neza kukoherwa hati.",
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
        return ('Telecom X', 'MTN')
    elif prefix in AIRTEL_PREFIXES:
        return ('Telecom Y', 'AIRTEL')
    else:
        return ('Telecom X', 'MTN')  # default fallback

# ═══════════════════════════════════════════════════════════════════════════════
# PORTAL ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def home():
    return render_template('landing.html', simulator_url=AFRICASTALKING_SIMULATOR_URL)


@app.route('/simulator')
def simulator():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'fraudguard'})

# ── Login ──────────────────────────────────────────────────────────────────────
def render_login_page(role, login_action):
    role_display_name = ROLE_DISPLAY_NAMES.get(role, role.upper())

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
                provider_route = PROVIDER_ROUTE_MAP[role]['slug']
                return redirect(url_for('provider_dashboard', provider=provider_route))
        else:
            error = 'Invalid username or password. Please try again.'

    return render_template('login.html', role=role, role_display_name=role_display_name, login_action=login_action, error=error)


@app.route('/login/<role>', methods=['GET', 'POST'])
def login(role):
    if role not in PORTAL_CREDS:
        return redirect(url_for('home'))
    return render_login_page(role, request.path)


@app.route('/telecomx', methods=['GET', 'POST'])
def telecomx_login():
    return render_login_page('mtn', request.path)


@app.route('/telecomy', methods=['GET', 'POST'])
def telecomy_login():
    return render_login_page('airtel', request.path)

# ── Logout ─────────────────────────────────────────────────────────────────────
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# ── End-User Portal ────────────────────────────────────────────────────────────
@app.route('/user')
def user_portal():
    return render_template('user.html')

# ── Provider (Telecom X / Telecom Y) Dashboard ───────────────────────────────
@app.route('/provider/<provider>')
def provider_dashboard(provider):
    provider_key = None
    if provider.lower() in ('telecomx', 'mtn'):
        provider_key = 'mtn'
    elif provider.lower() in ('telecomy', 'airtel'):
        provider_key = 'airtel'

    if provider_key is None:
        return redirect(url_for('home'))

    if session.get('role') not in ('mtn', 'airtel'):
        return redirect(url_for('login', role=provider_key))

    provider_meta = PROVIDER_ROUTE_MAP[provider_key]
    return render_template(
        'provider.html',
        provider_name=provider_meta['code'],
        provider_display_name=provider_meta['display_name'],
        provider_key=provider_key,
        provider_slug=provider_meta['slug'],
        provider_api_key=provider_meta['code'],
    )


@app.route('/telecomx')
def telecomx_provider_route():
    return redirect(url_for('provider_dashboard', provider='telecomx'))


@app.route('/telecomy')
def telecomy_provider_route():
    return redirect(url_for('provider_dashboard', provider='telecomy'))

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

    # BRANCH 1*1: ask for description (USSD reporting path)
    elif text == '1*1':
        response = f"CON {t['write_description']}"

    # BRANCH 1*2: switch to voice call
    elif text == '1*2':
        provider_name, _ = detect_provider(phone_number)
        trigger_outbound_ivr(phone_number, provider_name, current_lang)
        response = f"END {t['ivr_switch']}"

    # BRANCH 1*1*[description]: file complaint via USSD with user description
    elif input_chain[0] == '1' and len(input_chain) >= 3 and input_chain[1] == '1':
        description = '*'.join(input_chain[2:])
        provider_name, provider_short = detect_provider(phone_number)
        lang_map = {'en': 'English', 'lg': 'Luganda', 'rny': 'Runyakitara'}

        # Save complaint to DB
        suffix    = ''.join(random.choices(string.digits, k=4))
        ticket_id = f"FG-{suffix}"
        create_complaint(ticket_id, phone_number, provider_short,
                         "USSD Reported", 0, lang_map[current_lang], notes=description)

        response = f"END {t['ivr_redirect'].format(provider=provider_name)}\nTicket: {ticket_id}."
        trigger_outbound_ivr(phone_number, provider_name, current_lang)

    # BRANCH 2: TRACK STATUS
    elif text == '2':
        # Lookup database for active complaints associated with this phone number
        all_cases = get_all_complaints()
        user_cases = [c for c in all_cases if c['phone_number'] == phone_number]
        
        if len(user_cases) > 0:
            # Show status of the most recent complaint
            latest = user_cases[0]
            status_map = {
                'PENDING':             'Pending',
                'UNDER_INVESTIGATION': 'Under Investigation',
                'RESOLVED':            'Resolved',
                'CANCELED':            'Canceled',
                'CANCELLED':           'Canceled',
                'ESCALATED':           'Escalated to BoU',
            }
            status_clean = status_map.get(latest['status'].upper(), latest['status'])
            response = f"END {t['active_case'].format(id=latest['id'], status=status_clean)}"
            
            # Send simulated detailed SMS report
            sms_text = f"FraudGuard Detailed Report: Your case {latest['id']} status is {status_clean}. Notes: {latest['notes']}. SLA: {latest['sla_deadline']}."
            send_sms(phone_number, sms_text)
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

# ─── Africa's Talking helpers ────────────────────────────────────────────────
AT_USERNAME = os.environ.get('AT_USERNAME', '')
AT_API_KEY  = os.environ.get('AT_API_KEY', '')
AT_SMS_URL  = 'https://api.africastalking.com/version1/messaging'
AT_CALL_URL = 'https://voice.africastalking.com/call'


def send_sms(phone, message):
    """Send SMS via Africa's Talking. Falls back to print if creds not set."""
    if not AT_USERNAME or not AT_API_KEY:
        print(f"[SMS-MOCK] To {phone}: {message}")
        return
    try:
        resp = http_requests.post(
            AT_SMS_URL,
            headers={
                'apiKey': AT_API_KEY,
                'Accept': 'application/json',
            },
            data={
                'username': AT_USERNAME,
                'to':       phone,
                'message':  message,
            },
            timeout=10
        )
        result = resp.json()
        print(f"[SMS] Sent to {phone}: {result}")
    except Exception as e:
        print(f"[SMS-ERROR] Failed to send to {phone}: {e}")


def trigger_outbound_ivr(phone, provider, lang):
    """Place an outbound call via Africa's Talking Voice API."""
    if not AT_USERNAME or not AT_API_KEY:
        print(f"[CALL-MOCK] Dialling {phone} for {provider} (lang={lang})")
        return
    try:
        callback_url = os.environ.get(
            'AT_VOICE_CALLBACK_URL',
            'https://your-app.vercel.app/voice-outbound'
        )
        resp = http_requests.post(
            AT_CALL_URL,
            headers={'apiKey': AT_API_KEY},
            data={
                'username': AT_USERNAME,
                'to':       phone,
                'from':     os.environ.get('AT_CALLER_ID', ''),
                'callbackUrl': callback_url,
            },
            timeout=10
        )
        print(f"[CALL] Initiated call to {phone}: {resp.text}")
    except Exception as e:
        print(f"[CALL-ERROR] Failed to call {phone}: {e}")


def trigger_status_callback_call(phone, lang):
    """Place a status-update callback call."""
    trigger_outbound_ivr(phone, 'Status Update', lang)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
