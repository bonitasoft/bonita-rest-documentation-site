#!/usr/bin/env bash
set -euo pipefail

function usage() {
  launch_command=$(basename "${0}")
  echo "Usage: ${launch_command} <options>"
  echo "Build the REST documentation site."
  echo ""
}

########################################################################################################################
# Parse arguments
########################################################################################################################

scriptOptions="$@"
echo "Preparing the build"
echo "Script Options: ${scriptOptions}"

# Help
if [[ "$scriptOptions" == *"--help"* ]]; then
  usage
  exit 0
fi


########################################################################################################################
# PROCESSING
########################################################################################################################

echo "Building the preview using Node $(node --version)..."
rm -rf build/
node 'scripts/build-site.js' ${scriptOptions}
echo "Site ready build directory"
