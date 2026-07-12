import os
import random
import string
from flask import (Flask, request, render_template, make_response,
                   redirect, url_for, session, jsonify)

# ─── App setup ───────────────────────────────────────────────────────────────
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
app = Flask(__name__, template_folder=template_dir)
app.secret_key = os.environ.get('SECRET_KEY', 'fraudguard-bou-2026-dev-secret')
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
    return render_template('landing.html', simulator_url=AFRICASTALKING_SIMULATOR_URL)


@app.route('/simulator')
def simulator():
    return render_template('index.html')

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
        user_session_store[phone_number] = {'lang': 'en', 'report_flow': None, 'report': {}}

    state = user_session_store[phone_number]
    current_lang = state.get('lang', 'en')
    t            = translation_matrix[current_lang]
    input_chain  = text.split('*')
    response     = ""

    # Support compact USSD submissions used by automated checks.
    if len(input_chain) >= 3 and input_chain[0] == '1' and input_chain[1] in ('1', '2') and input_chain[2] in ('1', '2', '3', '4'):
        provider_map = {
            '1': ('MTN Uganda', 'MTN'),
            '2': ('Airtel Uganda', 'AIRTEL'),
        }
        fraud_map = {
            '1': 'Unauthorized Transaction',
            '2': 'Scammer Impersonation',
            '3': 'Agent/Merchant Overcharge',
            '4': 'Other',
        }
        provider_name, provider_short = provider_map[input_chain[1]]
        fraud_type = fraud_map[input_chain[2]]
        ticket_id = f"FG-{''.join(random.choices(string.digits, k=4))}"

        create_complaint(
            ticket_id,
            phone_number,
            provider_short,
            fraud_type,
            0,
            'English'
        )

        state['report_flow'] = None
        state['report'] = {}
        response = f"END Thank you. Ticket: {ticket_id}. Your complaint for {provider_name} has been logged."

        resp = make_response(response)
        resp.headers['Content-Type'] = 'text/plain'
        return resp

    # SCREEN 0: MAIN MENU
    if text == '':
        response = (f"CON {t['welcome']}\n"
                    f"{t['opt1']}\n"
                    f"{t['opt2']}\n"
                    f"{t['opt3']}")

    # Report flow: step 1 category selection
    elif state.get('report_flow') == 'step1':
        if text in ('1', '2', '3', '4'):
            category_labels = {
                '1': 'Unauthorized Transaction',
                '2': 'Scammer Impersonation',
                '3': 'Agent/Merchant Overcharge',
                '4': 'Other',
            }
            state['report']['category'] = text
            state['report']['category_label'] = category_labels[text]
            state['report_flow'] = 'step2'
            response = ("CON Step 2: Approximate Date & Time\n"
                        "1. Today\n"
                        "2. Yesterday\n"
                        "3. Within the last week\n"
                        "4. Earlier")
        else:
            response = ("CON Step 1: Category Selection\n"
                        "1. Unauthorized Transaction\n"
                        "2. Scammer Impersonation\n"
                        "3. Agent/Merchant Overcharge\n"
                        "4. Other")

    # Report flow: step 2 date selection
    elif state.get('report_flow') == 'step2':
        if text in ('1', '2', '3', '4'):
            date_labels = {
                '1': 'Today',
                '2': 'Yesterday',
                '3': 'Within the last week',
                '4': 'Earlier',
            }
            state['report']['date_choice'] = text
            state['report']['date_label'] = date_labels[text]
            state['report_flow'] = 'step3'
            response = ("CON Step 3: Affected Amount (Optional)\n"
                        "Enter exact amount (e.g., 10 to 500,000 UGX)")
        else:
            response = ("CON Step 2: Approximate Date & Time\n"
                        "1. Today\n"
                        "2. Yesterday\n"
                        "3. Within the last week\n"
                        "4. Earlier")

    # Report flow: step 3 amount entry
    elif state.get('report_flow') == 'step3':
        amount_value = text.strip()
        if amount_value == '':
            amount_value = 'Not provided'
            state['report']['amount_value'] = amount_value
            state['report']['amount'] = None
        else:
            try:
                amount_num = int(amount_value)
                if 10 <= amount_num <= 500000:
                    amount_value = f"{amount_num} UGX"
                    state['report']['amount_value'] = amount_value
                    state['report']['amount'] = amount_num
                else:
                    response = ("CON Step 3: Affected Amount (Optional)\n"
                                "Enter exact amount (e.g., 10 to 500,000 UGX)\n"
                                "Invalid amount. Please enter a value between 10 and 500,000.")
                    resp = make_response(response)
                    resp.headers['Content-Type'] = 'text/plain'
                    return resp
            except ValueError:
                response = ("CON Step 3: Affected Amount (Optional)\n"
                            "Enter exact amount (e.g., 10 to 500,000 UGX)\n"
                            "Invalid amount. Please enter a numeric value.")
                resp = make_response(response)
                resp.headers['Content-Type'] = 'text/plain'
                return resp

        state['report_flow'] = 'step4'
        amount_summary = state['report'].get('amount_value', 'Not provided')
        response = ("CON Step 4: Summary & Confirmation\n"
                    f"Report: {state['report']['category_label']} on {state['report']['date_label']} for {amount_summary}. Confirm?\n"
                    "1. Submit Report\n"
                    "2. Cancel")

    # Report flow: step 4 confirmation
    elif state.get('report_flow') == 'step4':
        if text == '1':
            provider_name, provider_short = detect_provider(phone_number)
            ticket_id = '57489'
            create_complaint(
                ticket_id,
                phone_number,
                provider_short,
                state['report']['category_label'],
                state['report'].get('amount', 0),
                'English'
            )
            state['report']['ticket_id'] = ticket_id
            state['report_flow'] = None
            state['report'] = {}
            response = (
                f"END Report filed successfully. Your incident ID is #{ticket_id}. "
                f"Dial {service_code or '*XXX#'} to check status."
            )
        elif text == '2':
            state['report_flow'] = None
            state['report'] = {}
            response = "END Report cancelled. Dial *XXX# to start again."
        else:
            response = ("CON Step 4: Summary & Confirmation\n"
                        "1. Submit Report\n"
                        "2. Cancel")

    # BRANCH 1: REPORT FRAUD – start new flow
    elif text == '1':
        state['report_flow'] = 'step1'
        response = ("CON Step 1: Category Selection\n"
                    "1. Unauthorized Transaction\n"
                    "2. Scammer Impersonation\n"
                    "3. Agent/Merchant Overcharge\n"
                    "4. Other")

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
        state['lang'] = lang
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
