#!/usr/bin/env bash
# Copies the case's fixture workspace into the run's working directory: the eval runner grants reads on add_dirs but never
# tells the agent where they are, so a case whose agent must read the fixture stages it here (run with --scaffold).
set -eu
cp -R "$(dirname "$0")/workspace/." .
