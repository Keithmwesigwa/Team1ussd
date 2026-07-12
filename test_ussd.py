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
print("  BoU USSD MULTI-STEP FLOW VALIDATION SUITE")
print("=" * 60)

print("\n[EN] Main menu")
check("Main menu", post(""), "CON Welcome to BoU Consumer Protection")

print("\n[EN] Step 1: category selection")
check("Start report flow", post("1"), "CON Step 1: Category Selection")
check("Select unauthorized transaction", post("1"), "CON Step 2: Approximate Date & Time")
check("Select today", post("1"), "CON Step 3: Affected Amount (Optional)")
check("Enter amount", post("150000"), "CON Step 4: Summary & Confirmation")
check("Submit report", post("1"), "END Report filed successfully")

print("\n" + "=" * 60)
print("  ALL TESTS PASSED [OK]")
print("=" * 60)
