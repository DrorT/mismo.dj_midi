#!/bin/bash

# Quick test script for Pioneer DDJ-FLX4

echo "======================================================================"
echo "🎛️  Pioneer DDJ-FLX4 Test Menu"
echo "======================================================================"
echo ""
echo "Choose an option:"
echo ""
echo "1) Check if FLX4 is connected"
echo "2) Listen to raw MIDI events (press Ctrl+C to stop)"
echo "3) Run full server with debug output (press Ctrl+C to stop)"
echo "4) View recent log file"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
  1)
    echo ""
    echo "Checking for MIDI devices..."
    echo ""
    node test/manual/check-midi-devices.js
    ;;
  2)
    echo ""
    echo "Starting MIDI event listener..."
    echo "👉 Press buttons on your DDJ-FLX4 to see events"
    echo "🛑 Press Ctrl+C to stop"
    echo ""
    node test/manual/listen-midi-events.js "DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"
    ;;
  3)
    echo ""
    echo "Starting Controller Server with DEBUG mode..."
    echo "👉 Press buttons on your DDJ-FLX4 to see actions"
    echo "🛑 Press Ctrl+C to stop"
    echo ""
    DEBUG=true npm start
    ;;
  4)
    echo ""
    echo "Recent log entries:"
    echo ""
    tail -50 logs/combined.log
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac
