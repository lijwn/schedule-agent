# PFASP Platform Server
# 
# MVP Backend - FastAPI + WebSocket
#
# Responsibilities:
# - Identity authentication
# - Agent Directory
# - Message forwarding
# - Online status management

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import asyncio
from datetime import datetime

app = FastAPI(title="PFASP Platform Server", version="0.1.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Models ====================

class UserRegistration(BaseModel):
    phoneNumber: str
    deviceId: str
    displayName: Optional[str] = None

class AuthRequest(BaseModel):
    userId: str
    deviceId: str

class OTPCode(BaseModel):
    userId: str
    code: str

class AgentRegistration(BaseModel):
    userId: str
    type: str
    name: str
    description: str
    capabilities: List[str]
    publicKey: Optional[str] = None

class MessageRequest(BaseModel):
    senderUserId: str
    receiverUserId: str
    message: dict

# ==================== In-Memory Storage ====================

# User storage
users: Dict[str, dict] = {}

# Agent storage  
agents: Dict[str, dict] = {}

# Sessions
sessions: Dict[str, dict] = {}

# OTPs (in production, use Redis)
otps: Dict[str, str] = {}

# WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# ==================== Identity Endpoints ====================

@app.post("/api/v1/identity/register")
async def register_user(data: UserRegistration):
    """Register a new user identity"""
    user_id = f"user_{data.phoneNumber}_{data.deviceId}"
    
    user = {
        "id": user_id,
        "phoneNumber": data.phoneNumber,
        "deviceId": data.deviceId,
        "displayName": data.displayName or f"User_{user_id[:8]}",
        "createdAt": datetime.utcnow().isoformat(),
        "lastActiveAt": datetime.utcnow().isoformat(),
    }
    
    users[user_id] = user
    
    # Generate OTP for verification
    otp = str(datetime.utcnow().timestamp())[-6:]
    otps[user_id] = otp
    
    return {
        "userId": user_id,
        "otp": otp,  # In production, send via SMS
        "message": "OTP sent to your phone"
    }

@app.post("/api/v1/identity/verify")
async def verify_otp(data: OTPCode):
    """Verify OTP and create session"""
    stored_otp = otps.get(data.userId)
    
    if not stored_otp or stored_otp != data.code:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    # Create session token
    session_token = f"session_{datetime.utcnow().timestamp()}"
    sessions[session_token] = {
        "userId": data.userId,
        "createdAt": datetime.utcnow().isoformat(),
    }
    
    # Clear OTP
    del otps[data.userId]
    
    return {
        "sessionToken": session_token,
        "userId": data.userId
    }

def verify_session(token: str) -> Optional[str]:
    """Verify session and return userId"""
    session = sessions.get(token)
    if session:
        return session.get("userId")
    return None

# ==================== Agent Discovery Endpoints ====================

@app.post("/api/v1/agents/register")
async def register_agent(data: AgentRegistration, authorization: str = Header(None)):
    """Register a new agent"""
    # Verify session
    user_id = verify_session(authorization or "")
    if not user_id or user_id != data.userId:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    agent_id = f"agent_{data.userId}_{data.type}"
    
    agent = {
        "id": agent_id,
        "ownerUserId": data.userId,
        "type": data.type,
        "name": data.name,
        "description": data.description,
        "capabilities": data.capabilities,
        "publicKey": data.publicKey,
        "onlineStatus": "online",
        "lastSeen": datetime.utcnow().isoformat(),
    }
    
    agents[agent_id] = agent
    
    return {"agentId": agent_id, "status": "registered"}

@app.get("/api/v1/agents/search")
async def search_agents(q: str = None, capability: str = None):
    """Search for agents"""
    results = []
    
    for agent in agents.values():
        if agent["onlineStatus"] != "online":
            continue
            
        if capability and capability in agent["capabilities"]:
            results.append(agent)
        elif q:
            if q.lower() in agent["name"].lower() or q.lower() in agent["description"].lower():
                results.append(agent)
        else:
            results.append(agent)
    
    return {"agents": results}

@app.get("/api/v1/agents/{agent_id}")
async def get_agent(agent_id: str):
    """Get agent details"""
    agent = agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@app.post("/api/v1/agents/{agent_id}/heartbeat")
async def agent_heartbeat(agent_id: str, authorization: str = Header(None)):
    """Agent heartbeat to update online status"""
    agent = agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent["onlineStatus"] = "online"
    agent["lastSeen"] = datetime.utcnow().isoformat()
    
    return {"status": "ok"}

# ==================== Messaging Endpoints ====================

@app.post("/api/v1/messages/send")
async def send_message(data: MessageRequest, authorization: str = Header(None)):
    """Send a message to another agent"""
    # Verify sender
    sender_id = verify_session(authorization or "")
    if not sender_id or sender_id != data.senderUserId:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check if receiver is online
    receiver_agents = [a for a in agents.values() if a["ownerUserId"] == data.receiverUserId]
    
    response = {
        "status": "queued",
        "messageId": f"msg_{datetime.utcnow().timestamp()}",
    }
    
    # If receiver is connected via WebSocket, forward immediately
    if data.receiverUserId in active_connections:
        await active_connections[data.receiverUserId].send_json({
            "type": "message",
            "data": data.message,
            "from": data.senderUserId,
        })
        response["status"] = "delivered"
    
    return response

# ==================== WebSocket ====================

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket connection for real-time messaging"""
    await websocket.accept()
    active_connections[user_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            msg_type = message.get("type")
            
            if msg_type == "heartbeat":
                # Update online status for user's agents
                for agent in agents.values():
                    if agent["ownerUserId"] == user_id:
                        agent["onlineStatus"] = "online"
                        agent["lastSeen"] = datetime.utcnow().isoformat()
            
            elif msg_type == "message":
                # Forward to recipient
                recipient = message.get("to")
                if recipient in active_connections:
                    await active_connections[recipient].send_json({
                        "type": "message",
                        "data": message.get("data"),
                        "from": user_id,
                    })
            
    except WebSocketDisconnect:
        pass
    finally:
        if user_id in active_connections:
            del active_connections[user_id]

# ==================== Status ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "users": len(users),
        "agents": len(agents),
        "connections": len(active_connections),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)