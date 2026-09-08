import React, { useId } from 'react';
import { Upload, ImageIcon } from 'lucide-react';

/**
 * `docUrl` is the stored document REFERENCE (a legacy public URL or, for
 * anything uploaded since the `kyc-documents` bucket was locked down, an opaque
 * private storage path). It only says "a document is attached".
 *
 * `docHref` is the openable link, if there is one. Callers resolve it through
 * `resolveKycDocumentHref` in `src/utils/kycDocuments.js`; a private storage
 * path resolves to null and we render a plain "Uploaded" marker instead of a
 * dead link. When `docHref` is omitted it falls back to `docUrl` so older
 * call sites that pass a plain URL keep working.
 */
const DocUploadField = ({
  label,
  placeholder,
  value,
  docUrl,
  docHref,
  uploading,
  onValueChange,
  onFileUpload,
  hideTextInput,
}) => {
  const viewHref = docHref === undefined ? docUrl : docHref;
  // The same component renders several times on the KYC form (PAN, Aadhaar,
  // GST...), so the ids that tie each label to its input have to be per-instance.
  const uid = useId();
  const textInputId = `${uid}-value`;
  const fileInputId = `${uid}-file`;
  const showTextInput = placeholder && !hideTextInput;

  return (
    <div className="mb-6 last:mb-0">
      {/* Points at the text input when there is one; at the file picker when the
          document is upload-only (`hideTextInput`). Either way it now focuses
          something — tapping the label used to do nothing, and a screen reader
          read both controls as an unlabelled "edit text". */}
      <label
        htmlFor={showTextInput ? textInputId : fileInputId}
        className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
      >
        {label}
      </label>
      <div className="flex gap-3 items-start">
        <div className="flex-grow space-y-2">
          {showTextInput && (
            <input
              id={textInputId}
              type="text"
              placeholder={placeholder}
              value={value || ''}
              onChange={(e) => onValueChange(e.target.value)}
              className="w-full p-3 sm:p-4 border border-gray-300 focus:outline-none focus:border-luxury-gold"
            />
          )}
          <div className="flex gap-2 items-center">
            <label
              htmlFor={fileInputId}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-luxury-gold transition-colors text-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload size={16} className="text-gray-400" aria-hidden="true" />
              <span className="text-gray-500">
                {uploading ? 'Uploading...' : docUrl ? 'Replace Scan' : 'Upload Scanned Copy'}
              </span>
              <input
                id={fileInputId}
                type="file"
                accept="image/*,application/pdf"
                aria-label={`${label} — upload scanned copy`}
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
            {docUrl &&
              (viewHref ? (
                <a
                  href={viewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-luxury-gold hover:underline flex items-center gap-1"
                >
                  <ImageIcon size={14} /> View
                </a>
              ) : (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <ImageIcon size={14} /> Uploaded
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocUploadField;
