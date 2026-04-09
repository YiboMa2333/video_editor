# Python Setup Guide (AI Video Editor)

This guide covers setting up Python for the optional FastAPI server in `apps/api/`.

## Current Status

**The API server is a planned feature.** Python setup is optional for now. Skip this guide if you only need the desktop video editor.

## Requirements

- Python 3.10 or later
- pip (included with Python)
- (Optional) Virtual environment tools

## Setup Instructions

### Step 1: Check Python Installation

Open PowerShell and verify Python is installed:

```powershell
python --version
```

If not installed, download from https://www.python.org/downloads/ or use a package manager:

```powershell
# Windows Package Manager
winget install Python.Python.3.10

# Or with Chocolatey
choco install python
```

### Step 2: (Recommended) Create Virtual Environment

It's best practice to use a virtual environment for Python projects. You can store it in `tools/python/` or elsewhere:

```powershell
# Create venv in tools/python
python -m venv tools/python/venv

# Activate it
tools/python/venv/Scripts/Activate.ps1

# You should see (venv) in your prompt
```

On macOS/Linux:
```bash
python3 -m venv tools/python/venv
source tools/python/venv/bin/activate
```

### Step 3: Install API Dependencies

From the repository root:

```powershell
cd ai-video-editor
pip install -r apps/api/requirements.txt
```

This installs:
- fastapi (web framework)
- uvicorn (ASGI server)
- pydantic (data validation)

### Step 4: Run the API Server

From the repository root:

```powershell
cd apps/api
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

## Environment Variables

To tell the desktop app where to find Python:

```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_PYTHON_PATH", "C:\path\to\python.exe", "User")
```

Or, if Python is on your system PATH (default for most installations), leave it unset.

## Troubleshooting

### "Python Command Not Found"

```powershell
# Use python3 instead
python3 --version

# Or use the full path
"C:\Users\[username]\AppData\Local\Programs\Python\Python310\python.exe" --version
```

### Virtual Environment Not Activating

Make sure PowerShell Execution Policy allows scripts:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Import Errors ("fastapi not found")

Ensure the virtual environment is activated:
```powershell
# Check if (venv) appears in your prompt
# If not, run:
tools/python/venv/Scripts/Activate.ps1

# Then reinstall:
pip install -r apps/api/requirements.txt
```

### VS Code Python Interpreter

If VS Code shows "Import fastapi could not be resolved":

1. Press Ctrl+Shift+P → "Python: Select Interpreter"
2. Choose "Enter interpreter path"
3. Type the path to your virtual environment's Python:
   ```
   C:\[repo]\tools\python\venv\Scripts\python.exe
   ```

## Deactivating Virtual Environment

When you're done:

```powershell
deactivate
```

## More Information

- FastAPI docs: https://fastapi.tiangolo.com/
- Python venv docs: https://docs.python.org/3/library/venv.html
- See [tools/README.md](./README.md) for other tools
- See main [README.md](../README.md) for desktop app setup

