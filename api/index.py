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
    # Read the variables sent via POST from our API
    session_id   = request.values.get("sessionId", None)
    serviceCode  = request.values.get("serviceCode", None)
    phone_number = request.values.get("phoneNumber", None)
    text         = request.values.get("text", "")

    if text      == '':
        # This is the first request. Note how we start the response with CON
        response  = "CON What would you want to check \n"
        response += "1. My Account \n"
        response += "2. My phone number"

    elif text    == '1':
        # Business logic for first level response
        response  = "CON Choose account information you want to view \n"
        response += "1. Account number"

    elif text   == '2':
        # This is a terminal request. Note how we start the response with END
        response = "END Your phone number is " + str(phone_number)

    elif text          == '1*1':
        # This is a second level response where the user selected 1 in the first instance
        accountNumber  = "ACC1001"
        # This is a terminal request. Note how we start the response with END
        response       = "END Your account number is " + accountNumber

    else:
        response = "END Invalid choice"

    # Send the response back to Africa's Talking API as text/plain
    resp = make_response(response)
    resp.headers['Content-Type'] = 'text/plain'
    return resp

if __name__ == '__main__':
    app.run(debug=True)
