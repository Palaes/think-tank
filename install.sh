#!/usr/bin/env bash

set -e

ask() {
	local answer
	read -r -p "$1 [y/N] " answer || answer=""
	case "$answer" in
		[yY]|[yY][eE][sS])
			return 0
			;;
	esac
	return 1
}

if ! command -v brew >/dev/null 2>&1; then
	if ask "Homebrew is not installed. Install it?"; then
		echo "Installing Homebrew..."
		/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	else
		echo "Homebrew is required to install the dependencies."
		exit 1
	fi
fi

if [ -x /opt/homebrew/bin/brew ]; then
	eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
	eval "$(/usr/local/bin/brew shellenv)"
fi

if command -v node >/dev/null 2>&1; then
	echo "Node.js is already installed."
elif ask "Install Node.js with Homebrew?"; then
	echo "Installing Node.js..."
	brew install node
fi

if command -v ollama >/dev/null 2>&1; then
	echo "Ollama is already installed."
elif ask "Install Ollama with Homebrew?"; then
	echo "Installing Ollama..."
	brew install ollama
fi

if command -v ffmpeg >/dev/null 2>&1; then
	echo "ffmpeg is already installed."
elif ask "Install ffmpeg with Homebrew?"; then
	echo "Installing ffmpeg..."
	brew install ffmpeg
fi

if command -v draw-things-cli >/dev/null 2>&1; then
	echo "draw-things-cli is already installed."
elif ask "Install draw-things-cli with Homebrew?"; then
	echo "Installing draw-things-cli..."
	brew install draw-things-cli
fi

if command -v tsc >/dev/null 2>&1; then
	echo "TypeScript is already installed."
elif ! command -v npm >/dev/null 2>&1; then
	echo "npm is not available. Install Node.js first."
elif ask "Install TypeScript with npm?"; then
	echo "Installing TypeScript..."
	npm install -g typescript
fi

if ask "Open the Real-ESRGAN macOS download?"; then
	echo "Opening the Real-ESRGAN macOS download..."
	open "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip"
fi

echo ""
echo "Done."
echo "Draw Things is installed separately from https://drawthings.ai/ or with: brew install --cask draw-things"
echo "Place realesrgan-ncnn-vulkan in PATH."
echo "Place its models in ~/ThinkTank/Prisms/Models/RealESRGAN and Draw Things models in ~/ThinkTank/Prisms/Models/DrawThings."
echo "Move either by adding its path to ~/.config/think-tank/locations.json."
echo "Pull a chat model before starting Agora, for example: ollama pull llama3.1"
