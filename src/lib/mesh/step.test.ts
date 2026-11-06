import { describe, expect, it } from 'vitest';
import type { TriMesh } from './mesh';
import { writeStep } from './step';

const cube: TriMesh = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1].map((v) => v * 100)),
  indices: new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ]),
};

const text = (r: ReturnType<typeof writeStep>) => new TextDecoder().decode(r.bytes);

describe('writeStep', () => {
  it('writes a closed cube as a solid in mm', () => {
    const r = writeStep(cube, "Bob's chair");
    const s = text(r);
    expect(r).toMatchObject({ faces: 12, solid: true });
    expect(s.startsWith('ISO-10303-21;')).toBe(true);
    expect(s.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
    expect(s).toContain('SI_UNIT(.MILLI.,.METRE.)');
    expect(s).toContain("MANIFOLD_SOLID_BREP('Bob''s chair'");
    expect(s.match(/ADVANCED_FACE/g)).toHaveLength(12);
    expect(s.match(/EDGE_CURVE/g)).toHaveLength(18); // each shared edge written once
    expect(s.match(/VERTEX_POINT/g)).toHaveLength(8);
    expect(s).toContain("CARTESIAN_POINT('',(100.,100.,100.))");
  });

  it('writes an open mesh as a surface body and skips degenerate triangles', () => {
    const open: TriMesh = { positions: cube.positions, indices: new Uint32Array([...cube.indices.slice(0, 33), 0, 0, 1]) };
    const r = writeStep(open);
    expect(r).toMatchObject({ faces: 11, solid: false });
    expect(text(r)).toContain('SHELL_BASED_SURFACE_MODEL');
  });

  it('references only entities that exist', () => {
    const s = text(writeStep(cube));
    const defined = new Set([...s.matchAll(/^#(\d+)=/gm)].map((m) => m[1]));
    const used = [...s.matchAll(/#(\d+)(?!=)/g)].map((m) => m[1]);
    expect(used.every((id) => defined.has(id))).toBe(true);
  });
});
