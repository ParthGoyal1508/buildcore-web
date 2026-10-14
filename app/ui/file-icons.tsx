import clsx from 'clsx';

/**
 * File-type marks for the buttons that produce a file (2026-10-15). The client: "Can we give the
 * excel, pdf and word logo as well in the buttons wherever we are using these type of buttons".
 *
 * Drawn here rather than taken from the products: a sheet with its corner folded and a band in
 * the colour each format is known by — Excel's green, Word's blue, PDF's red — with the letter or
 * name on it. Recognisable at a glance, and the app ships no one else's logo.
 *
 * Chosen from the button's label by `fileKind`, so "Excel", "Download PDF", "View PDF", "Export
 * to Excel" and "Word" each get theirs wherever they are, without each screen adding one.
 */
export type FileKind = 'excel' | 'pdf' | 'word' | 'csv';

const KINDS: { kind: FileKind; pattern: RegExp }[] = [
  { kind: 'excel', pattern: /\b(excel|xlsx?)\b/i },
  { kind: 'word', pattern: /\b(word|docx?)\b/i },
  { kind: 'pdf', pattern: /\bpdf\b/i },
  { kind: 'csv', pattern: /\bcsv\b/i },
];

export function fileKind(label: string): FileKind | null {
  return KINDS.find(({ pattern }) => pattern.test(label))?.kind ?? null;
}

const STYLE: Record<FileKind, { band: string; text: string; tag: string }> = {
  excel: { band: '#1D6F42', text: '#FFFFFF', tag: 'X' },
  word: { band: '#2B579A', text: '#FFFFFF', tag: 'W' },
  pdf: { band: '#D93025', text: '#FFFFFF', tag: 'PDF' },
  csv: { band: '#0F766E', text: '#FFFFFF', tag: 'CSV' },
};

export function FileIcon({
  kind,
  className,
}: {
  kind: FileKind;
  className?: string;
}) {
  const { band, text, tag } = STYLE[kind];
  const long = tag.length > 1;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={clsx('h-5 w-5 shrink-0', className)}
    >
      {/* The sheet, its corner folded. */}
      <path
        d="M5 1.5h7.2L16.5 5.8V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V3A1.5 1.5 0 0 1 5 1.5Z"
        fill="#FFFFFF"
        stroke="#CBD5E1"
      />
      <path
        d="M12.2 1.5v3.1a1.2 1.2 0 0 0 1.2 1.2h3.1"
        fill="none"
        stroke="#CBD5E1"
      />
      {/* The band with the format on it. */}
      <rect
        x={long ? 0.5 : 1}
        y="8"
        width={long ? 15.5 : 11}
        height="8.5"
        rx="1.6"
        fill={band}
      />
      <text
        x={long ? 8.25 : 6.5}
        y={long ? 14 : 14.6}
        textAnchor="middle"
        fontSize={long ? 5.4 : 7.5}
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill={text}
      >
        {tag}
      </text>
    </svg>
  );
}

/** The mark for a label that names a file format, or nothing. */
export function FileGlyph({ label }: { label: string }) {
  const kind = fileKind(label);
  return kind ? <FileIcon kind={kind} /> : null;
}
