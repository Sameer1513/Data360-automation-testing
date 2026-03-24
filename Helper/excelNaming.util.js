/**
 * Excel worksheet names: max 31 chars; cannot contain : \ / ? * [ ]
 */
function sanitizeExcelSheetName(raw, fallback = 'Status_Config_UI') {
    if (raw == null || String(raw).trim() === '') return fallback;
    let s = String(raw).replace(/[\\\/\?\*\[\]:]/g, '_').trim();
    if (s.length > 31) s = s.slice(0, 31);
    return s || fallback;
}

/** Safe segment for Windows filenames (no path separators). */
function sanitizeFileSegment(raw, fallback = 'UnknownJob') {
    if (raw == null || String(raw).trim() === '') return fallback;
    let s = String(raw).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    if (s.length > 120) s = s.slice(0, 120);
    return s || fallback;
}

/** Single export folder name under `exports/` (project name). */
function sanitizeFolderName(raw, fallback = 'Project') {
    if (raw == null || String(raw).trim() === '') return fallback;
    let s = String(raw).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    if (s.length > 120) s = s.slice(0, 120);
    return s || fallback;
}

module.exports = { sanitizeExcelSheetName, sanitizeFileSegment, sanitizeFolderName };
