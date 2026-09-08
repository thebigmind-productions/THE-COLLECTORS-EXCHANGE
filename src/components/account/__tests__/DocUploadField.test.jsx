import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocUploadField from '../DocUploadField';

describe('DocUploadField', () => {
  it('renders label', () => {
    render(<DocUploadField label="Upload ID" />);
    expect(screen.getByText('Upload ID')).toBeInTheDocument();
  });

  it('renders upload button text', () => {
    render(<DocUploadField label="Doc" />);
    expect(screen.getByText('Upload Scanned Copy')).toBeInTheDocument();
  });

  it('shows Replace Scan when docUrl exists', () => {
    render(<DocUploadField label="Doc" docUrl="http://test.com/doc.pdf" />);
    expect(screen.getByText('Replace Scan')).toBeInTheDocument();
  });

  it('calls onFileUpload on file select', () => {
    const onFileUpload = vi.fn();
    render(<DocUploadField label="Doc" onFileUpload={onFileUpload} />);
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileUpload).toHaveBeenCalledWith(file);
  });

  it('accepts image and pdf', () => {
    render(<DocUploadField label="Doc" />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('accept', 'image/*,application/pdf');
  });

  it('renders text input when placeholder is provided', () => {
    render(<DocUploadField label="Full Name" placeholder="Enter your name" />);
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
  });

  it('calls onValueChange on text input change', () => {
    const onValueChange = vi.fn();
    render(<DocUploadField label="Name" placeholder="Name" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'John' } });
    expect(onValueChange).toHaveBeenCalledWith('John');
  });

  it('hides text input when hideTextInput is true', () => {
    render(<DocUploadField label="Doc" placeholder="Name" hideTextInput />);
    expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument();
  });

  it('shows uploading state', () => {
    render(<DocUploadField label="Doc" uploading />);
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('shows view link when docUrl exists', () => {
    render(<DocUploadField label="Doc" docUrl="http://test.com/doc.pdf" />);
    expect(screen.getByText('View')).toBeInTheDocument();
  });
});

/**
 * Both labels in this component used to be bare `<label>` elements — no
 * `htmlFor`, no `id`, wrapping nothing. Tapping either did nothing, which on a
 * phone matters because the label is the bigger target, and a screen reader
 * announced the KYC fields as unlabelled "edit text".
 */
describe('DocUploadField — label association', () => {
  it('points the field label at the text input', () => {
    render(<DocUploadField label="PAN Number" placeholder="ABCDE1234F" />);
    expect(screen.getByLabelText('PAN Number')).toBe(screen.getByPlaceholderText('ABCDE1234F'));
  });

  it('points the field label at the file picker when there is no text input', () => {
    render(<DocUploadField label="Aadhaar Scan" hideTextInput placeholder="ignored" />);
    expect(screen.getByLabelText('Aadhaar Scan')).toBe(
      document.querySelector('input[type="file"]'),
    );
  });

  it('gives the file input a name of its own for assistive tech', () => {
    render(<DocUploadField label="PAN Number" placeholder="ABCDE1234F" />);
    expect(screen.getByLabelText(/PAN Number — upload scanned copy/i)).toBe(
      document.querySelector('input[type="file"]'),
    );
  });

  it('generates fresh ids per instance so two fields on one form never collide', () => {
    render(
      <>
        <DocUploadField label="PAN Number" placeholder="ABCDE1234F" />
        <DocUploadField label="GST Number" placeholder="22AAAAA0000A1Z5" />
      </>,
    );
    const pan = screen.getByLabelText('PAN Number');
    const gst = screen.getByLabelText('GST Number');
    expect(pan.id).not.toBe(gst.id);
    expect(pan).toBe(screen.getByPlaceholderText('ABCDE1234F'));
    expect(gst).toBe(screen.getByPlaceholderText('22AAAAA0000A1Z5'));
  });
});
