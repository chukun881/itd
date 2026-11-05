import type { TriMesh } from './mesh';

/**
 * Write a triangle mesh (mm) as a STEP AP214 file with one flat face per triangle.
 * Closed, consistently oriented meshes become a solid (MANIFOLD_SOLID_BREP);
 * anything else becomes a surface body (SHELL_BASED_SURFACE_MODEL). Inventor opens
 * both; the result is faceted, not parametric, and meant as a draft to model over.
 */
export interface StepResult {
  bytes: Uint8Array;
  faces: number;
  solid: boolean;
}

/** STEP real: always has a decimal point, exponent in upper case. */
function real(x: number): string {
  if (!Number.isFinite(x)) return '0.';
  const s = Number(x.toPrecision(9)).toString();
  if (s.includes('e')) {
    const [m, e] = s.split('e');
    return `${m.includes('.') ? m : `${m}.`}E${e}`;
  }
  return s.includes('.') ? s : `${s}.`;
}

function asciiName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, '_').replace(/'/g, "''").slice(0, 80) || 'model';
}

export function writeStep(mesh: TriMesh, name = 'model'): StepResult {
  const p = mesh.positions;
  const lines: string[] = [];
  let id = 0;
  const add = (entity: string) => {
    lines.push(`#${++id}=${entity};`);
    return id;
  };
  const vec = (i: number) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  const point = (v: number[]) => add(`CARTESIAN_POINT('',(${v.map(real).join(',')}))`);
  const direction = (v: number[]) => add(`DIRECTION('',(${v.map(real).join(',')}))`);

  // Keep only non-degenerate triangles, with their unit normals.
  const tris: [number, number, number, number[]][] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t], b = mesh.indices[t + 1], c = mesh.indices[t + 2];
    if (a === b || b === c || a === c) continue;
    const [ax, ay, az] = vec(a), [bx, by, bz] = vec(b), [cx, cy, cz] = vec(c);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) continue;
    tris.push([a, b, c, n.map((x) => x / len)]);
  }

  // Closed and consistently oriented: every edge used exactly once in each direction.
  const directed = new Map<string, number>();
  for (const [a, b, c] of tris) for (const [s, e] of [[a, b], [b, c], [c, a]]) {
    const k = `${s},${e}`;
    directed.set(k, (directed.get(k) ?? 0) + 1);
  }
  let solid = tris.length > 0;
  for (const [k, count] of directed) {
    const [s, e] = k.split(',');
    if (count !== 1 || directed.get(`${e},${s}`) !== 1) { solid = false; break; }
  }

  // Context, units (mm) and origin.
  const appContext = add(`APPLICATION_CONTEXT('automotive design')`);
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${appContext})`);
  const productContext = add(`PRODUCT_CONTEXT('',#${appContext},'mechanical')`);
  const n = asciiName(name);
  const product = add(`PRODUCT('${n}','${n}','',(#${productContext}))`);
  add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#${product}))`);
  const formation = add(`PRODUCT_DEFINITION_FORMATION('','',#${product})`);
  const defContext = add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appContext},'design')`);
  const definition = add(`PRODUCT_DEFINITION('design','',#${formation},#${defContext})`);
  const shape = add(`PRODUCT_DEFINITION_SHAPE('','',#${definition})`);
  const mm = add(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`);
  const rad = add(`(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))`);
  const sr = add(`(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())`);
  const tol = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#${mm},'distance_accuracy_value','')`);
  const geoContext = add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${tol}))` +
    `GLOBAL_UNIT_ASSIGNED_CONTEXT((#${mm},#${rad},#${sr}))REPRESENTATION_CONTEXT('',''))`,
  );
  const origin = add(`AXIS2_PLACEMENT_3D('',#${point([0, 0, 0])},#${direction([0, 0, 1])},#${direction([1, 0, 0])})`);

  // Vertices, shared by all faces that use them.
  const pointIds = new Map<number, number>();
  const vertexIds = new Map<number, number>();
  const vertex = (i: number) => {
    let v = vertexIds.get(i);
    if (v === undefined) {
      const pt = point(vec(i));
      pointIds.set(i, pt);
      v = add(`VERTEX_POINT('',#${pt})`);
      vertexIds.set(i, v);
    }
    return v;
  };

  // Each undirected edge once, as a straight line from the lower to the higher index.
  const edgeIds = new Map<string, number>();
  const edge = (s: number, e: number) => {
    const lo = Math.min(s, e), hi = Math.max(s, e);
    const k = `${lo},${hi}`;
    let ed = edgeIds.get(k);
    if (ed === undefined) {
      const vlo = vertex(lo), vhi = vertex(hi);
      const [x0, y0, z0] = vec(lo), [x1, y1, z1] = vec(hi);
      const d = [x1 - x0, y1 - y0, z1 - z0];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      const dir = direction(d.map((x) => x / len));
      const line = add(`LINE('',#${pointIds.get(lo)},#${add(`VECTOR('',#${dir},${real(len)})`)})`);
      ed = add(`EDGE_CURVE('',#${vlo},#${vhi},#${line},.T.)`);
      edgeIds.set(k, ed);
    }
    return `#${add(`ORIENTED_EDGE('',*,*,#${ed},${s < e ? '.T.' : '.F.'})`)}`;
  };

  const faces: string[] = [];
  for (const [a, b, c, normal] of tris) {
    const loop = add(`EDGE_LOOP('',(${[edge(a, b), edge(b, c), edge(c, a)].join(',')}))`);
    const bound = add(`FACE_OUTER_BOUND('',#${loop},.T.)`);
    const [ax, ay, az] = vec(a), [bx, by, bz] = vec(b);
    const r = [bx - ax, by - ay, bz - az];
    const rl = Math.hypot(r[0], r[1], r[2]) || 1;
    const axis = add(`AXIS2_PLACEMENT_3D('',#${pointIds.get(a)},#${direction(normal)},#${direction(r.map((x) => x / rl))})`);
    const plane = add(`PLANE('',#${axis})`);
    faces.push(`#${add(`ADVANCED_FACE('',(#${bound}),#${plane},.T.)`)}`);
  }

  let representation: number;
  if (solid) {
    const shell = add(`CLOSED_SHELL('',(${faces.join(',')}))`);
    const brep = add(`MANIFOLD_SOLID_BREP('${n}',#${shell})`);
    representation = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(#${origin},#${brep}),#${geoContext})`);
  } else {
    const shell = add(`OPEN_SHELL('',(${faces.join(',')}))`);
    const model = add(`SHELL_BASED_SURFACE_MODEL('${n}',(#${shell}))`);
    representation = add(`MANIFOLD_SURFACE_SHAPE_REPRESENTATION('',(#${origin},#${model}),#${geoContext})`);
  }
  add(`SHAPE_DEFINITION_REPRESENTATION(#${shape},#${representation})`);

  const header = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION(('Furniture 3D draft, faceted'),'2;1');`,
    `FILE_NAME('${n}.step','${new Date().toISOString().slice(0, 19)}',(''),(''),'furniture-3d-draft','furniture-3d-draft','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`,
    'ENDSEC;',
    'DATA;',
  ];
  const text = [...header, ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n');
  return { bytes: new TextEncoder().encode(text), faces: faces.length, solid };
}
