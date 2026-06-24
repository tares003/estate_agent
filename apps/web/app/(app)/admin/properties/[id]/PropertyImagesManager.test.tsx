// responsive-coverage: opt-out all — asserts the manager behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createPropertyImageUpload = vi.fn();
const finalizePropertyImage = vi.fn();
const setPrimaryPropertyImage = vi.fn();
const deletePropertyImage = vi.fn();
vi.mock('./image-actions.js', () => ({
  createPropertyImageUpload: (...args: unknown[]) => createPropertyImageUpload(...args),
  finalizePropertyImage: (...args: unknown[]) => finalizePropertyImage(...args),
  setPrimaryPropertyImage: (...args: unknown[]) => setPrimaryPropertyImage(...args),
  deletePropertyImage: (...args: unknown[]) => deletePropertyImage(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { PropertyImagesManager } = await import('./PropertyImagesManager.js');

const IMAGES = [
  {
    id: 'i1',
    alt: 'The front elevation',
    isPrimary: true,
    thumbUrl: '/api/storage/object?token=t1',
  },
  { id: 'i2', alt: 'The kitchen', isPrimary: false, thumbUrl: '/api/storage/object?token=t2' },
];

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 204 });
  createPropertyImageUpload.mockResolvedValue({
    ok: true,
    key: 'tenants/t/p/abc.png',
    token: 'tok',
  });
  finalizePropertyImage.mockResolvedValue({ ok: true });
  setPrimaryPropertyImage.mockResolvedValue({ ok: true });
  deletePropertyImage.mockResolvedValue({ ok: true });
});

const SUGGEST_PROPS = {
  propertyTitle: 'Edwardian semi · 4 bed',
  addressLine: 'Palatine Road, Didsbury',
} as const;

describe('PropertyImagesManager', () => {
  it('renders a thumbnail per image with the hero marked', () => {
    render(<PropertyImagesManager propertyId="p1" images={IMAGES} {...SUGGEST_PROPS} />);
    expect(screen.getByAltText('The front elevation')).toBeInTheDocument();
    expect(screen.getByAltText('The kitchen')).toBeInTheDocument();
    expect(screen.getByText('Hero')).toBeInTheDocument();
    // only the non-hero offers promotion
    expect(screen.getAllByRole('button', { name: /Make hero/i })).toHaveLength(1);
  });

  it('pre-fills the alt field with the §O.8 auto-suggestion (FR-O-13)', () => {
    render(<PropertyImagesManager propertyId="p1" images={IMAGES} {...SUGGEST_PROPS} />);
    // two images already exist, so the next photo is number 3
    const altField = screen.getByLabelText(/Alt text/i) as HTMLInputElement;
    expect(altField.value).toBe(
      'Photograph of Edwardian semi · 4 bed, Palatine Road, Didsbury — photo 3',
    );
  });

  it('lets the admin override the suggested alt before uploading', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PropertyImagesManager propertyId="p1" images={[]} {...SUGGEST_PROPS} />,
    );
    const altField = screen.getByLabelText(/Alt text/i) as HTMLInputElement;
    // the suggestion is editable
    await user.clear(altField);
    await user.type(altField, 'The front elevation at dusk');

    const file = new File([new Uint8Array([1, 2, 3])], 'front.png', { type: 'image/png' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Upload image/i }));

    await waitFor(() => expect(finalizePropertyImage).toHaveBeenCalled());
    expect(finalizePropertyImage).toHaveBeenCalledWith({
      propertyId: 'p1',
      key: 'tenants/t/p/abc.png',
      alt: 'The front elevation at dusk',
    });
  });

  it('uploads through the issue → PUT → finalize pipeline and refreshes', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PropertyImagesManager propertyId="p1" images={[]} {...SUGGEST_PROPS} />,
    );

    const file = new File([new Uint8Array([1, 2, 3])], 'front.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    const altField = screen.getByLabelText(/Alt text/i) as HTMLInputElement;
    await user.clear(altField);
    await user.type(altField, 'The front elevation');
    await user.click(screen.getByRole('button', { name: /Upload image/i }));

    await waitFor(() => expect(finalizePropertyImage).toHaveBeenCalled());
    expect(createPropertyImageUpload).toHaveBeenCalledWith({
      propertyId: 'p1',
      contentType: 'image/png',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/storage/upload?token=tok');
    expect(init.method).toBe('PUT');
    expect(finalizePropertyImage).toHaveBeenCalledWith({
      propertyId: 'p1',
      key: 'tenants/t/p/abc.png',
      alt: 'The front elevation',
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('asks for a file and alt text before starting an upload', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PropertyImagesManager propertyId="p1" images={[]} {...SUGGEST_PROPS} />,
    );
    // clear the suggestion so the empty-alt guard is exercised
    await user.clear(screen.getByLabelText(/Alt text/i));
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Upload image/i }));
    expect(await screen.findByText(/Choose an image and describe it/i)).toBeInTheDocument();
    expect(createPropertyImageUpload).not.toHaveBeenCalled();
  });

  it('surfaces a refused grant and stops (no PUT, no finalize)', async () => {
    createPropertyImageUpload.mockResolvedValue({
      ok: false,
      errors: [{ message: 'You do not have permission to edit listings.' }],
    });
    const user = userEvent.setup();
    const { container } = render(
      <PropertyImagesManager propertyId="p1" images={[]} {...SUGGEST_PROPS} />,
    );

    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Upload image/i }));

    expect(await screen.findByText(/do not have permission/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(finalizePropertyImage).not.toHaveBeenCalled();
  });

  it('surfaces a failed PUT and does not finalize', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 413 });
    const user = userEvent.setup();
    const { container } = render(
      <PropertyImagesManager propertyId="p1" images={[]} {...SUGGEST_PROPS} />,
    );

    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByRole('button', { name: /Upload image/i }));

    expect(await screen.findByText(/upload failed/i)).toBeInTheDocument();
    expect(finalizePropertyImage).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('promotes an image to hero and refreshes', async () => {
    const user = userEvent.setup();
    render(<PropertyImagesManager propertyId="p1" images={IMAGES} {...SUGGEST_PROPS} />);
    await user.click(screen.getByRole('button', { name: /Make hero/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setPrimaryPropertyImage).toHaveBeenCalledWith({ propertyId: 'p1', imageId: 'i2' });
  });

  it('deletes an image and refreshes', async () => {
    const user = userEvent.setup();
    render(<PropertyImagesManager propertyId="p1" images={IMAGES} {...SUGGEST_PROPS} />);
    await user.click(screen.getAllByRole('button', { name: /^Delete/i })[0]!);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(deletePropertyImage).toHaveBeenCalledWith({ propertyId: 'p1', imageId: 'i1' });
  });
});
