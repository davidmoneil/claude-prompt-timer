#!/usr/bin/env node
/**
 * Prompt Timer Hook
 *
 * Injects current time and elapsed-time context into every prompt.
 * Gives Claude awareness of:
 * - Current date/time with timezone
 * - Whether this is the first prompt of a session
 * - How long since the last prompt (short break, long gap, etc.)
 *
 * State persisted to ~/.claude/prompt-timer-state.json
 *
 * Created: 2026-04-09
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.homedir(), '.claude', 'prompt-timer-state.json');

function formatDelta(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function getTimingLabel(ms) {
  const minutes = ms / 60000;
  if (minutes < 2) return null; // rapid conversation, no comment needed
  if (minutes < 30) return '';
  if (minutes < 120) return ' — short break';
  if (minutes < 480) return ' — extended break, context may need refresh';
  return ' — long gap, context may have shifted significantly';
}

function getCurrentTimeFormatted() {
  const now = new Date();
  // Format with timezone abbreviation
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} ${get('timeZoneName')}`;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // Best-effort, never block the prompt
  }
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let context;
  try {
    context = JSON.parse(input);
  } catch {
    process.stdout.write(JSON.stringify({ proceed: true }));
    return;
  }

  const now = new Date();
  const nowISO = now.toISOString();
  const currentTime = getCurrentTimeFormatted();
  const sessionId = context.session_id || null;

  const state = readState();
  let statusLine;

  if (!state || !state.lastPromptTime) {
    // No state — first prompt ever or state was cleared
    statusLine = 'First prompt of session';
  } else if (sessionId && state.lastSessionId && sessionId !== state.lastSessionId) {
    // Different session ID — new session
    statusLine = 'First prompt of session';
  } else {
    // Same session — compute delta
    const lastTime = new Date(state.lastPromptTime);
    const deltaMs = now - lastTime;
    const label = getTimingLabel(deltaMs);

    if (label === null) {
      // < 2 min, just show timestamp, no elapsed comment
      statusLine = null;
    } else {
      statusLine = `${formatDelta(deltaMs)} since last prompt${label}`;
    }
  }

  // Write updated state
  writeState({
    lastPromptTime: nowISO,
    lastSessionId: sessionId
  });

  // Build output
  let timing = `--- Prompt Timing ---\nCurrent: ${currentTime}`;
  if (statusLine) timing += `\n${statusLine}`;
  timing += '\n---';

  process.stdout.write(JSON.stringify({
    proceed: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: timing
    }
  }));
}

main();
