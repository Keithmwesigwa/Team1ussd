import urllib.request
import urllib.parse
import sys

def test_request(text, phone="+256770123456"):
    url = "http://127.0.0.1:5000/ussd"
    data = urllib.parse.urlencode({
        "sessionId": "test_session_123",
        "serviceCode": "*254#",
        "phoneNumber": phone,
        "text": text
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            return response.read().decode("utf-8")
    except Exception as e:
        return f"ERROR: {e}"

def run_tests():
    print("==================================================")
    print("RUNNING USSD FLASK ENDPOINT VALIDATION TESTS")
    print("==================================================")

    # Test 1: Initial Dial
    res = test_request("")
    print("\n[TEST 1] Initial Dial (text='')")
    print(f"Response:\n{res}")
    if "CON What would you want to check" in res:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # Test 2: Select Option 1 (Account details menu)
    res = test_request("1")
    print("\n[TEST 2] Choose 'My Account' (text='1')")
    print(f"Response:\n{res}")
    if "CON Choose account information" in res:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # Test 3: Select Account number option (1*1)
    res = test_request("1*1")
    print("\n[TEST 3] View 'Account number' (text='1*1')")
    print(f"Response:\n{res}")
    if "END Your account number is ACC1001" in res:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # Test 4: Select Option 2 (Phone number terminal)
    phone = "+256770123456"
    res = test_request("2", phone)
    print(f"\n[TEST 4] Choose 'My phone number' (text='2') using phone={phone}")
    print(f"Response:\n{res}")
    if f"END Your phone number is {phone}" in res:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # Test 5: Invalid Choice
    res = test_request("3")
    print("\n[TEST 5] Invalid Choice (text='3')")
    print(f"Response:\n{res}")
    if "END Invalid choice" in res:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
