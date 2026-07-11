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

# -- ENGLISH (default) --
print("\n[EN] Default language tests")
check("Main menu",         post(""),    "CON Welcome to BoU Consumer Protection")
check("Fraud branch",      post("1"),   "CON Select Affected Provider")
check("MTN select provider",    post("1*1"), "CON Choose fraud type")
check("Airtel select provider", post("1*2"), "CON Choose fraud type")
check("MTN submission type 1",  post("1*1*1"), "END Thank you. Your fraud incident under MTN Uganda for Unauthorised transaction has been filed.")
check("Airtel submission type 2", post("1*2*2"), "END Thank you. Your fraud incident under Airtel Uganda for Scammers pretending to be staff has been filed.")
check("Track complaint",   post("2"),   "END Fetching status")
check("Language menu",     post("3"),   "CON Londa Ennimi")
check("Set English (3*1)", post("3*1"), "Welcome to BoU Consumer Protection.")
check("Fallback invalid",  post("999"), "END Invalid selection")

# -- LUGANDA --
print("\n[LG] Switch to Luganda (3*2) then test on same number")
check("Set Luganda (3*2)",  post("3*2"), "Tusanyuse okulaba.")
check("LG main menu",       post(""),    "CON Tusanyuse okulaba")
check("LG fraud branch",    post("1"),   "CON Londa kampuni")
check("LG MTN select provider",  post("1*1"), "CON Londa ekika ky'obufere")
check("LG MTN submission type 1", post("1*1*1"), "END Weebale. Omusango gwo ogw'obufere ku MTN Uganda ku Ssente ezitakkiriziddwa guwandiikiddwa.")
check("LG track complaint", post("2"),   "END Tukyakunonyeza")
check("LG invalid",         post("99"),  "END Okoze ensobi")

# -- RUNYAKITARA --
print("\n[RNY] Switch to Runyakitara (3*3) on a fresh phone number")
PHONE2 = "+256780999888"
check("Set RNY (3*3)",    post("3*3", PHONE2), "Nyamwanga")
check("RNY main menu",    post("", PHONE2),    "CON Nyamwanga")
check("RNY MTN select provider",  post("1*1", PHONE2), "CON Toorana ekika ky'okwiba")
check("RNY MTN submission type 1", post("1*1*1", PHONE2), "END Webare. Omusango gwawe gw'okwiba ahari MTN Uganda ku Okwiha esente omu buryo butahikire gwahandiikwa.")
check("RNY track",        post("2", PHONE2),   "END Tukyaserura")
check("RNY invalid",      post("0", PHONE2),   "END Okora enshobi")

print("\n" + "=" * 60)
print("  ALL TESTS PASSED [OK]")
print("=" * 60)
