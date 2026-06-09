#!/usr/bin/env python3
"""
demo.py - Safe demo script for OWASP Hydra Engine
Usage:
  python3 demo.py           # runs demo
  python3 demo.py --target http://example.com
This script is intentionally harmless: it prints info, simulates a small workload,
and writes a simple last_run.txt in its folder to demonstrate logging.
"""
import argparse
import time
import datetime
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="Demo script for OWASP Hydra Engine")
    parser.add_argument('-t', '--target', help='Optional target URL or identifier', default=None)
    args = parser.parse_args()

    folder = os.path.basename(os.getcwd())
    ts = datetime.datetime.utcnow().isoformat() + "Z"

    print(f"=== Demo script for {folder} ===")
    print(f"Timestamp (UTC): {ts}")
    if args.target:
        print(f"Target: {args.target}")
    else:
        print("Target: (none)")

    # simulate some safe work
    for i in range(3):
        print(f"[{i+1}/3] Simulating work...")
        time.sleep(0.4)

    # write a small last_run file so the GUI/backend can show it
    try:
        with open('last_run.txt', 'w') as fh:
            fh.write(f"folder={folder}\n")
            fh.write(f"timestamp={ts}\n")
            fh.write(f"target={args.target or ''}\n")
    except Exception as e:
        print("Warning: failed to write last_run.txt:", e, file=sys.stderr)

    print("Demo complete. Exit code 0.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
