// responsive-coverage: opt-out all — asserts the upload flow; layout is the
// public-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const issueContractorUploadGrants = vi.fn();
const finalizeContractorRepairFiles = vi.fn();
vi.mock('./upload-actions.js', () => ({
  issueContractorUploadGrants: (...args: unknown[]) => issueContractorUploadGrants(...args),
  finalizeContractorRepairFiles: (...args: unknown[]) => finalizeContractorRepairFiles(...args),
}));

const { ContractorPhotoUpload } = await import('./ContractorPhotoUpload.js');

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 204 });
  issueContractorUploadGrants.mockResolvedValue({
    ok: true,
    grants: [{ key: 'tenants/t/repairs/r/done.jpg', token: 'gtok', name: 'done.jpg' }],
  });
  finalizeContractorRepairFiles.mockResolvedValue({ ok: true });
});

describe('ContractorPhotoUpload', () => {
  it('runs issue → PUT → finalize for the chosen photos and confirms', async () => {
    const user = userEvent.setup();
    const { container } = render(<ContractorPhotoUpload token="tok.en.sig" />);

    const file = new File([new Uint8Array([1, 2])], 'done.jpg', { type: 'image/jpeg' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Upload photos/i }));

    await waitFor(() => expect(finalizeContractorRepairFiles).toHaveBeenCalled());
    expect(issueContractorUploadGrants).toHaveBeenCalledWith('tok.en.sig', [
      { name: 'done.jpg', contentType: 'image/jpeg', sizeBytes: 2 },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/storage/upload?token=gtok');
    expect(init.method).toBe('PUT');
    expect(finalizeContractorRepairFiles).toHaveBeenCalledWith('tok.en.sig', [
      {
        key: 'tenants/t/repairs/r/done.jpg',
        name: 'done.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 2,
      },
    ]);
    expect(await screen.findByText(/1 photo uploaded/i)).toBeInTheDocument();
  });

  it('surfaces a failure and does not confirm when a PUT fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 413 });
    const user = userEvent.setup();
    const { container } = render(<ContractorPhotoUpload token="tok.en.sig" />);

    const file = new File([new Uint8Array([1])], 'done.jpg', { type: 'image/jpeg' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Upload photos/i }));

    expect(await screen.findByText(/could not be uploaded/i)).toBeInTheDocument();
    expect(finalizeContractorRepairFiles).not.toHaveBeenCalled();
  });
});
