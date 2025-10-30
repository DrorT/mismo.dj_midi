#!/bin/bash

echo "======================================================================"
echo "🎛️  Testing 14-bit MIDI Support with DDJ-FLX4"
echo "======================================================================"
echo ""
echo "This will start the server with DEBUG mode."
echo "Move your VOLUME faders slowly and watch for 14-bit messages!"
echo ""
echo "What to look for:"
echo "  - 'highRes: true' in the MIDI input"
echo "  - 'normalized' value between 0.0 and 1.0"
echo "  - 'value14bit' showing full 16384 range"
echo ""
echo "Press Ctrl+C to stop"
echo ""
echo "======================================================================"
echo ""

sleep 2

DEBUG=true npm start
