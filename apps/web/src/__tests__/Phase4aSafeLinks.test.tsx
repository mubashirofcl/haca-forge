import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { safeUrl } from '../lib/safeUrl';
import { MediaCardPlayer } from '../pages/chat/MediaCardPlayer';

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'u1', id: 'u1', role: 'admin', name: 'Admin' }, hasPermission: () => true }),
}));
vi.mock('../context/GlobalFilterContext', () => ({
  useGlobalFilter: () => ({ filters: { month: '2026-11', departmentId: 'all' } }),
}));


describe('safeUrl', () => {
  it('keeps http(s) links and paths on this site', () => {
    expect(safeUrl('https://cdn.example.com/a.mp4')).toBe('https://cdn.example.com/a.mp4');
    expect(safeUrl('http://localhost:5173/x')).toBe('http://localhost:5173/x');
    expect(safeUrl('/uploads/chat/a/b/c.png')).toBe('/uploads/chat/a/b/c.png');
  });

  it('drops script, data and protocol-relative links', () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>x</b>', '//evil.example/x', '/\\evil.example', 'vbscript:x', '', null, undefined, 42]) {
      expect(safeUrl(bad)).toBeUndefined();
    }
  });
});

describe('MediaCardPlayer with unsafe links', () => {
  const card = {
    grantId: 'g1',
    assetId: 'a1',
    assetType: 'designImages',
    contentPieceId: 'cp1',
    contentPieceTitle: 'Piece',
    stageKey: 'Design',
    title: 'Poster',
    thumbnailUrl: 'javascript:alert(1)',
    previewUrl: 'javascript:alert(2)',
    downloadUrl: 'javascript:alert(3)',
    owner: { _id: 'u2', name: 'Someone' },
    isRevoked: false,
  };

  it('renders no download link and no image source for javascript: links', () => {
    const { container } = render(<MediaCardPlayer card={card as any} />);
    expect(screen.queryByTitle('Download asset')).not.toBeInTheDocument();
    for (const el of Array.from(container.querySelectorAll('[href],[src]'))) {
      expect(el.getAttribute('href') || el.getAttribute('src') || '').not.toMatch(/javascript:/i);
    }
  });

  it('keeps a safe download link', () => {
    render(<MediaCardPlayer card={{ ...card, downloadUrl: '/uploads/a.png', previewUrl: '/uploads/a.png', thumbnailUrl: '' } as any} />);
    expect(screen.getByTitle('Download asset')).toHaveAttribute('href', '/uploads/a.png');
  });
});
