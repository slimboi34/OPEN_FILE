# Open File Agent

Open File Agent is a 100% local, high-performance **Autonomous Desktop Agent** built with Tauri (Rust) and React. More than just a file finder, it is a fully-fledged AI agent that lives on your machine, capable of managing your system, running localized natural language searches, structuring background automation routines, and directly interfacing with your native shell.

## 🤖 Features & Capabilities

### 1. System Diagnostics
Your agent actively tracks disk space and accurately identifies redundant files. It isolates app caches, large unused media files, and duplicated archives, allowing you to safely clean up gigabytes of wasted space with one click, without risking critical system files.

### 2. Semantic Indexer
Powered by the speed of native macOS indexing (`mdfind`) and enhanced by local AI contextual awareness, the Semantic Indexer allows you to find what you're looking for by *meaning*, not just by specific filename. 

### 3. Agent Bridge (ReAct Loop)
The Agent Bridge directly interfaces the local AI engine with your computer's native shell. It uses a **ReAct** (Reason+Act) autonomous loop:
- You give the agent a natural language instruction (e.g., "Find all the large node_modules folders and delete them").
- The agent formulates the precise bash/sh commands.
- It executes them, observes the output (or error), refines its approach, and automatically iteratively executes until the task is complete.

### 4. Autonomous Routines (Jarvis Engine)
Put the agent on autopilot. Schedule natural language routines to run hourly, daily, or weekly in the background. Examples include:
- "Scan my downloads folder every day and organize screenshots into a Screenshots folder"
- "Auto-delete temporary cache files weekly"

## 🚀 Getting Started

Ensure you have Rust, Node, and Tauri properly installed.

### Running the Agent Locally

```bash
# Install dependencies
npm install

# Build and start the desktop agent
npm run tauri dev
```

## Privacy First
Open File Agent operates directly on your machine. API calls to the LLM are made from your client straight to the provider (OpenAI, Anthropic, or Google), with zero intermediary servers copying or scraping your local data or execution outputs. Your local files stay local.
