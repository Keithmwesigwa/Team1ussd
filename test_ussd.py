import os
from flask import Flask, request, render_template, make_response

# Define explicit template directory relative to this script for Vercel Serverless Functions
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
app = Flask(__name__, template_folder=template_dir)

@app.route('/')
def home():
    return render_template('index.html')

@app.route("/ussd", methods=['POST'])
def ussd():
    # 1. Read the variables sent via POST from our API
    session_id   = request.values.get("sessionId", None)
    serviceCode  = request.values.get("serviceCode", None)
    phone_number = request.values.get("phoneNumber", None)
    text         = request.values.get("text", "")

    response = ""

    # 2. Clean up the incoming input path string
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
        response = (f"END Thank you. The Bank of Uganda platform is calling your number ({phone_number}) "
                    "immediately to record your voice complaint. Please hang up and answer the incoming call.")
        
        # Trigger background microservices asynchronously
        trigger_ivr_voice_callback(phone_number, provider, session_id)

    # --- BRANCH 2: TRACK COMPLAINT ---
    elif text == '2':
        response = "END Fetching your status. You will receive an automated voice call detailing your active dispute shortly."
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

    # 3. Respond to the MNO gateway with raw plain text
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
