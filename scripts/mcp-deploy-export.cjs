#!/usr/bin/env node
/** Loads deploy args via fs.readFileSync UTF-8 from .mcp-call-export-csv.json */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '.mcp-call-export-csv.json');
const args = JSON.parse(fs.readFileSync(file, 'utf8'));
// Output path for agent to pass to CallMcpTool (stdout is JSON args only)
process.stdout.write(JSON.stringify(args));
