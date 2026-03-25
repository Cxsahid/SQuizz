import os
import time
import subprocess
from datetime import datetime

def has_changes():
    result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
    return bool(result.stdout.strip())

def sync_to_github():
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        subprocess.run(['git', 'add', '.'], check=True, capture_output=True)
        subprocess.run(['git', 'commit', '-m', f'Auto-sync local edits ({timestamp})'], check=True, capture_output=True)
        subprocess.run(['git', 'push', 'origin', 'main'], check=True, capture_output=True)
        print(f"[{timestamp}] Changes successfully pushed to GitHub!")
    except subprocess.CalledProcessError as e:
        print(f"[{timestamp}] Error during sync: {e}")

if __name__ == "__main__":
    print("Starting GitHub Auto-Sync script...")
    print("This background script will check for file changes every 15 seconds and automatically push them to your repository.")
    while True:
        try:
            if has_changes():
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Detected local modifications. Syncing to GitHub...")
                sync_to_github()
            time.sleep(15)
        except KeyboardInterrupt:
            print("Auto-sync stopped manually.")
            break
