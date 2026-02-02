/**
 * CLI output parsing utilities
 */

import { stripAnsi } from './errors.js';

/**
 * Parse CLI output and clean it for MCP response
 */
export function parseCliOutput(output: string): string {
  return stripAnsi(output).trim();
}

/**
 * Try to parse JSON from CLI output
 * Returns null if parsing fails
 */
export function tryParseJson<T>(output: string): T | null {
  try {
    const cleaned = stripAnsi(output).trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Extract table data from CLI output
 * Parses simple table format with headers
 */
export function parseTable(output: string): Array<Record<string, string>> {
  const lines = stripAnsi(output).trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];

  // Find column boundaries from header separators (usually --- or ═══)
  const separatorLine = lines[1];
  if (!separatorLine || !separatorLine.match(/^[-─═]+/)) {
    // No separator line, try simple space-separated
    return parseSpaceSeparatedTable(lines);
  }

  const headers = headerLine.split(/\s{2,}/).map(h => h.trim()).filter(Boolean);
  const results: Array<Record<string, string>> = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const values = line.split(/\s{2,}/).map(v => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    results.push(row);
  }

  return results;
}

/**
 * Parse simple space-separated table
 */
function parseSpaceSeparatedTable(lines: string[]): Array<Record<string, string>> {
  if (lines.length < 1) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];

  const headers = headerLine.split(/\s+/).map(h => h.trim()).filter(Boolean);
  const results: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const values = line.split(/\s+/).map(v => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    results.push(row);
  }

  return results;
}

/**
 * Extract key-value pairs from CLI output
 * Handles formats like "Key: Value" or "Key = Value"
 */
export function parseKeyValues(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = stripAnsi(output).trim().split('\n');

  for (const line of lines) {
    // Match "Key: Value" or "Key = Value" patterns
    const match = line.match(/^([^:=]+)[:\s=]+(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1].trim();
      const value = match[2].trim();
      result[key] = value;
    }
  }

  return result;
}
