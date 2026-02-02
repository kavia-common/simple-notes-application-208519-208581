#!/bin/bash
cd /home/kavia/workspace/code-generation/simple-notes-application-208519-208581/notes_app_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

