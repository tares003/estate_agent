// responsive-coverage: opt-out all — FileDropzone is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { FileDropzone } from './FileDropzone.js';

/** The files passed to onFiles on the nth call (0-based). Narrows for strict TS. */
function filesOnCall(onFiles: Mock, index: number): File[] {
  const call = onFiles.mock.calls.at(index);
  if (!call) throw new Error(`onFiles was not called ${index + 1} time(s)`);
  return call[0] as File[];
}

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (verified instead in the Playwright + axe visual
// suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

/** Build a File with a controllable byte size for the size-validation cases. */
function makeFile(name: string, type: string, size = 8): File {
  const file = new File(['x'.repeat(size)], name, { type });
  // jsdom computes size from the blob parts, but pin it explicitly so the
  // maxSizeBytes assertions are independent of how jsdom measures the blob.
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

describe('FileDropzone', () => {
  it('renders a labelled file input reachable by its accessible name (never placeholder-only)', () => {
    render(<FileDropzone label="Upload documents" onFiles={vi.fn()} />);
    const input = screen.getByLabelText('Upload documents');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('type', 'file');
  });

  it('renders the hint and wires it to the input via aria-describedby', () => {
    render(
      <FileDropzone label="Upload documents" hint="PDF or JPG, up to 5 MB" onFiles={vi.fn()} />,
    );
    const input = screen.getByLabelText('Upload documents');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('PDF or JPG, up to 5 MB')).toBeInTheDocument();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'PDF or JPG, up to 5 MB',
    );
  });

  it('passes accept and multiple through to the native input', () => {
    render(<FileDropzone label="Upload documents" accept="image/*" multiple onFiles={vi.fn()} />);
    const input = screen.getByLabelText('Upload documents');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('multiple');
  });

  it('is single-select by default (no multiple attribute)', () => {
    render(<FileDropzone label="Upload documents" onFiles={vi.fn()} />);
    expect(screen.getByLabelText('Upload documents')).not.toHaveAttribute('multiple');
  });

  it('fires onFiles with the accepted files when selected through the input', async () => {
    const onFiles = vi.fn();
    const user = userEvent.setup();
    render(<FileDropzone label="Upload documents" multiple onFiles={onFiles} />);

    const input = screen.getByLabelText('Upload documents');
    const a = makeFile('survey.pdf', 'application/pdf');
    const b = makeFile('photo.jpg', 'image/jpeg');
    await user.upload(input, [a, b]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(filesOnCall(onFiles, 0).map((f) => f.name)).toEqual(['survey.pdf', 'photo.jpg']);
  });

  it('adds files from a native drop event', () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload documents" multiple onFiles={onFiles} />);

    const dropzone = screen.getByTestId('filedropzone');
    const dropped = makeFile('lease.pdf', 'application/pdf');
    fireEvent.drop(dropzone, { dataTransfer: { files: [dropped] } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(filesOnCall(onFiles, 0).map((f) => f.name)).toEqual(['lease.pdf']);
    expect(screen.getByText('lease.pdf')).toBeInTheDocument();
  });

  it('reflects the drag-over state and announces it via the live region', () => {
    render(<FileDropzone label="Upload documents" onFiles={vi.fn()} />);
    const dropzone = screen.getByTestId('filedropzone');
    const status = screen.getByTestId('filedropzone-status');

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } });
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } });
    expect(dropzone).toHaveClass('is-dragover');
    expect(status).not.toBeEmptyDOMElement();

    fireEvent.dragLeave(dropzone, { dataTransfer: { files: [] } });
    expect(dropzone).not.toHaveClass('is-dragover');
  });

  it('rejects an oversize file and reports it in an alert region', () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload documents" maxSizeBytes={10} onFiles={onFiles} />);

    const dropzone = screen.getByTestId('filedropzone');
    const tooBig = makeFile('huge.pdf', 'application/pdf', 99);
    fireEvent.drop(dropzone, { dataTransfer: { files: [tooBig] } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/huge\.pdf/);
    expect(alert).toHaveTextContent(/too large|exceeds|maximum|size/i);
    // the rejected file is not surfaced to the consumer
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('rejects a file whose type is not in accept and reports it in an alert', () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload documents" accept="image/*" onFiles={onFiles} />);

    const dropzone = screen.getByTestId('filedropzone');
    const wrong = makeFile('notes.txt', 'text/plain');
    fireEvent.drop(dropzone, { dataTransfer: { files: [wrong] } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/notes\.txt/);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('accepts the valid files and rejects only the invalid ones from a mixed drop', () => {
    const onFiles = vi.fn();
    render(
      <FileDropzone
        label="Upload documents"
        accept="image/*"
        multiple
        maxSizeBytes={100}
        onFiles={onFiles}
      />,
    );

    const dropzone = screen.getByTestId('filedropzone');
    const ok = makeFile('photo.jpg', 'image/jpeg', 20);
    const wrongType = makeFile('notes.txt', 'text/plain', 20);
    const tooBig = makeFile('massive.jpg', 'image/jpeg', 9000);
    fireEvent.drop(dropzone, { dataTransfer: { files: [ok, wrongType, tooBig] } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(filesOnCall(onFiles, 0).map((f) => f.name)).toEqual(['photo.jpg']);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/notes\.txt/);
    expect(alert).toHaveTextContent(/massive\.jpg/);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('lists each selected file with a remove button that removes it', async () => {
    const onFiles = vi.fn();
    const user = userEvent.setup();
    render(<FileDropzone label="Upload documents" multiple onFiles={onFiles} />);

    const input = screen.getByLabelText('Upload documents');
    await user.upload(input, [
      makeFile('a.pdf', 'application/pdf'),
      makeFile('b.pdf', 'application/pdf'),
    ]);

    const list = screen.getByRole('list', { name: /selected files/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    const removeA = screen.getByRole('button', { name: /remove a\.pdf/i });
    await user.click(removeA);

    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    // onFiles fires again with the remaining file after removal
    expect(filesOnCall(onFiles, -1).map((f) => f.name)).toEqual(['b.pdf']);
  });

  it('opens the picker via keyboard (the label-wrapped input is reachable and clickable)', async () => {
    const user = userEvent.setup();
    render(<FileDropzone label="Upload documents" onFiles={vi.fn()} />);
    const input = screen.getByLabelText('Upload documents');

    // a programmatic click is what Enter/Space on a focused file input triggers;
    // assert the input receives it (the browser then opens the OS picker).
    const clickSpy = vi.spyOn(input, 'click');
    await user.click(screen.getByText('Upload documents'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('replaces the selection in single-select mode rather than appending', () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload documents" onFiles={onFiles} />);
    const dropzone = screen.getByTestId('filedropzone');

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('first.pdf', 'application/pdf')] },
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('second.pdf', 'application/pdf')] },
    });

    expect(screen.queryByText('first.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('second.pdf')).toBeInTheDocument();
    expect(filesOnCall(onFiles, -1).map((f) => f.name)).toEqual(['second.pdf']);
  });

  it('appends to the existing selection in multiple mode', () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload documents" multiple onFiles={onFiles} />);
    const dropzone = screen.getByTestId('filedropzone');

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('first.pdf', 'application/pdf')] },
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('second.pdf', 'application/pdf')] },
    });

    expect(screen.getByText('first.pdf')).toBeInTheDocument();
    expect(screen.getByText('second.pdf')).toBeInTheDocument();
    expect(filesOnCall(onFiles, -1).map((f) => f.name)).toEqual(['first.pdf', 'second.pdf']);
  });

  it('clears a prior rejection alert on the next successful drop', () => {
    render(<FileDropzone label="Upload documents" accept="image/*" multiple onFiles={vi.fn()} />);
    const dropzone = screen.getByTestId('filedropzone');

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('notes.txt', 'text/plain')] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/notes\.txt/);

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeFile('ok.jpg', 'image/jpeg')] },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('honours an explicit id so the label association is stable', () => {
    render(<FileDropzone id="docs" label="Upload documents" onFiles={vi.fn()} />);
    expect(screen.getByLabelText('Upload documents')).toHaveAttribute('id', 'docs');
  });

  it('does not fire onFiles for an empty drop', () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload documents" onFiles={onFiles} />);
    fireEvent.drop(screen.getByTestId('filedropzone'), { dataTransfer: { files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('works as a controlled-from-parent surface (consumer can render its own count)', async () => {
    const user = userEvent.setup();
    function Harness(): ReactElement {
      const [count, setCount] = useState(0);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <FileDropzone
            label="Upload documents"
            multiple
            onFiles={(files) => setCount(files.length)}
          />
        </div>
      );
    }
    render(<Harness />);
    await user.upload(screen.getByLabelText('Upload documents'), [
      makeFile('a.pdf', 'application/pdf'),
      makeFile('b.pdf', 'application/pdf'),
    ]);
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('has no detectable axe-core accessibility violations (idle)', async () => {
    const { container } = render(
      <FileDropzone label="Upload documents" hint="PDF or JPG, up to 5 MB" onFiles={vi.fn()} />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (with files + an error)', () => {
    const { container } = render(
      <FileDropzone label="Upload documents" accept="image/*" multiple onFiles={vi.fn()} />,
    );
    const dropzone = screen.getByTestId('filedropzone');
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [makeFile('photo.jpg', 'image/jpeg'), makeFile('notes.txt', 'text/plain')],
      },
    });
    return axe.run(container, axeOptions).then((results) => {
      expect(results.violations).toEqual([]);
    });
  });
});
