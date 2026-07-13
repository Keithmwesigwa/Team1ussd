import urllib.request
import urllib.parse
import sys

BASE_URL = "http://127.0.0.1:5000/ussd"

def post(text, phone="+256770123456"):
    data = urllib.parse.urlencode({
        "sessionId": "sess_test_001",
        "serviceCode": "*284#",
        "phoneNumber": phone,
        "text": text
    }).encode("utf-8")
    req = urllib.request.Request(BASE_URL, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        return r.read().decode("utf-8")

def check(label, res, expected):
    if expected in res:
        print(f"  [PASS] {label}")
    else:
        print(f"  [FAIL] {label}")
        print(f"     Got: {repr(res)}")
        sys.exit(1)

print("=" * 60)
print("  BoU USSD FULL FLOW VALIDATION SUITE")
print("=" * 60)

# ─── TEST PHONE NUMBERS ───────────────────────────────────────
# +256770... → prefix 77 → Telecom X (MTN)
# +256700... → prefix 70 → Telecom Y (Airtel)
# +256780... → prefix 78 → Telecom X (MTN)
PHONE_MTN    = "+256770123456"
PHONE_AIRTEL = "+256700123456"
PHONE_RNY    = "+256780999888"

# Reset session states
post("3*1", PHONE_MTN)
post("3*1", PHONE_AIRTEL)
post("3*1", PHONE_RNY)

# -- ENGLISH (default, MTN phone) --
print("\n[EN] Default language tests — MTN number")
check("Main menu",           post(""),         "CON Welcome to BoU Consumer Protection")
check("Fraud branch",        post("1"),         "CON How would you like to report?")
check("Channel: USSD",       post("1*1"),       "CON Please write a brief description of the incident:")
check("Channel: Call",       post("1*2"),       "END Connecting you to a fraud reporting voice call")
check("Submit fraud description", post("1*1*something"), "END Thank you. Your fraud incident under Telecom X has been filed.")
check("Track complaint",     post("2"),         "Active Case")
check("Language menu",       post("3"),         "CON Londa Ennimi")
check("Set English (3*1)",   post("3*1"),       "Welcome to BoU Consumer Protection.")
check("Fallback invalid",    post("999"),       "END Invalid selection")

# -- ENGLISH — Airtel phone auto-detection --
print("\n[EN] Airtel phone auto-detection test")
check("Airtel fraud submit", post("1*1*something", PHONE_AIRTEL), "END Thank you. Your fraud incident under Telecom Y has been filed.")

# -- LUGANDA --
print("\n[LG] Switch to Luganda (3*2) then test on same number")
check("Set Luganda (3*2)",      post("3*2"),       "Tusanyuse okulaba.")
check("LG main menu",           post(""),           "CON Tusanyuse okulaba")
check("LG fraud branch",        post("1"),           "CON Oyagala kukola mutya?")
check("LG channel USSD",        post("1*1"),         "CON Wandiika obusongofu ku nsonga eno mu bwangu:")
check("LG channel Call",        post("1*2"),         "END Tukukubirira essimu")
check("LG submit description",  post("1*1*something"), "END Weebale. Omusango gwo ogw'obufere ku Telecom X guwandiikiddwa.")
check("LG track complaint",     post("2"),           "Active Case")
check("LG invalid",             post("99"),          "END Okoze ensobi")

# -- RUNYAKITARA --
print("\n[RNY] Switch to Runyakitara (3*3) on a fresh MTN phone number")
check("Set RNY (3*3)",        post("3*3", PHONE_RNY),     "Nyamwanga")
check("RNY main menu",        post("", PHONE_RNY),         "CON Nyamwanga")
check("RNY fraud branch",     post("1", PHONE_RNY),        "CON Oyagala kuhandiika mutya?")
check("RNY channel USSD",     post("1*1", PHONE_RNY),     "CON Handiika ebirikukwata aha nsonga egi mu bugufu:")
check("RNY channel Call",     post("1*2", PHONE_RNY),     "END Tukuteererera esimu")
check("RNY submit desc",      post("1*1*something", PHONE_RNY), "END Webare. Omusango gwawe gw'okwiba ahari Telecom X gwahandiikwa.")
check("RNY track",            post("2", PHONE_RNY),        "Active Case")
check("RNY invalid",          post("0", PHONE_RNY),        "END Okora enshobi")

print("\n" + "=" * 60)
print("  ALL TESTS PASSED [OK]")
print("=" * 60)
