#!/usr/bin/env python
"""
PFASP Agent Communication Demo
Demonstrates how two agents negotiate a meeting
"""

import uvicorn
import threading
import time
import urllib.request
import json
import sys

BASE_URL = "http://localhost:3001"

def call_api(endpoint, method="POST", data=None, headers=None):
    """Make API call"""
    url = f"{BASE_URL}{endpoint}"
    req_data = json.dumps(data).encode() if data else None
    
    req = urllib.request.Request(url, data=req_data, method=method)
    req.add_header('Content-Type', 'application/json')
    
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Error: {e.code} - {e.read().decode()}")
        return None

def print_section(title):
    print(f"\n{'='*50}")
    print(f" {title}")
    print('='*50)

def main():
    print("""
    ╔══════════════════════════════════════════════════════╗
    ║     PFASP Agent Communication Demo                   ║
    ║     展示两个 Agent 之间如何协商日程                   ║
    ╚══════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Register two users (Alice and Bob)
    print_section("Step 1: Register Users")
    
    # Alice
    alice = call_api("/api/v1/identity/register", data={
        "phoneNumber": "+8613800138001",
        "deviceId": "device_alice",
        "displayName": "Alice"
    })
    alice_user_id = alice["userId"]
    alice_otp = alice["otp"]
    print(f"Alice registered: {alice_user_id}")
    
    # Bob
    bob = call_api("/api/v1/identity/register", data={
        "phoneNumber": "+8613800138002", 
        "deviceId": "device_bob",
        "displayName": "Bob"
    })
    bob_user_id = bob["userId"]
    bob_otp = bob["otp"]
    print(f"Bob registered: {bob_user_id}")
    
    # Step 2: Verify OTP and get sessions
    print_section("Step 2: Verify OTP & Login")
    
    alice_auth = call_api("/api/v1/identity/verify", data={
        "userId": alice_user_id,
        "code": alice_otp
    })
    alice_token = alice_auth["sessionToken"]
    print(f"Alice logged in: {alice_token[:20]}...")
    
    bob_auth = call_api("/api/v1/identity/verify", data={
        "userId": bob_user_id,
        "code": bob_otp
    })
    bob_token = bob_auth["sessionToken"]
    print(f"Bob logged in: {bob_token[:20]}...")
    
    # Step 3: Register agents
    print_section("Step 3: Register Agents")
    
    alice_agent = call_api("/api/v1/agents/register", data={
        "userId": alice_user_id,
        "type": "schedule-manager",
        "name": "Alice's Schedule Agent",
        "description": "Manages Alice's calendar",
        "capabilities": ["schedule:read", "schedule:write", "schedule:negotiate"]
    }, headers={"Authorization": alice_token})
    print(f"Alice's Agent: {alice_agent['agentId']}")
    
    bob_agent = call_api("/api/v1/agents/register", data={
        "userId": bob_user_id,
        "type": "schedule-manager", 
        "name": "Bob's Schedule Agent",
        "description": "Manages Bob's calendar",
        "capabilities": ["schedule:read", "schedule:write", "schedule:negotiate"]
    }, headers={"Authorization": bob_token})
    print(f"Bob's Agent: {bob_agent['agentId']}")
    
    # Step 4: Alice requests meeting with Bob
    print_section("Step 4: Alice requests meeting with Bob")
    
    message = {
        "senderUserId": alice_user_id,
        "receiverUserId": bob_user_id,
        "message": {
            "type": "request",
            "payload": {
                "action": "request_meeting",
                "meeting": {
                    "title": "Project Review Meeting",
                    "description": "Discuss Q2 project progress",
                    "duration": 60,
                    "preferredTimes": ["2026-05-15T10:00:00Z", "2026-05-15T14:00:00Z"]
                },
                "requesterNotes": "Need to review project milestones"
            }
        }
    }
    
    result = call_api("/api/v1/messages/send", data=message, headers={"Authorization": alice_token})
    print(f"Message sent: {result}")
    
    # Step 5: Show agent directory
    print_section("Step 5: Agent Directory")
    
    agents = call_api("/api/v1/agents/search", method="GET")
    print(f"Total agents: {len(agents['agents'])}")
    for a in agents['agents']:
        print(f"  - {a['name']} ({a['type']}) - {a['onlineStatus']}")
    
    # Step 6: Show health status
    print_section("Step 6: Server Status")
    
    health = call_api("/health", method="GET")
    print(f"Status: {health['status']}")
    print(f"Users: {health['users']}")
    print(f"Agents: {health['agents']}")
    
    print("""
    
    ╔══════════════════════════════════════════════════════╗
    ║                 Demo Complete!                       ║
    ╚══════════════════════════════════════════════════════╝
    
    Flow summary:
    1. Alice and Bob registered with phone + device ID
    2. Each got OTP verification and session token
    3. Each registered their Schedule Agent
    4. Alice's Agent sent a meeting request to Bob's Agent
    5. Bob's Agent would receive and process the request
    
    Next steps (not implemented in MVP demo):
    - Bob's Agent processes the request
    - Negotiation: suggest alternative times
    - User confirmation (both must confirm)
    - Meeting finalized
    """)

if __name__ == "__main__":
    # Check if server is running
    try:
        urllib.request.urlopen(f"{BASE_URL}/health")
    except:
        print("Error: Server not running on http://localhost:3001")
        print("Please start the server first:")
        print("  cd server")
        print("  uv run uvicorn main:app --host 0.0.0.0 --port 3001")
        sys.exit(1)
    
    main()