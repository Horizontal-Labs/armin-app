#!/bin/bash

# Server Setup Script for Argument Mining API
# This script configures Docker authentication for GitHub Container Registry
# and sets up the production environment

set -e

echo "======================================"
echo "Argument Mining API - Server Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "ℹ $1"; }

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root or with sudo"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_warning "docker-compose is not installed. Installing via Docker plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
    print_success "docker-compose plugin installed"
fi

echo ""
echo "GitHub Container Registry Authentication"
echo "-------------------------------------------------"
echo ""

# Check if already logged in to ghcr.io
if docker pull ghcr.io/horizontal-labs/argument-mining-api:latest &> /dev/null; then
    print_success "Already authenticated to GitHub Container Registry"
else
    print_info "You need to authenticate with GitHub Container Registry"
    echo ""
    echo "Please create a Personal Access Token (PAT) with 'read:packages' scope:"
    echo "1. Go to: https://github.com/settings/tokens/new"
    echo "2. Give it a name (e.g., 'Docker Registry Read')"
    echo "3. Select scope: read:packages"
    echo "4. Click 'Generate token' and copy it"
    echo ""
    
    read -p "Enter your GitHub username: " GITHUB_USER
    read -s -p "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
    echo ""
    
    # Login to GitHub Container Registry
    echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USER --password-stdin
    
    if [ $? -eq 0 ]; then
        print_success "Successfully authenticated to GitHub Container Registry"
    else
        print_error "Failed to authenticate. Please check your credentials."
        exit 1
    fi
fi