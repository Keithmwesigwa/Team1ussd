import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

def request_api(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    
    encoded_data = None
    if data:
        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            if response.headers.get("Content-Type") == "application/json":
                return json.loads(res_body)
            return res_body
    except Exception as e:
        print(f"HTTP ERROR requesting {url}: {e}")
        return None

def run_tests():
    print("==================================================")
    print("RUNNING SYSTEM INTEGRATION & COMPLIANCE TESTS")
    print("==================================================")

    # 1. Check Initial Stats
    print("\n[TEST 1] Query Initial Database Stats")
    stats = request_api("/api/stats")
    print(f"Stats: {stats}")
    if stats and "total" in stats and stats["total"] >= 3:
        print("-> Result: PASS (Sample cases loaded successfully)")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # 2. File a Web Complaint
    print("\n[TEST 2] File a New Web Complaint")
    report_payload = {
        "phone_number": "+256788888888",
        "provider": "MTN",
        "fraud_type": "Phishing/Online Scam",
        "amount": 250000.0,
        "notes": "Received phishing link claiming to double funds."
    }
    complaint_res = request_api("/api/complaints", method="POST", data=report_payload)
    print(f"Complaint Response: {complaint_res}")
    if complaint_res and "id" in complaint_res:
        ticket_id = complaint_res["id"]
        print(f"-> Result: PASS (Created ticket: {ticket_id})")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # 3. Read Complaint Details
    print("\n[TEST 3] Fetch Created Complaint Details")
    details = request_api(f"/api/complaints/{ticket_id}")
    print(f"Details: {details}")
    if details and details["id"] == ticket_id and details["status"] == "PENDING":
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # 4. Update Case Status by Provider (MTN)
    print("\n[TEST 4] Update Status by Provider Desk")
    update_payload = {
        "status": "UNDER_INVESTIGATION",
        "notes": "Compliance officer assigned. Fraudulent agent cell tower traced."
    }
    update_res = request_api(f"/api/complaints/{ticket_id}/status", method="POST", data=update_payload)
    print(f"Update Response: {update_res}")
    
    # Re-fetch details to assert notes update
    details_new = request_api(f"/api/complaints/{ticket_id}")
    print(f"Updated Details: {details_new}")
    if details_new and details_new["status"] == "UNDER_INVESTIGATION" and "cell tower traced" in details_new["notes"]:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # 5. Escalate Case to Bank of Uganda Oversight
    print("\n[TEST 5] Escalate Case to BoU Oversight")
    esc_res = request_api(f"/api/complaints/{ticket_id}/escalate", method="POST")
    print(f"Escalation Response: {esc_res}")
    
    details_esc = request_api(f"/api/complaints/{ticket_id}")
    print(f"Escalated Details: {details_esc}")
    if details_esc and details_esc["escalated"] == 1:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # 6. USSD Dynamic Report Logging
    print("\n[TEST 6] Trigger USSD Report Generation")
    ussd_report_payload = {
        "sessionId": "session_at_9999",
        "serviceCode": "*254#",
        "phoneNumber": "+256799000000",
        "text": "1*1"  # Report Fraud -> MTN
    }
    ussd_res = request_api("/ussd", method="POST", data=ussd_report_payload)
    print(f"USSD Response:\n{ussd_res}")
    if "END Thank you." in ussd_res and "Ticket: FG-" in ussd_res:
        # Extract Ticket ID
        ticket_prefix = ussd_res.split("Ticket: ")[1]
        ussd_ticket_id = ticket_prefix.split(".")[0]
        print(f"-> Result: PASS (Created ticket via USSD: {ussd_ticket_id})")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    # 7. USSD Status Tracking
    print("\n[TEST 7] Query Active Status via USSD")
    ussd_track_payload = {
        "sessionId": "session_at_8888",
        "serviceCode": "*254#",
        "phoneNumber": "+256799000000", # Tracking for the number that just reported
        "text": "2"  # Track active complaint
    }
    ussd_track_res = request_api("/ussd", method="POST", data=ussd_track_payload)
    print(f"USSD Track Response:\n{ussd_track_res}")
    if "END Active Case" in ussd_track_res and ussd_ticket_id in ussd_track_res:
        print("-> Result: PASS")
    else:
        print("-> Result: FAIL")
        sys.exit(1)

    print("\n==================================================")
    print("ALL E2E SYSTEM INTEGRATION TESTS PASSED!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
