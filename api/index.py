import os
from flask import Flask, request, render_template, make_response

# Define explicit template directory relative to this script for Vercel Serverless Functions
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
app = Flask(__name__, template_folder=template_dir)

# ==========================================
# 🗂️ IN-MEMORY SESSION STORE
# Tracks per-phone user preferences (e.g. language) for the MVP lifecycle.
# Replace with a persistent DB (Redis / SQLite) for production.
# ==========================================
user_session_store = {}

# ==========================================
# 🗺️ LOCALIZATION DICTIONARY MATRIX (Ugandan Dialects)
# ==========================================
translation_matrix = {
    'en': {
        'welcome':        "Welcome to BoU Consumer Protection",
        'opt1':           "1. Report Mobile Money Fraud",
        'opt2':           "2. Track Active Complaint",
        'opt3':           "3. Change Language / Ennimi",
        'select_provider':"Select Affected Provider:",
        'ivr_redirect':   "Thank you. The Bank of Uganda platform is calling you back right now to record your voice complaint. Please answer.",
        'status_redirect':"Fetching status. You will receive an automated voice update call shortly.",
        'lang_select':    "Londa Ennimi / Choose Language:",
        'invalid':        "Invalid selection. Please try again.",
    },
    'lg': {
        'welcome':        "Tusanyuse okulaba",
        'opt1':           "1. Loopa obufere",
        'opt2':           "2. Manya okugenda mu maaso kw'omusango",
        'opt3':           "3. Kyusa olulimi / Change Language",
        'select_provider':"Londa kampuni y'essimu ekozesseddwa:",
        'ivr_redirect':   "Weebale. Banka enkulu eya Uganda (BoU) ekukubira essimu kaakano osodole okukwata eddoboozi lyo ery'okwemulugunya.",
        'status_redirect':"Tukyakunonyeza omusango. Ojja kufuna essimu ekuwa ebirowoozo kaakano.",
        'lang_select':    "Londa Ennimi / Choose Language:",
        'invalid':        "Okoze ensobi. Kyeyongere okugezaako.",
    },
    'rny': {
        'welcome':        "Nyamwanga ha weebura ya BoU y'okurinda abaguzi",
        'opt1':           "1. Handiika okwiba kw'esente z'omumasingo",
        'opt2':           "2. Mazima omusango gwawe oku guri",
        'opt3':           "3. Hindura Orurimi / Change Language",
        'select_provider':"Toorana kampuni y'esimu eyafiiswaho:",
        'ivr_redirect':   "Webare. Banka enkulu eya Uganda ekuteerera esimu hati ngu okwate eiraka ryawe ry'okwemurugunya.",
        'status_redirect':"Tukyaserura omusango gwawe. Noza kutunga esimu ekumanyisa hati.",
        'lang_select':    "Toorana Orurimi / Choose Language:",
        'invalid':        "Okora enshobi. Yegarukemu.",
    },
}

# ==========================================
# 🏠 HOME: Simulator UI
# ==========================================
@app.route('/')
def home():
    return render_template('index.html')

# ==========================================
# ⚡ 1. USSD ENDPOINT (Route: /ussd)
# ==========================================
@app.route("/ussd", methods=['POST'])
def ussd():
    # Read the standard Africa's Talking POST payload
    session_id   = request.values.get("sessionId", None)
    service_code = request.values.get("serviceCode", None)
    phone_number = request.values.get("phoneNumber", "")
    text         = request.values.get("text", "")

    # Initialize session tracking if phone number is not yet cached
    if phone_number not in user_session_store:
        user_session_store[phone_number] = {'lang': 'en'}  # Default: English

    current_lang = user_session_store[phone_number]['lang']
    t            = translation_matrix[current_lang]
    input_chain  = text.split('*')
    response     = ""

    # ---- SCREEN 0: MAIN MENU ----
    if text == '':
        response = (f"CON {t['welcome']}\n"
                    f"{t['opt1']}\n"
                    f"{t['opt2']}\n"
                    f"{t['opt3']}")

    # ---- BRANCH 1: REPORT FRAUD ----
    elif text == '1':
        response = (f"CON {t['select_provider']}\n"
                    "1. MTN Uganda\n"
                    "2. Airtel Uganda")

    elif text == '1*1' or text == '1*2':
        provider = 'MTN' if text == '1*1' else 'Airtel'
        response = f"END {t['ivr_redirect']}"
        # Asynchronously trigger outbound IVR call via microservice hook
        trigger_outbound_ivr(phone_number, provider, current_lang)

    # ---- BRANCH 2: TRACK STATUS ----
    elif text == '2':
        response = f"END {t['status_redirect']}"
        trigger_status_callback_call(phone_number, current_lang)

    # ---- BRANCH 3: LANGUAGE SUB-MENU ----
    elif text == '3':
        response = (f"CON {t['lang_select']}\n"
                    "1. English\n"
                    "2. Luganda\n"
                    "3. Runyakitara")

    # ---- PROCESS LANGUAGE UPDATE (e.g. 3*1, 3*2, 3*3) ----
    elif input_chain[0] == '3' and len(input_chain) == 2:
        choice = input_chain[1]
        if choice == '1':
            user_session_store[phone_number]['lang'] = 'en'
        elif choice == '2':
            user_session_store[phone_number]['lang'] = 'lg'
        elif choice == '3':
            user_session_store[phone_number]['lang'] = 'rny'

        new_lang = user_session_store[phone_number]['lang']
        new_t    = translation_matrix[new_lang]
        response = f"END {new_t['welcome']}."

    # ---- FALLBACK ----
    else:
        response = f"END {t['invalid']}"

    # Respond to MNO gateway with raw plain text (required by Africa's Talking)
    resp = make_response(response)
    resp.headers['Content-Type'] = 'text/plain'
    return resp

# ==========================================
# 📞 2. IVR VOICE OUTBOUND WEBHOOK (Route: /voice-outbound)
# Called by Africa's Talking when the outbound call connects to the user.
# Returns XML instructing AT to play a welcome audio then record the complaint.
# ==========================================
@app.route('/voice-outbound', methods=['POST'])
def voice_outbound():
    destination_number = request.values.get("destinationNumber", "")

    # Fetch user language profile from our session store
    user_profile = user_session_store.get(destination_number, {'lang': 'en'})
    user_lang    = user_profile['lang']

    # Map dynamic audio file pointers based on user's dialect
    welcome_audio_urls = {
        'en':  'https://your-server-storage.com/audio/welcome_en.mp3',
        'lg':  'https://your-server-storage.com/audio/welcome_lg.mp3',
        'rny': 'https://your-server-storage.com/audio/welcome_rny.mp3',
    }
    target_audio = welcome_audio_urls.get(user_lang, welcome_audio_urls['en'])

    # Build Africa's Talking Telephony XML response
    xml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play url="{target_audio}"/>
    <Record
        finishOnKey="#"
        maxLength="120"
        trimSilence="true"
        playBeep="true"
        callbackUrl="https://your-ngrok-link.ngrok-free.app/voice-capture-callback"
    />
</Response>"""

    resp = make_response(xml_response)
    resp.headers['Content-Type'] = 'application/xml'
    return resp, 200

# ==========================================
# 📥 3. IVR RECORDING INGESTION WEBHOOK (Route: /voice-capture-callback)
# Called by Africa's Talking after the user's voice complaint is recorded.
# Ingests the recording URL and confirms receipt to the caller.
# ==========================================
@app.route('/voice-capture-callback', methods=['POST'])
def voice_capture_callback():
    recording_url  = request.values.get("recordingUrl", "")
    caller_number  = request.values.get("callerNumber", "")
    duration       = request.values.get("duration", "0")

    print(f"\n--- 🚨 NEW VOICE INGESTION INBOUND ---")
    print(f"Source Phone  : {caller_number}")
    print(f"Audio File URL: {recording_url}")
    print(f"Call Duration : {duration} seconds")
    print(f"Action        : Forwarding audio stream to Edge Speech-to-Text Pipeline...")
    print(f"Action        : Syncing PWA Dashboard WebSockets (Status: Under Review)")

    # Complete the call routing flow loop cleanly
    xml_closing = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="woman">Your complaint has been successfully recorded and shared securely with the Bank of Uganda.</Say>
</Response>"""

    resp = make_response(xml_closing)
    resp.headers['Content-Type'] = 'application/xml'
    return resp, 200

# ==========================================
# 🔧 MOCK MICROSERVICE SIMULATION HOOKS
# ==========================================
def trigger_outbound_ivr(phone, provider, lang):
    print(f"[HTTP POST] Triggering Africa's Talking Outbound Voice API dialer targeting {phone} ({provider}) in dialect: {lang}")

def trigger_status_callback_call(phone, lang):
    print(f"[HTTP POST] Enqueueing automated diagnostic status callback task targeting {phone} in dialect: {lang}")

if __name__ == '__main__':
    app.run(debug=True)
