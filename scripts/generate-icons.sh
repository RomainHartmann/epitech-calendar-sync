#!/bin/bash

# Generate PNG icons from SVG
# Requires Inkscape or ImageMagick to be installed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets/icons"
SVG_FILE="$ASSETS_DIR/icon.svg"

# Check if source exists
if [ ! -f "$SVG_FILE" ]; then
    echo "Error: SVG file not found at $SVG_FILE"
    exit 1
fi

# Generate icons using ImageMagick (if installed)
if command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    convert -background none -resize 16x16 "$SVG_FILE" "$ASSETS_DIR/icon16.png"
    convert -background none -resize 32x32 "$SVG_FILE" "$ASSETS_DIR/icon32.png"
    convert -background none -resize 48x48 "$SVG_FILE" "$ASSETS_DIR/icon48.png"
    convert -background none -resize 128x128 "$SVG_FILE" "$ASSETS_DIR/icon128.png"
    echo "Icons generated successfully!"
# Or use Inkscape (if installed)
elif command -v inkscape &> /dev/null; then
    echo "Using Inkscape..."
    inkscape -w 16 -h 16 "$SVG_FILE" -o "$ASSETS_DIR/icon16.png"
    inkscape -w 32 -h 32 "$SVG_FILE" -o "$ASSETS_DIR/icon32.png"
    inkscape -w 48 -h 48 "$SVG_FILE" -o "$ASSETS_DIR/icon48.png"
    inkscape -w 128 -h 128 "$SVG_FILE" -o "$ASSETS_DIR/icon128.png"
    echo "Icons generated successfully!"
# Or use rsvg-convert (if installed)
elif command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert..."
    rsvg-convert -w 16 -h 16 "$SVG_FILE" -o "$ASSETS_DIR/icon16.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ASSETS_DIR/icon32.png"
    rsvg-convert -w 48 -h 48 "$SVG_FILE" -o "$ASSETS_DIR/icon48.png"
    rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ASSETS_DIR/icon128.png"
    echo "Icons generated successfully!"
else
    echo "Error: No suitable SVG converter found."
    echo "Please install ImageMagick, Inkscape, or librsvg"
    echo ""
    echo "On macOS: brew install imagemagick"
    echo "On Ubuntu: sudo apt install imagemagick"
    exit 1
fi
