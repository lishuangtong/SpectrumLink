const FAMILY_GEOMETRY = {
  generic: [5.2, 6, 1.28, 'underwing'],
  a320: [5.5, 6.5, 1.38, 'underwing'],
  b737: [5.35, 6.35, 1.32, 'underwing'],
  arj21: [4.8, 5.4, 1.08, 'rear'],
  c919: [5.6, 6.6, 1.4, 'underwing'],
  b787: [6.6, 7.7, 1.62, 'underwing'],
  b777: [7, 8, 1.72, 'underwing'],
  a330: [6.7, 7.8, 1.66, 'underwing'],
  a350: [6.9, 8.1, 1.72, 'underwing'],
  regional: [4.7, 5.1, 1.02, 'underwing'],
  turboprop: [4.8, 6, 1.15, 'propeller'],
};

const twoDecimals = (value) => Math.round(value * 100) / 100;

export function createAircraftMeshSpec(profile = {}) {
  const [baseLength, baseSpan, wingChord, engineLayout] = FAMILY_GEOMETRY[profile.family] || FAMILY_GEOMETRY.generic;
  return {
    fuselageLength: twoDecimals(baseLength * (profile.length || 1)),
    wingspan: twoDecimals(baseSpan * (profile.span || 1)),
    wingChord,
    engineLayout,
    engineCount: 2,
  };
}
