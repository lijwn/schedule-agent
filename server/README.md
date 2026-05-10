# PFASP Platform Server

FastAPI-based backend for PFASP Schedule Agent MVP.

## Features

- **Identity Service**: User registration with phone + device ID
- **Agent Directory**: Register and search for agents
- **Message Forwarding**: Real-time message delivery via WebSocket
- **Online Status**: Heartbeat-based status tracking

## Quick Start

```bash
# Install dependencies with uv
cd server
uv sync

# Run the server
uv run python main.py
```

The server will start on `http://localhost:3001`

## API Endpoints

### Identity
- `POST /api/v1/identity/register` - Register new user
- `POST /api/v1/identity/verify` - Verify OTP and get session

### Agents
- `POST /api/v1/agents/register` - Register an agent
- `GET /api/v1/agents/search` - Search agents
- `GET /api/v1/agents/{agent_id}` - Get agent details
- `POST /api/v1/agents/{agent_id}/heartbeat` - Agent heartbeat

### Messages
- `POST /api/v1/messages/send` - Send message to agent

### WebSocket
- `WS /ws/{user_id}` - Real-time message connection

## Health Check

```bash
curl http://localhost:3001/health
```

## Environment

Python 3.11+ required.